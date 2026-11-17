import axios from 'axios';

/**
 * 后端地址统一由环境变量控制：
 * 本地开发在 .env 里写 VITE_API_BASE_URL=http://localhost:3000
 * Render 上写后端服务的公网地址，例如 https://shunshou-api.onrender.com
 */
const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '');

export const axiosForBackend = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 20000,
});

/* ------------------------------------------------------------------
 * 轻量 GET 缓存（stale-while-revalidate）
 * 目的：公网部署时单次请求可能几百毫秒，页面切标签会连发多个请求导致卡顿。
 * 策略：GET 命中缓存立即返回旧数据（页面瞬间渲染），同时后台静默刷新；
 *       任何写操作成功后清空整表，保证不会读到过期的列表数据。
 * ------------------------------------------------------------------ */
const GET_TTL_MS = 15000;
const getCache = new Map<string, { data: unknown; time: number }>();
const getInflight = new Map<string, Promise<unknown>>();

/**
 * 实时性要求高的接口不能走缓存：
 * 聊天消息、通知、客服会话一旦被缓存，会表现为"对方十几秒后才收到"。
 */
const NO_CACHE_PATTERNS: RegExp[] = [
  /\/messages/i,
  /\/notifications/i,
  /\/user-session/i,
  /\/support\//i,
  /\/settlement\//i,
  /\/refund-sessions\//i,
  /\/admin\/support/i,
  /\/leaderboard/i,
];

function isVolatileUrl(url?: string): boolean {
  if (!url) return false;
  return NO_CACHE_PATTERNS.some((p) => p.test(url));
}

function buildCacheKey(config: { baseURL?: string; url?: string; params?: unknown }): string {
  let uid = '';
  let admin = 'u';
  try {
    const raw = localStorage.getItem('shunshou_user');
    if (raw) uid = (JSON.parse(raw) as { id?: string }).id ?? '';
    if (localStorage.getItem('shunshou_admin')) admin = 'a';
  } catch {
    // ignore
  }
  return [config.baseURL ?? '', config.url ?? '', JSON.stringify(config.params ?? {}), uid, admin].join('|');
}

// axios 1.x 的 defaults.adapter 是候选列表（如 ['xhr','http','fetch']），
// 必须先用 getAdapter 解析成真正的可调用函数，否则请求会全部失败。
const adapterList = axiosForBackend.defaults.adapter as unknown;
const rawAdapter: (config: any) => Promise<any> =
  typeof adapterList === 'function'
    ? (adapterList as (config: any) => Promise<any>)
    : ((axios as unknown as { getAdapter: (list: unknown) => (config: any) => Promise<any> }).getAdapter(adapterList));

axiosForBackend.defaults.adapter = (async (config: any) => {
  const method = String(config.method ?? 'get').toLowerCase();
  const shouldCache =
    method === 'get' &&
    !config.headers?.['x-skip-cache'] &&
    !isVolatileUrl(config.url);

  if (!shouldCache) {
    const res = await rawAdapter(config);
    if (method !== 'get') getCache.clear();
    return res;
  }

  const key = buildCacheKey(config);

  const refresh = (): Promise<any> => {
    const running = getInflight.get(key);
    if (running) return running;
    const task = (async () => {
      const res = await rawAdapter(config);
      getCache.set(key, { data: res.data, time: Date.now() });
      getInflight.delete(key);
      return res;
    })();
    getInflight.set(key, task);
    task.catch(() => getInflight.delete(key));
    return task;
  };

  const hit = getCache.get(key);
  if (hit && Date.now() - hit.time < GET_TTL_MS) {
    // 命中：先给页面数据，网络请求在后台跑
    refresh().catch(() => undefined);
    return { data: hit.data, status: 200, statusText: 'OK', headers: {}, config } as any;
  }

  return refresh();
}) as any;


/** 自动带上当前登录用户 id，后端据此识别身份 */
axiosForBackend.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('shunshou_user');
    if (raw) {
      const stored = JSON.parse(raw) as { id?: string };
      if (stored?.id) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>)['x-user-id'] = stored.id;
      }
    }
  } catch {
    // 忽略存储异常
  }
  return config;
});
import type {
  User,
  Order,
  ChatMessage,
  RefundRequest,
  FeeDetail,
  OrderListResponse,
  ApiResp as ApiResponse,
  PaymentOrder,
  PaymentAccount,
  PaymentConfig,
  FundTransaction,
  CreatePaymentRequest,
  CreatePaymentResponse,
  SavePaymentAccountRequest,
  SavePaymentConfigRequest,
  FundTxListResponse,
  PayChannel,
  QrConfig,
  SettlementSession,
  SettlementMessage,
  SendSettlementMessageRequest,
  RunnerEarningsSummary,
  MessageType,
  RefundSession,
  RefundMessage,
  SendRefundMessageRequest,
  ConfirmRefundRequest,
  RejectRefundRequest,
} from '@shared/api.interface';

const ADMIN_STORAGE_KEY = 'shunshou_admin';
let adminTokenCache: string | null = null;

function getAdminToken(): string | null {
  if (adminTokenCache) return adminTokenCache;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      adminTokenCache = parsed.token ?? null;
      return adminTokenCache;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function setAdminToken(adminInfo: { adminId: string; username: string; name: string; token: string }): void {
  adminTokenCache = adminInfo.token;
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminInfo));
  } catch (e) {
    // ignore
  }
}

export function clearAdminToken(): void {
  adminTokenCache = null;
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

function isAdminPath(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/admin/') || url.includes('/api/settlement/admin/');
}

let adminAuthHandled = false;
function handleAdminAuthExpired(): void {
  if (adminAuthHandled) return;
  adminAuthHandled = true;
  clearAdminToken();
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
      // eslint-disable-next-line no-restricted-syntax
      window.location.href = '/admin/login';
    }
  }
  setTimeout(() => {
    adminAuthHandled = false;
  }, 2000);
}

axiosForBackend.interceptors.request.use(
  (config) => {
    const token = getAdminToken();
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('x-admin-token', token);
      } else if (config.headers) {
        (config.headers as Record<string, string>)['x-admin-token'] = token;
      } else {
        config.headers = { 'x-admin-token': token } as any;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    if (status === 401 && isAdminPath(url)) {
      handleAdminAuthExpired();
      if (error?.response?.data?.error) {
        error.response.data.error.message = '登录已过期，请重新登录';
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  },
);

export interface LoginParams {
  phone: string;
  name?: string;
  dormitory?: string;
}

export interface RegisterParams {
  phone: string;
  name: string;
  dormitory: string;
}

export const auth = {
  login: (params: LoginParams) =>
    axiosForBackend.post<ApiResponse<{ user: User; token: string }>>('/api/auth/login', params).then((r) => r.data),
  register: (params: RegisterParams) =>
    axiosForBackend.post<ApiResponse<{ user: User; token: string }>>('/api/auth/register', params).then((r) => r.data),
};

export const users = {
  getById: (id: string) =>
    axiosForBackend.get<ApiResponse<User>>(`/api/users/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<User>) =>
    axiosForBackend.patch<ApiResponse<User>>(`/api/users/${id}`, data).then((r) => r.data),
  applyRunner: (params: { userId: string; name: string; phone: string; wechatId: string; paymentQrUrl: string }) =>
    axiosForBackend.post<ApiResponse<User>>('/api/users/apply-runner', params).then((r) => r.data),
  switchRole: (id: string, role: 'buyer' | 'runner') =>
    axiosForBackend.post<ApiResponse<User>>(`/api/users/${id}/switch-role`, { role }).then((r) => r.data),
  list: (params?: { isRunner?: boolean; page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<{ items: User[]; total: number }>>('/api/users', { params }).then((r) => r.data),
  updateQrCodes: (id: string, wechatQrUrl: string, alipayQrUrl: string) =>
    axiosForBackend.post<ApiResponse<User>>(`/api/users/${id}/qr-codes`, { wechatQrUrl, alipayQrUrl }).then((r) => r.data),
  getQrCodes: (id: string) =>
    axiosForBackend.get<ApiResponse<{ wechatQrUrl: string; alipayQrUrl: string }>>(`/api/users/${id}/qr-codes`).then((r) => r.data),
  getLatestApplication: (userId: string) =>
    axiosForBackend.get<ApiResponse<import('@shared/api.interface').RunnerApplication | null>>(`/api/users/${userId}/latest-application`).then((r) => r.data),
  notifications: (userId: string, params?: { page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<import('@shared/api.interface').NotificationListResponse>>(`/api/users/${userId}/notifications`, { params }).then((r) => r.data),
  markAllNotificationsRead: (userId: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/users/${userId}/notifications/read-all`).then((r) => r.data),
  markNotificationRead: (userId: string, notifId: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/users/${userId}/notifications/${notifId}/read`).then((r) => r.data),
  leaderboard: (limit = 10) =>
    axiosForBackend.get<ApiResponse<LeaderboardData>>('/api/users/leaderboard', { params: { limit } }).then((r) => r.data),
};

export interface LeaderboardItem {
  rank: number;
  userId: string;
  name: string;
  dormitory: string;
  orderCount: number;
  earnings: string;
}

export interface LeaderboardData {
  items: LeaderboardItem[];
}

export const orders = {
  calculateFee: (params: { packageCount: number; isRainy?: boolean; isUrgent?: boolean }) =>
    axiosForBackend.post<ApiResponse<FeeDetail>>('/api/orders/calculate-fee', params).then((r) => r.data),
  create: (params: {
    buyerId: string;
    packages: { trackingNo: string; pickupPhone: string; size: string }[];
    isRainy: boolean;
    isUrgent: boolean;
    dormitory: string;
    contactPhone: string;
    remark?: string;
  }) =>
    axiosForBackend.post<ApiResponse<Order>>('/api/orders', params).then((r) => r.data),
  list: (params?: {
    status?: string;
    buyerId?: string;
    runnerId?: string;
    excludeBuyerId?: string;
    page?: number;
    pageSize?: number;
  }) =>
    axiosForBackend.get<ApiResponse<OrderListResponse>>('/api/orders', { params }).then((r) => r.data),
  detail: (id: string) =>
    axiosForBackend.get<ApiResponse<Order>>(`/api/orders/${id}`).then((r) => r.data),
  accept: (id: string, runnerId: string) =>
    axiosForBackend.post<ApiResponse<Order>>(`/api/orders/${id}/accept`, { runnerId }).then((r) => r.data),
  deliver: (id: string, runnerId: string) =>
    axiosForBackend.post<ApiResponse<{ order: Order; settlementSessionId: string }>>(`/api/orders/${id}/deliver`, { runnerId }).then((r) => r.data),
  confirm: (id: string, buyerId: string) =>
    axiosForBackend.post<ApiResponse<Order>>(`/api/orders/${id}/confirm`, { buyerId }).then((r) => r.data),
  refund: (id: string, buyerId: string, reason: string, screenshotUrl?: string) =>
    axiosForBackend.post<ApiResponse<{ order: Order; refund: RefundRequest; sessionId: string }>>(`/api/orders/${id}/refund`, {
      buyerId,
      reason,
      screenshotUrl,
    }).then((r) => r.data),
  getRefundSessionByOrder: (orderId: string) =>
    axiosForBackend.get<ApiResponse<RefundSession | null>>(`/api/orders/${orderId}/refund-session`).then((r) => r.data),
  forceComplete: (id: string) =>
    axiosForBackend.post<ApiResponse<Order>>(`/api/orders/${id}/force-complete`).then((r) => r.data),
  cancel: (id: string) =>
    axiosForBackend.post<ApiResponse<Order>>(`/api/orders/${id}/cancel`).then((r) => r.data),
  markPaid: (id: string, payProofUrl?: string, payRemark?: string) =>
    axiosForBackend.post<ApiResponse<Order>>(`/api/orders/${id}/mark-paid`, { payProofUrl, payRemark }).then((r) => r.data),
};

export const chat = {
  list: (orderId: string) =>
    axiosForBackend.get<ApiResponse<ChatMessage[]>>(`/api/chat/${orderId}`).then((r) => r.data),
  send: (params: {
    orderId: string;
    senderId: string;
    senderRole: string;
    msgType: 'text' | 'image';
    content: string;
    imageUrl?: string;
    isDeliveryPhoto?: boolean;
  }) =>
    axiosForBackend.post<ApiResponse<ChatMessage>>('/api/chat/send', params).then((r) => r.data),
};

export const refundSession = {
  getSession: (id: string) =>
    axiosForBackend.get<ApiResponse<RefundSession>>(`/api/refund-sessions/${id}`).then((r) => r.data),
  getMessages: (id: string) =>
    axiosForBackend.get<ApiResponse<RefundMessage[]>>(`/api/refund-sessions/${id}/messages`).then((r) => r.data),
  sendMessage: (id: string, params: SendRefundMessageRequest) =>
    axiosForBackend.post<ApiResponse<RefundMessage>>(`/api/refund-sessions/${id}/send`, params).then((r) => r.data),
};

export const settlement = {
  getRunnerList: (userId: string) =>
    axiosForBackend.get<ApiResponse<SettlementSession[]>>('/api/settlement/runner/list', { params: { userId } }).then((r) => r.data),
  getRunnerEarnings: (userId: string) =>
    axiosForBackend.get<ApiResponse<RunnerEarningsSummary>>('/api/settlement/runner/earnings', { params: { userId } }).then((r) => r.data),
  getSession: (id: string, userId: string) =>
    axiosForBackend.get<ApiResponse<SettlementSession>>(`/api/settlement/${id}`, { params: { userId } }).then((r) => r.data),
  getMessages: (id: string, userId: string) =>
    axiosForBackend.get<ApiResponse<SettlementMessage[]>>(`/api/settlement/${id}/messages`, { params: { userId } }).then((r) => r.data),
  sendMessage: (id: string, params: SendSettlementMessageRequest & { msgType: MessageType; userId: string }) =>
    axiosForBackend.post<ApiResponse<SettlementMessage>>(`/api/settlement/${id}/send`, params).then((r) => r.data),
  adminList: (status?: string) =>
    axiosForBackend.get<ApiResponse<{ items: SettlementSession[]; total: number }>>('/api/settlement/admin/list', { params: { status } }).then((r) => r.data),
};

// 客服会话类型
export type SupportSessionType = 'buyer_platform' | 'runner_platform';

export interface SupportSession {
  id: string;
  sessionType: SupportSessionType;
  userId: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  sessionId: string;
  senderRole: 'user' | 'platform' | 'system';
  senderId: string | null;
  msgType: 'text' | 'image';
  content: string;
  imageUrl: string;
  isSystem: boolean;
  createdAt: string;
}

export const support = {
  getUserSession: (sessionType: SupportSessionType, userId: string) =>
    axiosForBackend.get<ApiResponse<SupportSession | null>>('/api/support/user-session', {
      params: { sessionType, userId },
    }).then((r) => r.data),
  getMessages: (sessionId: string, userId: string) =>
    axiosForBackend.get<ApiResponse<SupportMessage[]>>(`/api/support/${sessionId}/messages`, {
      params: { userId },
    }).then((r) => r.data),
  sendMessage: (
    sessionId: string,
    userId: string,
    msgType: 'text' | 'image',
    content?: string,
    imageUrl?: string,
  ) =>
    axiosForBackend.post<ApiResponse<SupportMessage>>(`/api/support/${sessionId}/send`, {
      userId,
      msgType,
      content,
      imageUrl,
    }).then((r) => r.data),
};

export const payment = {
  getMode: () =>
    axiosForBackend.get<ApiResponse<{ mode: 'mock' | 'real' }>>('/api/payment/mode').then((r) => r.data),
  create: (orderId: string, channel: PayChannel) =>
    axiosForBackend.post<ApiResponse<CreatePaymentResponse>>('/api/payment/orders', { orderId, channel }).then((r) => r.data),
  mockSuccess: (payNo: string) =>
    axiosForBackend.post<ApiResponse<PaymentOrder>>('/api/payment/mock-success', { payNo }).then((r) => r.data),
  getAccounts: () =>
    axiosForBackend.get<ApiResponse<PaymentAccount[]>>('/api/payment/accounts').then((r) => r.data),
  saveAccount: (params: { channel: PayChannel; accountNo: string; realName?: string }) =>
    axiosForBackend.post<ApiResponse<PaymentAccount>>('/api/payment/accounts', params).then((r) => r.data),
  getConfig: () =>
    axiosForBackend.get<ApiResponse<PaymentConfig>>('/api/payment/config').then((r) => r.data),
  saveConfig: (params: PaymentConfig) =>
    axiosForBackend.post<ApiResponse<PaymentConfig>>('/api/payment/config', params).then((r) => r.data),
  transactions: (params?: { page?: number; pageSize?: number; txType?: string; status?: string }) =>
    axiosForBackend.get<ApiResponse<FundTxListResponse>>('/api/payment/transactions', { params }).then((r) => r.data),
  retryProfitSharing: (orderId: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/payment/profit-sharing/${orderId}/retry`).then((r) => r.data),
  getQrConfig: () =>
    axiosForBackend.get<ApiResponse<QrConfig>>('/api/qr-config').then((r) => r.data),
};

export const admin = {
  login: (username: string, password: string) =>
    axiosForBackend
      .post<ApiResponse<{ adminId: string; username: string; name: string; token: string }>>('/api/admin/login', {
        username,
        password,
      })
      .then((r) => r.data),
  changePassword: (adminId: string, oldPassword: string, newPassword: string) =>
    axiosForBackend
      .post<ApiResponse<boolean>>('/api/admin/change-password', { adminId, oldPassword, newPassword })
      .then((r) => r.data),
  dashboard: () =>
    axiosForBackend
      .get<ApiResponse<import('@shared/api.interface').AdminDashboard>>('/api/admin/dashboard')
      .then((r) => r.data),
  refunds: (params?: { status?: string; page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<{ items: RefundRequest[]; total: number }>>('/api/admin/refunds', { params }).then((r) => r.data),
  refundDetail: (id: string) =>
    axiosForBackend.get<ApiResponse<{ refund: RefundRequest; order: Order; messages: ChatMessage[] }>>(`/api/admin/refunds/${id}`).then((r) => r.data),
  approveRefund: (id: string, adminName: string) =>
    axiosForBackend.post<ApiResponse<RefundRequest>>(`/api/admin/refunds/${id}/approve`, { adminName }).then((r) => r.data),
  rejectRefund: (id: string, adminName: string, rejectReason: string) =>
    axiosForBackend.post<ApiResponse<RefundRequest>>(`/api/admin/refunds/${id}/reject`, { adminName, rejectReason }).then((r) => r.data),
  getRefundSession: (sessionId: string) =>
    axiosForBackend.get<ApiResponse<RefundSession>>(`/api/admin/refund-sessions/${sessionId}`).then((r) => r.data),
  getRefundSessionMessages: (sessionId: string) =>
    axiosForBackend.get<ApiResponse<RefundMessage[]>>(`/api/admin/refund-sessions/${sessionId}/messages`).then((r) => r.data),
  sendRefundSessionMessage: (sessionId: string, params: SendRefundMessageRequest) =>
    axiosForBackend.post<ApiResponse<RefundMessage>>(`/api/admin/refund-sessions/${sessionId}/send`, params).then((r) => r.data),
  confirmRefund: (sessionId: string, params: ConfirmRefundRequest) =>
    axiosForBackend.post<ApiResponse<RefundSession>>(`/api/admin/refund-sessions/${sessionId}/confirm`, params).then((r) => r.data),
  rejectRefundSession: (sessionId: string, params: RejectRefundRequest) =>
    axiosForBackend.post<ApiResponse<RefundSession>>(`/api/admin/refund-sessions/${sessionId}/reject`, params).then((r) => r.data),
  orders: (params?: { status?: string; page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<OrderListResponse>>('/api/admin/orders', { params }).then((r) => r.data),
  users: (params?: { isRunner?: boolean; page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<{ items: User[]; total: number }>>('/api/admin/users', { params }).then((r) => r.data),
  earnings: () =>
    axiosForBackend.get<ApiResponse<{ totalEarnings: string; availableWithdraw: string }>>('/api/admin/earnings').then((r) => r.data),
  verifyPayment: (orderId: string, verified: boolean, remark?: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/admin/orders/${orderId}/verify-payment`, { verified, remark }).then((r) => r.data),
  getSettlementSession: (sessionId: string) =>
    axiosForBackend.get<ApiResponse<import('@shared/api.interface').SettlementSession>>(`/api/settlement/admin/${sessionId}`).then((r) => r.data),
  getSettlementMessages: (sessionId: string) =>
    axiosForBackend.get<ApiResponse<import('@shared/api.interface').SettlementMessage[]>>(`/api/settlement/admin/${sessionId}/messages`).then((r) => r.data),
  sendSettlementMessage: (sessionId: string, params: { msgType: 'text' | 'image'; content?: string; imageUrl?: string }) =>
    axiosForBackend.post<ApiResponse<import('@shared/api.interface').SettlementMessage>>(`/api/settlement/admin/${sessionId}/send`, params).then((r) => r.data),
  markSettlementPaid: (sessionId: string, amountFen: number, remark?: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/settlement/${sessionId}/mark-paid`, { amountFen, remark }).then((r) => r.data),
  runnerApplications: (params?: { status?: string; page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<{ items: import('@shared/api.interface').RunnerApplication[]; total: number }>>('/api/admin/runner-applications', { params }).then((r) => r.data),
  approveRunnerApplication: (id: string, adminName: string) =>
    axiosForBackend.post<ApiResponse<import('@shared/api.interface').RunnerApplication>>(`/api/admin/runner-applications/${id}/approve`, { adminName }).then((r) => r.data),
  rejectRunnerApplication: (id: string, adminName: string, rejectReason: string) =>
    axiosForBackend.post<ApiResponse<import('@shared/api.interface').RunnerApplication>>(`/api/admin/runner-applications/${id}/reject`, { adminName, rejectReason }).then((r) => r.data),
  notifications: (params?: { page?: number; pageSize?: number }) =>
    axiosForBackend.get<ApiResponse<import('@shared/api.interface').NotificationListResponse>>('/api/admin/notifications', { params }).then((r) => r.data),
  markAllNotificationsRead: () =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>('/api/admin/notifications/read-all').then((r) => r.data),
  markNotificationRead: (notifId: string) =>
    axiosForBackend.post<ApiResponse<{ success: boolean }>>(`/api/admin/notifications/${notifId}/read`).then((r) => r.data),
  support: {
    list: (params?: { sessionType?: string; page?: number; pageSize?: number }) =>
      axiosForBackend
        .get<ApiResponse<import('@shared/api.interface').SupportSessionListResponse>>('/api/support/admin/list', {
          params,
        })
        .then((r) => r.data),
    getMessages: (sessionId: string) =>
      axiosForBackend
        .get<ApiResponse<import('@shared/api.interface').SupportMessage[]>>(`/api/support/admin/${sessionId}/messages`)
        .then((r) => r.data),
    sendMessage: (
      sessionId: string,
      body: { msgType: 'text' | 'image'; content?: string; imageUrl?: string },
    ) =>
      axiosForBackend
        .post<ApiResponse<import('@shared/api.interface').SupportMessage>>(`/api/support/admin/${sessionId}/send`, body)
        .then((r) => r.data),
    closeSession: (sessionId: string, remark?: string) =>
      axiosForBackend
        .post<ApiResponse<{ success: boolean }>>(`/api/support/admin/${sessionId}/close`, { remark })
        .then((r) => r.data),
    markRead: (sessionId: string) =>
      axiosForBackend
        .post<ApiResponse<{ success: boolean }>>(`/api/support/admin/${sessionId}/mark-read`)
        .then((r) => r.data),
  },
};

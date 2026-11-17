/* 前后端共享的类型写在这里 */

// ========== 订单状态 ==========
export const ORDER_STATUSES = [
  'pending',
  'in_progress',
  'delivered',
  'completed',
  'refunding',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const isOrderStatus = (v: string): v is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(v);
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '等待接单',
  in_progress: '进行中',
  delivered: '已送达',
  completed: '已完成',
  refunding: '退款中',
  refunded: '已退款',
};

// ========== 包裹规格 ==========
export const PACKAGE_SIZES = ['small', 'medium', 'large', 'oversize'] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];
export const isPackageSize = (v: string): v is PackageSize =>
  (PACKAGE_SIZES as readonly string[]).includes(v);
export const PACKAGE_SIZE_LABELS: Record<PackageSize, string> = {
  small: '小件',
  medium: '中件',
  large: '大件',
  oversize: '超重',
};

// ========== 用户角色 ==========
export const USER_ROLES = ['buyer', 'runner'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const isUserRole = (v: string): v is UserRole =>
  (USER_ROLES as readonly string[]).includes(v);

// ========== 跑腿员申请状态 ==========
export const RUNNER_APPLY_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RunnerApplyStatus = (typeof RUNNER_APPLY_STATUSES)[number];
export const isRunnerApplyStatus = (v: string): v is RunnerApplyStatus =>
  (RUNNER_APPLY_STATUSES as readonly string[]).includes(v);
export const RUNNER_APPLY_STATUS_LABELS: Record<RunnerApplyStatus, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
};

// ========== 退款状态 ==========
export const REFUND_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
};

// ========== 支付状态 ==========
export const PAYMENT_STATUSES = ['unpaid', 'pending_verify', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const isPaymentStatus = (v: string): v is PaymentStatus =>
  (PAYMENT_STATUSES as readonly string[]).includes(v);
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: '待支付',
  pending_verify: '待核对',
  paid: '已支付',
  refunded: '已退款',
};

// ========== 支付渠道 ==========
export const PAY_CHANNELS = ['wechat_qr', 'alipay_qr', 'mock'] as const;
export type PayChannel = (typeof PAY_CHANNELS)[number];
export const isPayChannel = (v: string): v is PayChannel =>
  (PAY_CHANNELS as readonly string[]).includes(v);
export const PAY_CHANNEL_LABELS: Record<PayChannel, string> = {
  wechat_qr: '微信收款码',
  alipay_qr: '支付宝收款码',
  mock: '模拟支付',
};

// ========== 资金流水类型 ==========
export const FUND_TX_TYPES = [
  'buyer_payment',
  'settlement_pay',
  'settlement_settle',
  'refund',
  'withdraw',
  'platform_fee',
] as const;
export type FundTxType = (typeof FUND_TX_TYPES)[number];
export const isFundTxType = (v: string): v is FundTxType =>
  (FUND_TX_TYPES as readonly string[]).includes(v);
export const FUND_TX_TYPE_LABELS: Record<FundTxType, string> = {
  buyer_payment: '买家付款',
  settlement_pay: '结算打款',
  settlement_settle: '结算分账',
  refund: '退款',
  withdraw: '提现',
  platform_fee: '平台手续费',
};

// ========== 资金流水状态 ==========
export const FUND_TX_STATUSES = ['pending', 'success', 'failed', 'pending_verify'] as const;
export type FundTxStatus = (typeof FUND_TX_STATUSES)[number];
export const FUND_TX_STATUS_LABELS: Record<FundTxStatus, string> = {
  pending: '处理中',
  success: '成功',
  failed: '失败',
  pending_verify: '待核对',
};

// ========== 提现状态 ==========
export const WITHDRAW_STATUSES = ['pending', 'paid', 'failed'] as const;
export type WithdrawStatus = (typeof WITHDRAW_STATUSES)[number];
export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  pending: '审核中',
  paid: '已打款',
  failed: '失败',
};

// ========== 消息类型 ==========
export const MESSAGE_TYPES = ['text', 'image'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

// ========== 业务实体类型 ==========

export interface User {
  id: string;
  phone: string;
  name: string;
  dormitory: string;
  balance: string;
  totalOrders: number;
  totalEarnings: string;
  isRunner: boolean;
  wechatId: string;
  wechatQrUrl: string;
  alipayQrUrl: string;
  userRole: UserRole;
  runnerStatus: RunnerApplyStatus | 'none';
  createdAt: string;
}

export interface Package {
  id: string;
  orderId: string;
  trackingNo: string;
  pickupPhone: string;
  size: PackageSize;
}

export interface Order {
  id: string;
  orderNo: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  runnerId: string | null;
  runnerName: string | null;
  runnerPhone: string | null;
  status: OrderStatus;
  totalAmount: string;
  baseFee: string;
  extraFee: string;
  rainyFee: string;
  urgentFee: string;
  isRainy: boolean;
  isUrgent: boolean;
  packageCount: number;
  dormitory: string;
  contactPhone: string;
  remark: string;
  runnerEarnings: string;
  platformFee: string;
  paymentStatus: PaymentStatus;
  payChannel: PayChannel | null;
  thirdPartyTradeNo: string | null;
  paidAt: string | null;
  payProofUrl: string;
  payRemark: string;
  deliveredAt: string | null;
  confirmedAt: string | null;
  autoSettleAt: string | null;
  settlementSessionId: string | null;
  packages: Package[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  msgType: MessageType;
  content: string;
  imageUrl: string;
  isDeliveryPhoto: boolean;
  createdAt: string;
}

export interface RefundRequest {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerDormitory: string;
  runnerId: string | null;
  runnerName: string | null;
  runnerPhone: string | null;
  runnerWechat: string | null;
  reason: string;
  status: RefundStatus;
  rejectReason: string;
  reviewedBy: string;
  reviewedAt: string | null;
  orderAmount: string;
  packageCount: number;
  isRainy: boolean;
  isUrgent: boolean;
  refundAmount: string;
  screenshotUrl: string;
  sessionId: string;
  createdAt: string;
}

export interface ApplyRefundRequest {
  reason: string;
  screenshotUrl?: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: string;
  status: WithdrawStatus;
  wechatId: string;
  channel: PayChannel;
  payAccountNo: string | null;
  realName: string | null;
  payQrUrl: string;
  reviewedBy: string;
  reviewedAt: string | null;
  paidAt: string | null;
  failReason: string | null;
  createdAt: string;
}

// ========== 支付单 ==========
export interface PaymentOrder {
  id: string;
  orderId: string;
  payNo: string;
  amountFen: number;
  channel: PayChannel;
  status: 'pending' | 'paid' | 'failed' | 'closed';
  thirdPartyTradeNo: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ========== 资金流水 ==========
export interface FundTransaction {
  id: string;
  orderId: string | null;
  txType: FundTxType;
  amountFen: number;
  direction: 'in' | 'out';
  channel: string;
  status: FundTxStatus;
  thirdPartyNo: string | null;
  runnerId: string | null;
  adminId: string | null;
  remark: string | null;
  operatorName: string | null;
  createdAt: string;
}

// ========== 收款账户 ==========
export interface PaymentAccount {
  id: string;
  channel: PayChannel;
  accountNo: string;
  realName: string | null;
  isDefault: boolean;
  createdAt: string;
}

// ========== 分账记录 ==========
export interface ProfitSharingRecord {
  id: string;
  orderId: string;
  totalAmountFen: number;
  runnerAmountFen: number;
  platformAmountFen: number;
  status: 'pending' | 'success' | 'failed';
  failReason: string | null;
  retryCount: number;
  createdAt: string;
}

// ========== 支付配置 ==========
export interface PaymentConfig {
  paymentMode: 'mock' | 'real';
  wechatAppId: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatCertSerial: string;
  wechatPrivateKey: string;
  wechatPlatformCert: string;
  alipayAppId: string;
  alipayPrivateKey: string;
  alipayPublicKey: string;
  isManualMode: boolean;
}

// ========== 资金看板 ==========
export interface FundDashboard {
  unpaidAmount: string;
  escrowAmount: string;
  todayAmount: string;
  totalSharingAmount: string;
  platformFeeTotal: string;
  pendingRefunds: number;
  pendingWithdraws: number;
}

// ========== 请求/响应类型 ==========

export interface ApiResp<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

// 认证
export interface RegisterRequest {
  phone: string;
  name: string;
  dormitory: string;
}
export interface LoginRequest {
  phone: string;
  name?: string;
  dormitory?: string;
}
export interface AuthResponse {
  user: User;
  token: string;
}

// 跑腿员申请
export interface ApplyRunnerRequest {
  userId: string;
  name: string;
  phone: string;
  wechatId: string;
  paymentQrUrl: string;
}

export interface RunnerApplication {
  id: string;
  userId: string;
  name: string;
  phone: string;
  wechatId: string;
  paymentQrUrl: string;
  status: RunnerApplyStatus;
  rejectReason: string;
  reviewedBy: string;
  reviewedAt: string | null;
  createdAt: string;
}

// 角色切换
export interface SwitchRoleRequest {
  role: UserRole;
}

// 订单创建
export interface CreateOrderPackage {
  trackingNo: string;
  pickupPhone: string;
  size: PackageSize;
}
export interface CreateOrderRequest {
  packages: CreateOrderPackage[];
  isRainy: boolean;
  isUrgent: boolean;
  dormitory: string;
  contactPhone: string;
  remark: string;
  buyerId: string;
}

// 计费明细
export interface FeeDetail {
  baseFee: string;
  extraFee: string;
  rainyFee: string;
  urgentFee: string;
  total: string;
}

// 订单列表
export interface OrderListResponse {
  items: Order[];
  total: number;
}

// 聊天
export interface SendMessageRequest {
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  msgType: MessageType;
  content: string;
  imageUrl?: string;
  isDeliveryPhoto?: boolean;
}

// 退款
export interface RefundApplyRequest {
  orderId: string;
  buyerId: string;
  reason: string;
}

// 提现
export interface WithdrawApplyRequest {
  userId: string;
  amount: string;
  channel?: PayChannel;
  payAccountNo?: string;
  realName?: string;
  payQrUrl?: string;
}

// 创建支付单
export interface CreatePaymentRequest {
  orderId: string;
  channel: PayChannel;
}
export interface CreatePaymentResponse {
  paymentOrder: PaymentOrder;
  payUrl?: string;
  payParams?: Record<string, string>;
}

// 收款账户
export interface SavePaymentAccountRequest {
  userId: string;
  channel: PayChannel;
  accountNo: string;
  realName?: string;
}

// 支付配置保存
export interface SavePaymentConfigRequest extends PaymentConfig {}

// 资金流水列表
export interface FundTxListResponse {
  items: FundTransaction[];
  total: number;
}

// 管理员登录
export interface AdminLoginRequest {
  username: string;
  password: string;
}
export interface AdminLoginResponse {
  adminId: string;
  username: string;
  name: string;
  token: string;
}

// 管理员看板
export interface AdminDashboard {
  // 订单统计
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalAmount: string;
  platformEarnings: string;
  pendingRefunds: number;
  pendingWithdraws: number;
  // 资金看板扩展
  unpaidAmount: string;
  escrowAmount: string;
  todayAmount: string;
  totalSharingAmount: string;
  platformFeeTotal: string;
  // 线下收款码模式扩展
  pendingVerifyPayments: number;
  escrowAmountVerified: string;
  pendingSettlementAmount: string;
  settledAmount: string;
  // 待核对付款
  pendingVerifyCount: number;
  pendingVerifyAmount: string;
  // 待打款给跑腿员总额
  pendingPayoutAmount: string;
  // 兼职审核
  pendingRunnerApplications: number;
  approvedRunnerCount: number;
  todayNewOrders: number;
  unreadNotifications: number;
}

// ========== 收款码配置 ==========
export interface QrConfig {
  id: string;
  wechatQrUrl: string;
  alipayQrUrl: string;
  payeeNickname: string;
  paymentNote: string;
  updatedAt: string;
}

export interface SaveQrConfigRequest {
  wechatQrUrl: string;
  alipayQrUrl: string;
  payeeNickname: string;
  paymentNote: string;
}

// ========== 结算会话 ==========
export const SETTLEMENT_SESSION_STATUSES = [
  'pending_payment',
  'pending_settle',
  'paid',
  'refunded',
] as const;
export type SettlementSessionStatus = (typeof SETTLEMENT_SESSION_STATUSES)[number];
export const SETTLEMENT_SESSION_STATUS_LABELS: Record<SettlementSessionStatus, string> = {
  pending_payment: '待付款',
  pending_settle: '待打款',
  paid: '已打款',
  refunded: '已退款',
};

export interface SettlementSession {
  id: string;
  orderId: string;
  orderNo: string;
  runnerId: string;
  runnerName: string;
  runnerPhone: string;
  wechatQrUrl: string;
  totalAmountFen: number;
  runnerAmountFen: number;
  platformFeeFen: number;
  status: SettlementSessionStatus;
  paidAt: string | null;
  paidRemark: string | null;
  payProofUrl: string | null;
  createdAt: string;
}

export interface SettlementMessage {
  id: string;
  sessionId: string;
  senderRole: 'runner' | 'platform' | 'system';
  msgType: MessageType;
  content: string;
  imageUrl: string;
  isSystem: boolean;
  createdAt: string;
}

export interface SendSettlementMessageRequest {
  content?: string;
  imageUrl?: string;
  msgType: MessageType;
}

export interface MarkSettlementPaidRequest {
  remark: string;
}

// 我已付款请求
export interface ConfirmPaymentRequest {
  payProofUrl?: string;
  remark?: string;
  channel: PayChannel;
}

// 用户收款码
export interface SaveRunnerQrRequest {
  wechatQrUrl: string;
  alipayQrUrl: string;
}

// 收益统计
export interface RunnerEarningsSummary {
  totalEarnings: string;
  pendingSettlement: string;
  settled: string;
  totalPlatformFee: string;
  availableWithdraw: string;
}

// 管理员修改密码
export interface AdminChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// ========== 站内通知 ==========
export interface Notification {
  id: string;
  recipientType: 'user' | 'admin';
  recipientId: string;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unreadCount: number;
}

// ========== 退款会话（买家 ↔ 平台） ==========
export type RefundSessionStatus = 'pending' | 'refunded' | 'rejected';

export interface RefundSession {
  id: string;
  orderId: string;
  buyerId: string;
  refundRequestId: string;
  status: RefundSessionStatus;
  refundAmountFen: number | null;
  refundRemark: string | null;
  rejectReason: string | null;
  orderAmount: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  refundReason: string;
  screenshotUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundMessage {
  id: string;
  sessionId: string;
  senderRole: 'buyer' | 'platform' | 'system';
  senderId: string | null;
  msgType: 'text' | 'image';
  content: string;
  imageUrl: string;
  isSystem: boolean;
  createdAt: string;
}

export interface SendRefundMessageRequest {
  msgType: 'text' | 'image';
  content?: string;
  imageUrl?: string;
}

export interface ConfirmRefundRequest {
  refundAmountFen?: number;
  remark: string;
}

export interface RejectRefundRequest {
  reason: string;
}

// ========== 客服会话（买家/跑腿员 ↔ 平台） ==========
export type SupportSessionType = 'buyer_platform' | 'runner_platform';
export type SupportSessionStatus = 'active' | 'closed';
export type SupportSenderRole = 'user' | 'platform' | 'system';

export interface SupportSession {
  id: string;
  sessionType: SupportSessionType;
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadAdminCount: number;
  unreadUserCount: number;
  status: SupportSessionStatus;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  sessionId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  senderName: string;
  msgType: 'text' | 'image';
  content: string;
  imageUrl: string;
  isSystem: boolean;
  relatedOrderId: string | null;
  createdAt: string;
}

export interface SupportSessionListResponse {
  items: SupportSession[];
  total: number;
}

export interface SendSupportMessageRequest {
  userId?: string;
  msgType: 'text' | 'image';
  content?: string;
  imageUrl?: string;
}

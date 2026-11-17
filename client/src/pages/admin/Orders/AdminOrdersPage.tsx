import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Check, X, Loader2, XIcon, MessageSquare } from 'lucide-react';

import { admin, orders as ordersApi } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@client/src/components/ui/dialog';
import Image from '@client/src/components/ui/image';
import type { Order, OrderStatus, PaymentStatus, SettlementSession, SettlementMessage } from '@shared/api.interface';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PACKAGE_SIZE_LABELS,
  PAYMENT_STATUS_LABELS,
  SETTLEMENT_SESSION_STATUS_LABELS,
} from '@shared/api.interface';

type TabKey = 'all' | 'pending_verify' | OrderStatus;

const tabKeys: TabKey[] = ['all', 'pending_verify', ...ORDER_STATUSES];

const tabLabels: Record<TabKey, string> = {
  all: '全部',
  pending_verify: '待核对',
  pending: '待接单',
  in_progress: '进行中',
  delivered: '已送达',
  completed: '已完成',
  refunding: '退款中',
  refunded: '已退款',
};

const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const initialTab = urlStatus && (tabKeys as string[]).includes(urlStatus)
    ? (urlStatus as TabKey)
    : 'all';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'forceComplete' | 'cancel' | 'verifyReject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');

  // 结算会话
  const [settlementSession, setSettlementSession] = useState<SettlementSession | null>(null);
  const [settlementMessages, setSettlementMessages] = useState<SettlementMessage[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidRemark, setMarkPaidRemark] = useState('');
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; pageSize?: number } = { pageSize: 50 };
      if (activeTab !== 'all' && activeTab !== 'pending_verify') {
        params.status = activeTab;
      }
      const resp = await admin.orders(params);
      if (resp.success) {
        let items: Order[] = resp.data.items;
        if (activeTab === 'pending_verify') {
          items = items.filter((o: Order) => o.paymentStatus === 'pending_verify');
        }
        const dateFilter = searchParams.get('date');
        if (dateFilter === 'today') {
          const today = new Date().toISOString().split('T')[0];
          items = items.filter((o: Order) => o.createdAt.startsWith(today));
        }
        setOrderList(items);
      } else {
        toast.error(resp.message || '加载订单列表失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleForceComplete = async () => {
    if (!actionOrderId || submitting) return;
    setSubmitting(true);
    try {
      const resp = await ordersApi.forceComplete(actionOrderId);
      if (resp.success) {
        toast.success('订单已强制完成');
        await loadOrders();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
      setActionOrderId(null);
      setActionType(null);
    }
  };

  const handleCancel = async () => {
    if (!actionOrderId || submitting) return;
    setSubmitting(true);
    try {
      const resp = await ordersApi.cancel(actionOrderId);
      if (resp.success) {
        toast.success('订单已取消');
        await loadOrders();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
      setActionOrderId(null);
      setActionType(null);
    }
  };

  const handleVerifyConfirm = async (orderId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const resp = await admin.verifyPayment(orderId, true);
      if (resp.success) {
        toast.success('已确认到账');
        await loadOrders();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const getOrderSettlementSessionId = (order: Order): string | undefined => {
    // TODO: 后端订单详情需返回 settlementSessionId，当前通过类型断言兼容
    return (order as Order & { settlementSessionId?: string }).settlementSessionId;
  };

  const loadSettlement = useCallback(async (sessionId: string) => {
    setSettlementLoading(true);
    try {
      const [sessionResp, messagesResp] = await Promise.all([
        admin.getSettlementSession(sessionId),
        admin.getSettlementMessages(sessionId),
      ]);
      if (sessionResp.success) {
        setSettlementSession(sessionResp.data);
      }
      if (messagesResp.success) {
        setSettlementMessages(messagesResp.data);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载结算会话失败'));
    } finally {
      setSettlementLoading(false);
    }
  }, []);

  // 展开订单时加载结算会话
  useEffect(() => {
    if (!expandedId) {
      setSettlementSession(null);
      setSettlementMessages([]);
      return;
    }
    const order = orderList.find((o: Order) => o.id === expandedId);
    const sessionId = order ? getOrderSettlementSessionId(order) : undefined;
    if (order && sessionId && (order.status === 'delivered' || order.status === 'completed')) {
      void loadSettlement(sessionId);
    } else {
      setSettlementSession(null);
      setSettlementMessages([]);
    }
  }, [expandedId, orderList, loadSettlement]);

  const handleMarkPaid = async () => {
    if (!settlementSession || markPaidSubmitting) return;
    setMarkPaidSubmitting(true);
    try {
      const resp = await admin.markSettlementPaid(
        settlementSession.id,
        settlementSession.runnerAmountFen,
        markPaidRemark.trim() || undefined,
      );
      if (resp.success) {
        toast.success('已标记打款');
        setMarkPaidOpen(false);
        setMarkPaidRemark('');
        // 刷新会话和消息
        await loadSettlement(settlementSession.id);
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setMarkPaidSubmitting(false);
    }
  };

  const handleVerifyReject = async () => {
    if (!actionOrderId || submitting) return;
    setSubmitting(true);
    try {
      const resp = await admin.verifyPayment(actionOrderId, false, rejectRemark.trim() || undefined);
      if (resp.success) {
        toast.success('已标记未收到款，通知买家');
        setRejectRemark('');
        await loadOrders();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
      setActionOrderId(null);
      setActionType(null);
    }
  };

  const renderPaymentStatus = (paymentStatus: PaymentStatus): React.ReactNode => {
    if (paymentStatus === 'paid') return null;
    if (paymentStatus === 'pending_verify') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          待核对
        </span>
      );
    }
    return <span className="text-[11px] text-muted-foreground">待支付</span>;
  };

  const getPackageSizeSummary = (order: Order): string => {
    const sizes = order.packages.map((p) => PACKAGE_SIZE_LABELS[p.size]);
    return sizes.join('');
  };

  const canForceComplete = (status: OrderStatus): boolean => {
    return status === 'delivered';
  };

  const canCancel = (status: OrderStatus): boolean => {
    return status === 'pending' || status === 'in_progress';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 bg-muted p-1 rounded-lg min-w-max">
            {tabKeys.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  const next = new URLSearchParams(searchParams);
                  if (key === 'all') {
                    next.delete('status');
                  } else {
                    next.set('status', key);
                  }
                  next.delete('date');
                  setSearchParams(next, { replace: true });
                }}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                  activeTab === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {tabLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : orderList.length === 0 ? (
          <EmptyState
            icon="package"
            title="暂无订单"
            description="当前筛选条件下没有订单"
          />
        ) : (
          <div className="space-y-3">
            {orderList.map((order) => {
              const isExpanded = expandedId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-card rounded-xl border border-border shadow-sm overflow-hidden rise"
                >
                  {/* 卡片主体 */}
                  <div
                    className="p-4 cursor-pointer card-hover"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : order.id)
                    }
                    role="button"
                    aria-label={`${isExpanded ? '收起' : '展开'}订单 ${order.orderNo} 详情`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {order.dormitory}
                        </span>
                        <StatusBadge status={order.status} size="sm" />
                        {renderPaymentStatus(order.paymentStatus)}
                      </div>
                      <span className="text-base font-bold text-primary tnum">
                        {formatMoney(order.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">
                        {order.packageCount}件 {getPackageSizeSummary(order)}
                      </span>
                      {order.isRainy && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          雨天
                        </span>
                      )}
                      {order.isUrgent && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                          急送
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>买家：{order.buyerName}</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>

                    <div className="flex items-center justify-center pt-2 mt-2 border-t border-border/50">
                      {isExpanded ? (
                        <ChevronUp
                          className="w-4 h-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      ) : (
                        <ChevronDown
                          className="w-4 h-4 text-muted-foreground"
                          strokeWidth={2}
                        />
                      )}
                    </div>
                  </div>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-border/30 bg-muted/30">
                      <div className="pt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground shrink-0">订单号</span>
                          <span className="font-mono text-xs truncate">
                            {order.orderNo}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground shrink-0">买家手机</span>
                          <span className="truncate tnum">{order.buyerPhone}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground shrink-0">联系手机</span>
                          <span className="truncate tnum">{order.contactPhone}</span>
                        </div>
                        {order.runnerName && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground shrink-0">跑腿员</span>
                            <span className="text-right truncate">
                              <span>{order.runnerName}</span>{' '}
                              {order.runnerPhone && (
                                <span className="text-muted-foreground tnum">
                                  ({order.runnerPhone})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">基础费</span>
                          <span className="tnum">
                            {formatMoney(order.baseFee)}
                          </span>
                        </div>
                        {order.isRainy && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">雨天加价</span>
                            <span className="tnum">
                              {formatMoney(order.rainyFee)}
                            </span>
                          </div>
                        )}
                        {order.isUrgent && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">急送加价</span>
                            <span className="tnum">
                              {formatMoney(order.urgentFee)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">平台抽成</span>
                          <span className="tnum">
                            {formatMoney(order.platformFee)}
                          </span>
                        </div>
                        {order.remark && (
                          <div className="pt-1 break-words">
                            <span className="text-muted-foreground">
                              备注：
                            </span>
                            <span className="text-foreground">
                              {order.remark}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 结算会话区块 */}
                      {isExpanded &&
                        (order.status === 'delivered' || order.status === 'completed') &&
                        getOrderSettlementSessionId(order) && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  跑腿员结算会话
                                </span>
                                {getOrderSettlementSessionId(order) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const sid = getOrderSettlementSessionId(order);
                                      if (sid) navigate(`/admin/settlements/${sid}`);
                                    }}
                                  >
                                    <MessageSquare className="w-3 h-3" strokeWidth={2} />
                                    与跑腿员会话
                                  </Button>
                                )}
                              </div>
                              {settlementSession && (
                                <span
                                  className={clsx(
                                    'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                                    settlementSession.status === 'paid'
                                      ? 'bg-[hsl(228_84%_32%_/_0.08)] text-status-completed'
                                      : settlementSession.status === 'pending_settle'
                                        ? 'bg-[hsl(35_92%_50%_/_0.1)] text-warning'
                                        : settlementSession.status === 'refunded'
                                          ? 'bg-[hsl(216_15%_35%_/_0.08)] text-status-refunded'
                                          : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {SETTLEMENT_SESSION_STATUS_LABELS[settlementSession.status]}
                                </span>
                              )}
                            </div>

                            {settlementLoading ? (
                              <div className="space-y-2 py-2">
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <Skeleton className="h-12 w-3/4 rounded-lg" />
                              </div>
                            ) : settlementSession ? (
                              <>
                                <div className="flex items-center justify-between mb-2 px-1">
                                  <span className="text-xs text-muted-foreground">
                                    跑腿费
                                  </span>
                                  <span className="text-sm font-bold text-primary tnum">
                                    {formatMoney(settlementSession.runnerAmountFen / 100)}
                                  </span>
                                </div>

                                {/* 消息列表 */}
                                <div className="space-y-2 max-h-64 overflow-y-auto bg-muted/40 rounded-lg p-2">
                                  {settlementMessages.length === 0 ? (
                                    <div className="text-center text-xs text-muted-foreground py-4">
                                      暂无消息
                                    </div>
                                  ) : (
                                    settlementMessages.map((msg: SettlementMessage) => {
                                      if (msg.senderRole === 'system') {
                                        return (
                                          <div key={msg.id} className="flex justify-center">
                                            <span className="text-[11px] text-muted-foreground">
                                              {msg.content}
                                            </span>
                                          </div>
                                        );
                                      }
                                      const isRunner = msg.senderRole === 'runner';
                                      return (
                                        <div
                                          key={msg.id}
                                          className={clsx(
                                            'flex flex-col gap-0.5 max-w-[75%]',
                                            isRunner ? 'items-start' : 'items-end ml-auto',
                                          )}
                                        >
                                          {msg.msgType === 'image' && msg.imageUrl ? (
                                            <button
                                              onClick={() => setPreviewImageUrl(msg.imageUrl)}
                                              className="text-left rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                              aria-label="查看图片"
                                            >
                                              <Image
                                                src={msg.imageUrl}
                                                alt="结算图片"
                                                width={120}
                                                height={120}
                                                className="rounded-lg object-cover"
                                              />
                                            </button>
                                          ) : (
                                            <div
                                              className={clsx(
                                                'px-2 py-1 text-xs rounded-lg break-words',
                                                isRunner
                                                  ? 'bg-card border border-border text-foreground rounded-tl-none'
                                                  : 'bg-primary text-primary-foreground rounded-tr-none',
                                              )}
                                            >
                                              {msg.content}
                                            </div>
                                          )}
                                          <span className="text-[10px] text-muted-foreground px-1">
                                            {formatDate(msg.createdAt)}
                                          </span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* 标记打款按钮 */}
                                {settlementSession.status === 'pending_settle' && (
                                  <Button
                                    className="w-full mt-2 h-9 text-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMarkPaidRemark('');
                                      setMarkPaidOpen(true);
                                    }}
                                  >
                                    标记已打款给跑腿员
                                  </Button>
                                )}
                              </>
                            ) : (
                              <div className="text-center text-xs text-muted-foreground py-4">
                                暂无结算会话
                              </div>
                            )}
                          </div>
                        )}

                      {/* 操作按钮 */}
                      {(canForceComplete(order.status) ||
                        canCancel(order.status) ||
                        order.paymentStatus === 'pending_verify') && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
                          {order.paymentStatus === 'pending_verify' && (
                            <>
                              <Button
                                className="flex-1 h-11 text-sm min-w-[100px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleVerifyConfirm(order.id);
                                }}
                                disabled={submitting}
                              >
                                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                                确认到账
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 h-11 text-sm min-w-[100px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionOrderId(order.id);
                                  setActionType('verifyReject');
                                  setRejectRemark('');
                                }}
                              >
                                <X className="w-3.5 h-3.5" strokeWidth={2} />
                                未收到款
                              </Button>
                            </>
                          )}
                          {canForceComplete(order.status) && (
                            <Button
                              variant="outline"
                              className="flex-1 h-11 text-sm min-w-[100px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionOrderId(order.id);
                                setActionType('forceComplete');
                              }}
                            >
                              <Check className="w-3.5 h-3.5" strokeWidth={2} />
                              强制完成
                            </Button>
                          )}
                          {canCancel(order.status) && (
                            <Button
                              variant="destructive"
                              className="flex-1 h-11 text-sm min-w-[100px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionOrderId(order.id);
                                setActionType('cancel');
                              }}
                            >
                              取消订单
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 标记打款确认弹窗 */}
      <AlertDialog
        open={markPaidOpen}
        onOpenChange={(open) => {
          if (!open && !markPaidSubmitting) {
            setMarkPaidOpen(false);
            setMarkPaidRemark('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>确认标记已打款？</AlertDialogTitle>
          <AlertDialogDescription>
            标记后将向跑腿员发送系统通知，此操作不可撤销。
          </AlertDialogDescription>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">打款金额</span>
              <span className="text-lg font-bold text-primary tnum">
                {settlementSession ? formatMoney(settlementSession.runnerAmountFen / 100) : '¥0.00'}
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">备注说明</label>
              <Input
                value={markPaidRemark}
                onChange={(e) => setMarkPaidRemark(e.target.value)}
                placeholder="选填，如转账流水号等"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markPaidSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleMarkPaid();
              }}
            >
              {markPaidSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认打款'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片预览弹窗 */}
      <Dialog open={previewImageUrl !== null} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="max-w-sm p-2" showCloseButton={false}>
          <DialogClose className="absolute top-3 right-3 z-10 p-1 rounded-full bg-black/40 text-white hover:bg-black/60" aria-label="关闭">
            <XIcon className="w-4 h-4" />
          </DialogClose>
          {previewImageUrl && (
            <Image
              src={previewImageUrl}
              alt="图片预览"
              width={360}
              height={360}
              className="w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 确认弹窗 */}
      <AlertDialog
        open={actionOrderId !== null && actionType !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setActionOrderId(null);
            setActionType(null);
            setRejectRemark('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {actionType === 'forceComplete'
              ? '确认强制完成？'
              : actionType === 'cancel'
                ? '确认取消订单？'
                : '确认标记未收到款？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionType === 'forceComplete'
              ? '强制完成后订单状态将变为已完成，金额会正常结算。此操作不可撤销。'
              : actionType === 'cancel'
                ? '取消订单后订单将被关闭，相关金额会退回。此操作不可撤销。'
                : '标记未收到款后，买家会收到通知并可重新支付。请填写备注说明原因（可选）。'}
          </AlertDialogDescription>
          {actionType === 'verifyReject' && (
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-foreground">备注说明</label>
              <input
                value={rejectRemark}
                onChange={(e) => setRejectRemark(e.target.value)}
                placeholder="选填，如未查到转账记录等"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (actionType === 'forceComplete') {
                  void handleForceComplete();
                } else if (actionType === 'cancel') {
                  void handleCancel();
                } else if (actionType === 'verifyReject') {
                  void handleVerifyReject();
                }
              }}
              className={
                actionType === 'cancel' || actionType === 'verifyReject'
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : undefined
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOrdersPage;

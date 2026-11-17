import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import {
  MapPin,
  Phone,
  Clock,
  Package,
  ChevronDown,
  MessageCircle,
  MessageSquare,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  X,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { orders, refundSession } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { Skeleton } from '@client/src/components/Skeleton';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { formatDate, formatMoney } from '@client/src/utils/format';
import ChatSection from './ChatSection';
import type { Order, OrderStatus } from '@shared/api.interface';
import {
  PACKAGE_SIZE_LABELS,
} from '@shared/api.interface';
import { showConfirm } from '@client/src/lib/shims';
import { Image } from '@client/src/components/ui/image';

const statusConfig: Record<
  OrderStatus,
  { title: string; desc: string; iconColor: string }
> = {
  pending: {
    title: '等待接单',
    desc: '正在等待跑腿同学接单',
    iconColor: 'text-status-pending',
  },
  in_progress: {
    title: '进行中',
    desc: '跑腿同学正在取件路上',
    iconColor: 'text-status-in-progress',
  },
  delivered: {
    title: '已送达',
    desc: '快递已送到，请确认收货',
    iconColor: 'text-status-delivered',
  },
  completed: {
    title: '已完成',
    desc: '订单已完成，感谢使用顺手捎',
    iconColor: 'text-status-completed',
  },
  refunding: {
    title: '退款中',
    desc: '退款审核中，请耐心等待',
    iconColor: 'text-status-refunding',
  },
  refunded: {
    title: '已退款',
    desc: '退款已完成',
    iconColor: 'text-status-refunded',
  },
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex items-start gap-3 py-2">
    <div className="flex-shrink-0 w-5 h-5 text-muted-foreground mt-0.5">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-card rounded-xl border border-border overflow-hidden rise">
    <div className="px-4 py-3 border-b border-border/60">
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    <div className="px-4">{children}</div>
  </div>
);

const OrderDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [hasDeliveryPhoto, setHasDeliveryPhoto] = useState<boolean>(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState<boolean>(false);
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundSubmitting, setRefundSubmitting] = useState<boolean>(false);
  const [refundScreenshotUrl, setRefundScreenshotUrl] = useState<string>('');
  const [refundUploading, setRefundUploading] = useState<boolean>(false);
  const refundFileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await orders.detail(id);
      if (res.success) {
        setOrder(res.data);
      } else {
        toast.error(res.message || '获取订单详情失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '获取订单详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleConfirm = async () => {
    if (!order || !user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await orders.confirm(order.id, user.id);
      if (res.success) {
        toast.success('确认收货成功');
        setOrder(res.data);
      } else {
        toast.error(res.message || '确认收货失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '确认收货失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async () => {
    if (!order || !user || actionLoading) return;
    if (!hasDeliveryPhoto) {
      toast.error('请先拍照发给买家');
      return;
    }
    setActionLoading(true);
    try {
      const res = await orders.deliver(order.id, user.id);
      if (res.success) {
        toast.success('已标记为送达');
        setOrder(res.data.order);
        if (res.data.settlementSessionId) {
          navigate(`/settlement/${res.data.settlementSessionId}`);
        }
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!order || !user || actionLoading) return;
    if (!user.isRunner) {
      toast.error('兼职申请通过后才能接单');
      return;
    }
    setActionLoading(true);
    try {
      const res = await orders.accept(order.id, user.id);
      if (res.success) {
        toast.success('接单成功，快去取件吧');
        setOrder(res.data);
      } else {
        toast.error(res.message || '接单失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '接单失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!order || !user || refundSubmitting) return;
    if (!refundReason.trim()) {
      toast.error('请填写退款理由');
      return;
    }
    setRefundSubmitting(true);
    try {
      const res = await orders.refund(order.id, user.id, refundReason.trim(), refundScreenshotUrl || undefined);
      if (res.success) {
        toast.success('退款申请已提交');
        setOrder(res.data.order);
        setRefundDialogOpen(false);
        setRefundReason('');
        setRefundScreenshotUrl('');
        // 跳转到退款会话页
        if (res.data.sessionId) {
          navigate(`/refund-session/${res.data.sessionId}`);
        }
      } else {
        toast.error(res.message || '申请失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '申请失败');
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleRefundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefundUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      setRefundScreenshotUrl(data.download_url || '');
      toast.success('图片上传成功');
    } catch (err) {
      const e2 = err as { message?: string; response?: { data?: { error?: { message?: string } } } };
      toast.error(e2.response?.data?.error?.message || e2.message || '上传失败');
    } finally {
      setRefundUploading(false);
    }
    e.target.value = '';
  };

  const handleViewRefundSession = async () => {
    if (!order) return;
    try {
      const res = await orders.getRefundSessionByOrder(order.id);
      if (res.success && res.data) {
        navigate(`/refund-session/${res.data.id}`);
      } else {
        toast.error('未找到退款会话');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '查询失败');
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <Skeleton className="h-7 w-24 mx-auto mb-2" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">订单不存在或已被删除</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            返回订单列表
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status];
  const isBuyer = user?.id === order.buyerId;
  const isRunner = user?.id === order.runnerId;
  const isUnpaid = order.paymentStatus === 'unpaid';

  const handlePayNow = () => {
    navigate(`/buyer/payment/${order.id}`);
  };

  const handleCancelOrder = async () => {
    if (!order || !user || actionLoading) return;
    if (!await showConfirm('确定要取消该订单吗？')) return;
    setActionLoading(true);
    try {
      const res = await orders.cancel(order.id);
      if (res.success) {
        toast.success('订单已取消');
        navigate('/orders');
      } else {
        toast.error(res.message || '取消失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '取消失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 底部操作栏是否显示
  const showBottomBar =
    (isBuyer && isUnpaid) ||
    (isBuyer && order.status === 'delivered') ||
    (isRunner && order.status === 'in_progress') ||
    (user?.isRunner && order.status === 'pending' && !isRunner) ||
    (order.status === 'refunding') ||
    (order.status === 'refunded') ||
    (isBuyer &&
      !isUnpaid &&
      !['refunding', 'refunded', 'completed'].includes(order.status));

  // 渲染费用明细行
  const feeRows: { label: string; value: string; show: boolean }[] = [
    { label: '基础跑腿费', value: formatMoney(order.baseFee), show: true },
    {
      label: `超件加价（${Math.max(0, order.packageCount - 2)} 件）`,
      value: formatMoney(order.extraFee),
      show: parseFloat(order.extraFee) > 0,
    },
    { label: '下雨天加价', value: formatMoney(order.rainyFee), show: order.isRainy },
    { label: '急送加价', value: formatMoney(order.urgentFee), show: order.isUrgent },
  ];

  return (
    <div className={clsx('pb-6', showBottomBar ? 'pb-28' : '')}>
      {/* 状态区 */}
      <div className="bg-card border-b border-border px-4 py-6 text-center rise">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CheckCircle2 className={clsx('w-6 h-6', status.iconColor)} strokeWidth={2} />
          <h2 className="text-xl font-bold text-foreground">{status.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{status.desc}</p>
        {order.status === 'delivered' && order.autoSettleAt && (
          <p className="text-xs text-status-refunding mt-2">
            24 小时未确认将自动结算 · 预计 {formatDate(order.autoSettleAt)} 自动确认
          </p>
        )}
        {isUnpaid && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            待支付 · 请在 30 分钟内完成支付
          </div>
        )}
        {order.paymentStatus === 'paid' && (
          <p className="text-xs text-muted-foreground mt-2">
            已收款 · {order.payChannel === 'wechat_qr' ? '微信收款码' : order.payChannel === 'alipay_qr' ? '支付宝收款码' : '-'}
            {order.paidAt && ` · 到账时间 ${formatDate(order.paidAt)}`}
          </p>
        )}
        {order.paymentStatus === 'pending_verify' && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
            买家已付款，待平台核对
          </div>
        )}
        {order.paymentStatus === 'refunded' && (
          <p className="text-xs text-status-refunded mt-2">
            该订单已退款
          </p>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* 订单信息 */}
        <SectionCard title="订单信息">
          <div className="py-2">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">订单号</p>
                <p className="text-sm font-medium text-foreground mt-0.5 tnum">
                  {order.orderNo}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-border/60">
            <InfoRow
              icon={<MapPin className="w-5 h-5" strokeWidth={2} />}
              label="送达宿舍"
              value={order.dormitory}
            />
          </div>
          <div className="border-t border-border/60">
            <InfoRow
              icon={<Phone className="w-5 h-5" strokeWidth={2} />}
              label="联系电话"
              value={order.contactPhone}
            />
          </div>

          {/* 包裹清单 */}
          <div className="border-t border-border/60 py-3">
            <p className="text-xs text-muted-foreground mb-2">包裹清单</p>
            <div className="space-y-2">
              {order.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate tnum">
                      {pkg.trackingNo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 tnum">
                      取件手机号：{pkg.pickupPhone}
                    </p>
                  </div>
                  <span className="flex-shrink-0 ml-2 px-2 py-0.5 text-[11px] rounded-md bg-secondary text-secondary-foreground">
                    {PACKAGE_SIZE_LABELS[pkg.size]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 加价项 */}
          {(order.isRainy || order.isUrgent) && (
            <div className="border-t border-border/60 py-3">
              <p className="text-xs text-muted-foreground mb-2">加价项</p>
              <div className="flex gap-2 flex-wrap">
                {order.isRainy && (
                  <span className="px-2 py-1 text-xs rounded-md bg-status-delivered/10 text-status-delivered">
                    下雨天 +¥{order.rainyFee}
                  </span>
                )}
                {order.isUrgent && (
                  <span className="px-2 py-1 text-xs rounded-md bg-status-refunding/10 text-status-refunding">
                    急送 +¥{order.urgentFee}
                  </span>
                )}
              </div>
            </div>
          )}

          {order.remark && (
            <div className="border-t border-border/60 py-3">
              <p className="text-xs text-muted-foreground mb-1">备注</p>
              <p className="text-sm text-foreground">{order.remark}</p>
            </div>
          )}

          <div className="border-t border-border/60">
            <InfoRow
              icon={<Clock className="w-5 h-5" strokeWidth={2} />}
              label="下单时间"
              value={formatDate(order.createdAt)}
            />
          </div>
        </SectionCard>

        {/* 费用明细 */}
        <SectionCard title="费用明细">
          <div className="py-2 space-y-2">
            {feeRows.map(
              (row) =>
                row.show && (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-1"
                  >
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm text-foreground tnum">{row.value}</span>
                  </div>
                ),
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border/60 mt-2">
              <span className="text-sm font-medium text-foreground">合计</span>
              <span className="text-lg font-bold text-primary tnum">
                {formatMoney(order.totalAmount)}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* 对方信息 */}
        <SectionCard title="对方信息">
          {isRunner ? (
            <div className="py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-primary" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    买家：{order.buyerName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    宿舍：{order.dormitory}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-status-in-progress/10 flex items-center justify-center">
                  <UserIcon
                    className="w-5 h-5 text-status-in-progress"
                    strokeWidth={2}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    跑腿员：{order.runnerName || '暂未接单'}
                  </p>
                  {order.runnerPhone && (
                    <p className="text-xs text-muted-foreground mt-0.5 tnum">
                      电话：{order.runnerPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="border-t border-border/60 pt-3 pb-2">
            <button
              type="button"
              onClick={scrollToChat}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium btn-press"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={2} />
              联系TA
              <ChevronDown className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </SectionCard>

        {/* 聊天区 */}
        <div ref={chatRef}>
          <ChatSection
            orderId={order.id}
            orderStatus={order.status}
            onHasDeliveryPhoto={setHasDeliveryPhoto}
          />
        </div>

        {/* 退款进度区块 */}
        {(order.status === 'refunding' || order.status === 'refunded') && (
          <div className="bg-card rounded-xl border border-border overflow-hidden rise">
            <div className="px-4 py-3 border-b border-border/60">
              <p className="text-sm font-semibold text-foreground">退款进度</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-status-refunding" strokeWidth={2} />
                <span className="text-sm font-medium text-foreground">
                  {order.status === 'refunding' ? '退款审核中' : '已退款'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                退款理由：订单相关退款申请
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => void handleViewRefundSession()}
              >
                查看退款会话
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      {showBottomBar && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-20 safe-bottom">
          <div className="p-3 space-y-2">
            {/* 退款链接（买家非退款状态） */}
            {isBuyer &&
              !['refunding', 'refunded', 'completed'].includes(order.status) && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setRefundDialogOpen(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    申请退款
                  </button>
                </div>
              )}

            {/* 买家：待支付时显示支付和取消 */}
            {isBuyer && isUnpaid && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11 text-base"
                  size="lg"
                  onClick={() => void handleCancelOrder()}
                  disabled={actionLoading}
                >
                  取消订单
                </Button>
                <Button
                  className="flex-1 h-11 text-base"
                  size="lg"
                  onClick={handlePayNow}
                  disabled={actionLoading}
                >
                  去付款
                </Button>
              </div>
            )}

            {/* 买家：确认收货 */}
            {isBuyer && order.status === 'delivered' && !isUnpaid && (
              <Button
                className="w-full h-11 text-base"
                size="lg"
                onClick={() => void handleConfirm()}
                disabled={actionLoading}
              >
                {actionLoading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                确认收货
              </Button>
            )}

            {/* 跑腿员：接单按钮（待接单状态） */}
            {user?.isRunner && order.status === 'pending' && !isRunner && (
              <>
                <Button
                  className="w-full h-12 text-base bg-primary rounded-[10px]"
                  size="lg"
                  onClick={() => void handleAccept()}
                  disabled={actionLoading}
                >
                  {actionLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  接单
                </Button>
              </>
            )}

            {/* 非跑腿员/未审核：置灰接单提示 */}
            {user && !user.isRunner && order.status === 'pending' && (
              <>
                <Button
                  className="w-full h-12 text-base rounded-[10px]"
                  size="lg"
                  disabled
                  variant="secondary"
                >
                  接单
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  兼职申请通过后才能接单
                </p>
              </>
            )}

            {/* 跑腿员：已送达按钮 */}
            {isRunner && order.status === 'in_progress' && (
              <>
                <Button
                  className="w-full h-11 text-base"
                  size="lg"
                  onClick={() => void handleDeliver()}
                  disabled={!hasDeliveryPhoto || actionLoading}
                  variant={hasDeliveryPhoto ? 'default' : 'secondary'}
                >
                  {actionLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  已送达
                </Button>
                {!hasDeliveryPhoto && (
                  <p className="text-[11px] text-center text-status-refunding">
                    请先在聊天区点击绿色相机按钮上传送达照片
                  </p>
                )}
              </>
            )}

            {/* 跑腿员：已送达/已完成时显示结算会话入口 */}
            {isRunner &&
              ['delivered', 'completed'].includes(order.status) &&
              order.settlementSessionId && (
                <Button
                  variant="outline"
                  className="w-full h-11 text-base"
                  size="lg"
                  onClick={() => navigate(`/settlement/${order.settlementSessionId}`)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" strokeWidth={2} />
                  查看结算会话
                </Button>
              )}

            {/* 退款中/已退款状态展示 */}
            {(order.status === 'refunding' || order.status === 'refunded') && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-2">
                  <StatusBadge status={order.status} size="md" />
                  <span className="text-xs text-muted-foreground">
                    {order.status === 'refunding' ? '退款审核中' : '已退款'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9"
                  onClick={() => void handleViewRefundSession()}
                >
                  查看退款会话
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 退款申请弹窗 */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>申请退款</DialogTitle>
            <DialogDescription>请填写退款理由，我们会尽快审核</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="请说明退款原因"
                className="min-h-[100px] resize-none"
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">
                {refundReason.length}/200
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">上传截图（可选）</p>
              {refundScreenshotUrl ? (
                <div className="relative inline-block">
                  <Image
                    src={refundScreenshotUrl}
                    alt="退款截图"
                    className="w-24 h-24 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setRefundScreenshotUrl('')}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                    aria-label="删除截图"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => refundFileRef.current?.click()}
                  disabled={refundUploading}
                  className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors btn-press"
                >
                  {refundUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5" strokeWidth={2} />
                      <span className="text-[11px]">上传截图</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={refundFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleRefundUpload(e)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={refundSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleRefundSubmit()}
              disabled={!refundReason.trim() || refundSubmitting || refundUploading}
            >
              {refundSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              提交退款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetailPage;

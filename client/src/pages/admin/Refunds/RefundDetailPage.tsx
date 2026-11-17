import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  Package,
  User,
  Phone,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { useAdmin } from '@client/src/store/userStore';
import type {
  RefundRequest,
  Order,
  ChatMessage,
  RefundStatus,
} from '@shared/api.interface';
import {
  REFUND_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PACKAGE_SIZE_LABELS,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const RefundDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { admin: adminUser } = useAdmin();
  const [refund, setRefund] = useState<RefundRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [buyerPayChannel, setBuyerPayChannel] = useState('wechat');
  const [buyerPayAccount, setBuyerPayAccount] = useState('');
  const [buyerRealName, setBuyerRealName] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const resp = await admin.refundDetail(id);
      if (resp.success) {
        setRefund(resp.data.refund);
        setOrder(resp.data.order);
        setMessages(resp.data.messages);
      } else {
        toast.error(resp.message || '加载详情失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleApprove = async () => {
    if (!id || !adminUser || actionLoading) return;
    setActionLoading('approve');
    try {
      const resp = await admin.approveRefund(id, adminUser.name);
      if (resp.success) {
        toast.success('退款已通过');
        setRefund(resp.data);
        setShowApproveDialog(false);
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!id || !adminUser || !rejectReason.trim() || actionLoading) return;
    setActionLoading('reject');
    try {
      const resp = await admin.rejectRefund(id, adminUser.name, rejectReason.trim());
      if (resp.success) {
        toast.success('已拒绝退款');
        setRefund(resp.data);
        setShowRejectDialog(false);
        setRejectReason('');
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColorClass = (status: RefundStatus): string => {
    switch (status) {
      case 'pending':
        return 'text-status-refunding';
      case 'approved':
        return 'text-status-completed';
      case 'rejected':
        return 'text-status-refunded';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  if (!refund || !order) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        退款记录不存在
      </div>
    );
  }

  const isPending = refund.status === 'pending';

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* 退款基本信息 */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          退款申请信息
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">申请人</span>
            <span className="text-foreground">
              {refund.buyerName} ({refund.buyerPhone})
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">退款金额</span>
            <span className={`font-bold tnum ${getStatusColorClass(refund.status)}`}>
              {formatMoney(refund.orderAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">申请状态</span>
            <StatusBadge status={refund.status} size="sm" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">申请时间</span>
            <span className="text-foreground">
              {formatDate(refund.createdAt)}
            </span>
          </div>
          {refund.rejectReason && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">拒绝原因</p>
              <p className="text-sm text-status-refunded">
                {refund.rejectReason}
              </p>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">退款理由</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {refund.reason}
          </p>
        </div>
      </div>

      {/* 订单信息 */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise" style={{ animationDelay: '0.05s' }}>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          订单信息
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">订单号</span>
            <span className="text-foreground font-mono text-xs">
              {order.orderNo}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">包裹数</span>
            <span className="text-foreground">{order.packageCount} 件</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">规格</span>
            <span className="text-foreground">
              {order.packages.map((p) => PACKAGE_SIZE_LABELS[p.size]).join('、')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">加价项</span>
            <span className="text-foreground">
              {order.isRainy && order.isUrgent
                ? '下雨天 + 急送'
                : order.isRainy
                  ? '下雨天'
                  : order.isUrgent
                    ? '急送'
                    : '无'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">订单金额</span>
            <span className="text-primary font-bold tnum">
              {formatMoney(order.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">订单状态</span>
            <StatusBadge status={order.status} size="sm" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">下单时间</span>
            <span className="text-foreground">
              {formatDate(order.createdAt)}
            </span>
          </div>
        </div>

        {/* 买家信息 */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
            <span className="text-xs font-medium text-muted-foreground">
              买家信息
            </span>
          </div>
          <div className="space-y-1 pl-6">
            <p className="text-sm text-foreground">姓名：{order.buyerName}</p>
            <p className="text-sm text-foreground flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
              {order.buyerPhone}
            </p>
            <p className="text-sm text-foreground flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
              {order.dormitory}
            </p>
          </div>
        </div>

        {/* 跑腿员信息 */}
        {order.runnerName && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
              <span className="text-xs font-medium text-muted-foreground">
                跑腿员信息
              </span>
            </div>
            <div className="space-y-1 pl-6">
              <p className="text-sm text-foreground">
                姓名：{order.runnerName}
              </p>
              {order.runnerPhone && (
                <p className="text-sm text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
                  {order.runnerPhone}
                </p>
              )}
              {refund.runnerWechat && (
                <p className="text-sm text-foreground">
                  微信：{refund.runnerWechat}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 聊天记录与送达照片 */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise" style={{ animationDelay: '0.1s' }}>
        <button
          onClick={() => setShowChat(!showChat)}
          className="w-full flex items-center justify-between"
          aria-label={showChat ? '收起聊天记录' : '展开聊天记录'}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
            <span className="text-sm font-semibold text-foreground">
              聊天记录与送达照片
            </span>
            <span className="text-xs text-muted-foreground">
              ({messages.length} 条)
            </span>
          </div>
          {showChat ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          )}
        </button>

        {showChat && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2 max-h-80 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无聊天记录
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={clsx(
                    'flex flex-col',
                    msg.senderRole === 'buyer' ? 'items-end' : 'items-start',
                  )}
                >
                  <p className="text-[11px] text-muted-foreground mb-1">
                    {msg.senderName} · {formatDate(msg.createdAt)}
                  </p>
                  {msg.msgType === 'text' ? (
                    <div
                      className={clsx(
                        'max-w-[70%] px-3 py-2 rounded-lg text-sm',
                        msg.senderRole === 'buyer'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                      )}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="relative">
                      <Image
                        src={msg.imageUrl}
                        alt="聊天图片"
                        className="max-w-[160px] max-h-[160px] rounded-lg object-cover"
                      />
                      {msg.isDeliveryPhoto && (
                        <span className="absolute -top-1 -right-1 bg-status-completed text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                          送达照
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      {isPending && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border p-4 safe-bottom z-20">
          <div className="flex gap-3">
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 h-11"
              onClick={() => setShowRejectDialog(true)}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'reject' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" strokeWidth={2} />
                  拒绝退款
                </>
              )}
            </Button>
            <Button
              size="lg"
              className="flex-1 h-11"
              onClick={() => setShowApproveDialog(true)}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'approve' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" strokeWidth={2} />
                  通过退款
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 通过退款对话框 */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认通过退款？</DialogTitle>
            <DialogDescription>
              请先在线下将{' '}
              <span className="font-semibold text-status-refunding">
                {refund ? formatMoney(refund.orderAmount) : ''}
              </span>{' '}
              原路退回给买家，然后填写买家收款信息并确认。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                退款渠道
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={buyerPayChannel === 'wechat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBuyerPayChannel('wechat')}
                  className="flex-1"
                >
                  微信
                </Button>
                <Button
                  type="button"
                  variant={buyerPayChannel === 'alipay' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBuyerPayChannel('alipay')}
                  className="flex-1"
                >
                  支付宝
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                买家收款账号
              </label>
              <Input
                value={buyerPayAccount}
                onChange={(e) => setBuyerPayAccount(e.target.value)}
                placeholder="请输入买家微信号或支付宝账号"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                买家真实姓名（可选）
              </label>
              <Input
                value={buyerRealName}
                onChange={(e) => setBuyerRealName(e.target.value)}
                placeholder="请输入真实姓名"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={actionLoading === 'approve'}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleApprove()}
              disabled={actionLoading === 'approve'}
            >
              {actionLoading === 'approve' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '已线下退款，确认通过'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝退款对话框 */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝退款</DialogTitle>
            <DialogDescription>
              请填写拒绝原因，买家会收到通知
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              拒绝原因
            </label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因"
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={!rejectReason.trim() || actionLoading === 'reject'}
            >
              {actionLoading === 'reject' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '确认拒绝'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefundDetailPage;

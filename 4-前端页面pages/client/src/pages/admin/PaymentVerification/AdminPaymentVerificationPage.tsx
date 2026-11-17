import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import type { Order } from '@shared/api.interface';

type FilterKey = 'all' | 'pending' | 'verified' | 'rejected';

const FILTER_TABS: Array<{ key: FilterKey; label: string; paymentStatus?: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待核对', paymentStatus: 'pending_verify' },
  { key: 'verified', label: '已核对', paymentStatus: 'paid' },
  { key: 'rejected', label: '已退回', paymentStatus: 'unpaid' },
];

const AdminPaymentVerificationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter');
  const initialFilter = urlFilter && FILTER_TABS.some((t) => t.key === urlFilter)
    ? (urlFilter as FilterKey)
    : 'pending';
  const [activeFilter, setActiveFilter] = useState<FilterKey>(initialFilter);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 确认到账弹窗
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);

  // 未收到款弹窗
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await admin.orders({ pageSize: 200 });
      if (resp.success) {
        setAllOrders(resp.data.items);
      } else {
        toast.error(resp.message || '加载订单失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, []);

  const displayOrders = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === activeFilter);
    if (!tab?.paymentStatus) return allOrders;
    return allOrders.filter((o: Order) => o.paymentStatus === tab.paymentStatus);
  }, [allOrders, activeFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // 顶部统计（只算待核对）
  const stats = useMemo(() => {
    const pending = allOrders.filter((o: Order) => o.paymentStatus === 'pending_verify');
    const count = pending.length;
    const totalAmount = pending.reduce((sum: number, order: Order) => {
      return sum + parseFloat(order.totalAmount || '0');
    }, 0);
    return { count, totalAmount };
  }, [allOrders]);

  // 确认到账
  const handleVerifyConfirm = useCallback(async () => {
    if (!confirmOrderId || submitting) return;
    setSubmitting(true);
    try {
      const resp = await admin.verifyPayment(confirmOrderId, true);
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
      setConfirmOrderId(null);
    }
  }, [confirmOrderId, submitting, loadOrders]);

  // 未收到款
  const handleVerifyReject = useCallback(async () => {
    if (!rejectOrderId || submitting) return;
    setSubmitting(true);
    try {
      const remark = rejectRemark.trim() || undefined;
      const resp = await admin.verifyPayment(rejectOrderId, false, remark);
      if (resp.success) {
        toast.success('已退回待支付');
        setRejectRemark('');
        await loadOrders();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
      setRejectOrderId(null);
    }
  }, [rejectOrderId, rejectRemark, submitting, loadOrders]);

  return (
    <div className="flex flex-col min-h-full">
      {/* 顶部统计卡片 */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise">
            <p className="text-xs text-muted-foreground mb-1">待核对订单数</p>
            {loading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-2xl font-bold text-primary tnum">
                {stats.count}
              </p>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise">
            <p className="text-xs text-muted-foreground mb-1">待核对总金额</p>
            {loading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="text-xl font-bold text-primary tnum">
                {formatMoney(stats.totalAmount)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 筛选 tabs */}
      <div className="px-4 pt-2 pb-2">
        <div className="flex bg-muted/60 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveFilter(tab.key);
                const next = new URLSearchParams(searchParams);
                if (tab.key === 'pending') {
                  next.delete('filter');
                } else {
                  next.set('filter', tab.key);
                }
                setSearchParams(next, { replace: true });
              }}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                activeFilter === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 px-4 pt-2 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            {FILTER_TABS.find((t) => t.key === activeFilter)?.label}订单
          </h2>
          {!loading && displayOrders.length > 0 && (
            <span className="text-xs text-muted-foreground">
              共 {displayOrders.length} 笔
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-3 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-5 w-20" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : displayOrders.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="暂无订单"
            description="这里空空如也"
          />
        ) : (
          <div className="space-y-3">
            {displayOrders.map((order: Order) => (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border shadow-sm overflow-hidden rise"
              >
                <div className="py-3 px-4">
                  {/* 第一行：订单号 + 状态 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground truncate mr-2">
                      {order.orderNo}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-[hsl(224_76%_48%_/_0.08)] text-status-pending whitespace-nowrap shrink-0">
                      {order.paymentStatus === 'pending_verify'
                        ? '待核对'
                        : order.paymentStatus === 'paid'
                          ? '已核对'
                          : order.paymentStatus === 'unpaid'
                            ? '已退回'
                            : order.paymentStatus}
                    </span>
                  </div>

                  {/* 第二行：金额 */}
                  <div className="mb-2">
                    <span className="text-lg font-bold text-primary tnum">
                      {formatMoney(order.totalAmount)}
                    </span>
                  </div>

                  {/* 第三行：下单人 + 时间 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>下单人：{order.buyerName}</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>

                  {/* 操作按钮（仅待核对时显示） */}
                  {order.paymentStatus === 'pending_verify' && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 h-10 text-sm"
                        onClick={() => setConfirmOrderId(order.id)}
                        disabled={submitting}
                      >
                        <Check className="w-4 h-4 mr-1" strokeWidth={2} />
                        确认到账
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 text-sm"
                        onClick={() => {
                          setRejectOrderId(order.id);
                          setRejectRemark('');
                        }}
                        disabled={submitting}
                      >
                        <X className="w-4 h-4 mr-1" strokeWidth={2} />
                        未收到款
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 确认到账弹窗 */}
      <AlertDialog
        open={confirmOrderId !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setConfirmOrderId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>确认到账？</AlertDialogTitle>
          <AlertDialogDescription>
            确认该订单款项已收到，订单支付状态将更新为已支付。此操作不可撤销。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleVerifyConfirm();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  处理中...
                </>
              ) : (
                '确认到账'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 未收到款弹窗 */}
      <AlertDialog
        open={rejectOrderId !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setRejectOrderId(null);
            setRejectRemark('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>确认未收到款？</AlertDialogTitle>
          <AlertDialogDescription>
            标记未收到款后，订单将退回待支付状态，买家会收到通知并可重新支付。
          </AlertDialogDescription>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">备注说明</label>
            <input
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="选填，如未查到转账记录等"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleVerifyReject();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  处理中...
                </>
              ) : (
                '确认未收到'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPaymentVerificationPage;

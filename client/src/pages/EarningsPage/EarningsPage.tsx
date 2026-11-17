import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useUser } from '@client/src/store/userStore';
import { orders } from '@client/src/api/modules';
import { formatMoney, formatDate } from '@client/src/utils/format';
import type { Order } from '@shared/api.interface';

const EarningsPage: React.FC = () => {
  const { user } = useUser();
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadEarnings();
  }, [user?.id]);

  const loadEarnings = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await orders.list({
        runnerId: user.id,
        status: 'completed',
        pageSize: 100,
      });
      if (res.success) {
        setCompletedOrders(res.data.items);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || '加载收益明细失败');
    } finally {
      setLoading(false);
    }
  };

  // 累计收益 = 所有已完成订单的跑腿员收益之和
  const totalEarningsNum = completedOrders.reduce(
    (sum: number, order: Order) => sum + (parseFloat(order.runnerEarnings) || 0),
    0,
  );

  // 按确认时间倒序
  const sortedOrders = [...completedOrders].sort(
    (a: Order, b: Order) =>
      new Date(b.confirmedAt || b.createdAt).getTime() -
      new Date(a.confirmedAt || a.createdAt).getTime(),
  );

  return (
    <MobileLayout title="收益明细" showBack showTabBar={false}>
      <div className="p-4 space-y-4">
        {/* 顶部统计卡片 */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 rise">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">收益概览</span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">累计收益</p>
          <p className="text-3xl font-bold text-primary tnum mb-5">
            {formatMoney(totalEarningsNum)}
          </p>
          <div className="border-t border-primary/10 pt-4">
            <p className="text-xs text-muted-foreground mb-1">完成单数</p>
            <p className="text-base font-semibold text-foreground tnum">
              {completedOrders.length} 单
            </p>
          </div>
        </div>

        {/* 收益明细列表 */}
        <div className="rise">
          <h3 className="text-sm font-medium text-foreground mb-3 px-1">
            明细列表
          </h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i: number) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex justify-between items-end">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedOrders.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="暂无收益记录"
              description="完成订单后收益会显示在这里"
            />
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((order: Order) => {
                const earnings = parseFloat(order.runnerEarnings) || 0;
                const fee = parseFloat(order.platformFee) || 0;
                const total = parseFloat(order.totalAmount) || 0;
                return (
                  <div
                    key={order.id}
                    className="bg-card rounded-xl border border-border p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ArrowUpRight className="w-3.5 h-3.5 text-status-completed" />
                        <span>订单 {order.orderNo}</span>
                      </div>
                      <p className="text-base font-semibold text-primary tnum">
                        +{formatMoney(earnings)}
                      </p>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>
                        {formatDate(order.confirmedAt || order.createdAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          订单收入 {formatMoney(total)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3" />
                          手续费 {formatMoney(fee)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default EarningsPage;

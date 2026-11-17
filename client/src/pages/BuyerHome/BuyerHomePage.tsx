import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, ArrowRight, Bell, CloudRain, Zap } from 'lucide-react';

import { BuyerLayout } from '@client/src/components/BuyerLayout';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { EmptyState } from '@client/src/components/EmptyState';
import { ListSkeleton } from '@client/src/components/Skeleton';
import { Button } from '@client/src/components/ui/button';
import { useUser } from '@client/src/store/userStore';
import { orders, users } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, timeAgo } from '@client/src/utils/format';
import type { Order } from '@shared/api.interface';
import { PACKAGE_SIZE_LABELS } from '@shared/api.interface';

const BuyerHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await orders.list({ buyerId: user.id, pageSize: 3 });
      if (resp.success) {
        setOrdersList(resp.data.items);
      } else {
        toast.error(resp.message || '加载订单失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载订单失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await users.notifications(user.id, { pageSize: 1 });
      if (resp.success) {
        setUnreadCount(resp.data.unreadCount);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    void loadUnreadCount();
  }, [user, loadOrders, loadUnreadCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadUnreadCount]);

  const getPackageSizeSummary = (order: Order): string => {
    const sizes = order.packages.map((p) => PACKAGE_SIZE_LABELS[p.size]);
    return sizes.join('');
  };

  const rightAction = (
    <button
      onClick={() => navigate('/buyer/notifications')}
      className="relative p-1.5 -mr-1.5 text-foreground btn-press"
      aria-label="消息通知"
    >
      <Bell className="w-5 h-5" strokeWidth={2} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  if (!user) return null;

  return (
    <BuyerLayout showTabBar rightAction={rightAction}>
      <div className="p-4 space-y-4">
        {/* 主操作按钮 */}
        <Button
          size="lg"
          className="w-full h-12 text-base rounded-xl shadow-sm"
          onClick={() => navigate('/buyer/create-order')}
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          发布代取需求
        </Button>

        {/* 我的发布 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">我的发布</h2>
          <button
            onClick={() => navigate('/buyer/orders')}
            className="text-primary text-xs font-medium btn-press flex items-center gap-0.5"
            aria-label="查看全部订单"
          >
            查看全部
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* 订单列表 */}
        {loading ? (
          <ListSkeleton count={3} />
        ) : ordersList.length === 0 ? (
          <EmptyState
            icon="package"
            title="你还没发布过订单"
            description="点上面按钮发布第一单吧"
            action={
              <Button
                variant="default"
                onClick={() => navigate('/buyer/create-order')}
                className="mt-2"
              >
                立即发布
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {ordersList.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/buyer/order/${order.id}`)}
                className="card-hover bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-l-4 hover:border-l-primary cursor-pointer relative"
                role="button"
                aria-label={`查看订单 ${order.dormitory} 的详情`}
              >
                {/* 顶部：宿舍号 + 状态 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-foreground">
                      {order.dormitory}
                    </span>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                  <span className="text-lg font-bold text-primary tnum">
                    {formatMoney(order.totalAmount)}
                  </span>
                </div>

                {/* 包裹信息 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">
                    {order.packageCount}件 {getPackageSizeSummary(order)}
                  </span>
                  {order.isRainy && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary">
                      <CloudRain className="w-3 h-3" strokeWidth={2} />
                      下雨天
                    </span>
                  )}
                  {order.isUrgent && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium bg-warning/15 text-warning">
                      <Zap className="w-3 h-3" strokeWidth={2} />
                      急送
                    </span>
                  )}
                </div>

                {/* 发布时间 */}
                <div className="text-xs text-muted-foreground">
                  {timeAgo(order.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerHomePage;

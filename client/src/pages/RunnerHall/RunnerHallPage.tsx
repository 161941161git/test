import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RefreshCw, CloudRain, Zap, Bell, ArrowRight } from 'lucide-react';

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

const RunnerHallPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await orders.list({
        status: 'pending',
        excludeBuyerId: user.id,
        pageSize: 50,
      });
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

  const handleAccept = async (orderId: string) => {
    if (!user) return;
    setAcceptingId(orderId);
    try {
      const resp = await orders.accept(orderId, user.id);
      if (resp.success) {
        toast.success('接单成功！快去取件吧～');
        navigate(`/runner/order/${resp.data.id}`);
      } else {
        toast.error(resp.message || '接单失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '接单失败，请稍后重试'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/runner/order/${orderId}`);
  };

  const getPackageSizeSummary = (order: Order): string => {
    const sizes = order.packages.map((p) => PACKAGE_SIZE_LABELS[p.size]);
    return sizes.join('');
  };

  const rightAction = (
    <button
      onClick={() => navigate('/runner/notifications')}
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

  const canAccept = user?.isRunner && user?.runnerStatus === 'approved';

  return (
    <div className="p-4 space-y-4">
      {/* 右上角通知铃铛 */}
      <div className="flex justify-end -mt-2 -mr-1 mb-[-12px]">
        {rightAction}
      </div>

      {/* Banner */}
      <div className="bg-primary/10 rounded-2xl p-5 border border-primary/20">
        <h2 className="text-lg font-bold text-foreground mb-1">
          嗨，准备好接单了吗？
        </h2>
        <p className="text-sm text-muted-foreground">
          看看有没有顺路的快递～
        </p>
      </div>

      {/* 列表标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">待接单订单</h2>
        <button
          onClick={() => void loadOrders()}
          disabled={loading}
          className="text-muted-foreground text-sm btn-press flex items-center gap-1"
          aria-label="刷新"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
          刷新
        </button>
      </div>

      {/* 订单列表 */}
      {loading ? (
        <ListSkeleton count={5} />
      ) : ordersList.length === 0 ? (
        <EmptyState
          icon="package"
          title="暂无待接单"
          description="再等等，马上就有新订单了"
        />
      ) : (
        <div className="space-y-3">
          {ordersList.map((order) => (
            <div
              key={order.id}
              className="card-hover bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-l-4 hover:border-l-primary cursor-pointer relative"
              onClick={() => handleViewOrder(order.id)}
              role="button"
              aria-label={`查看订单 ${order.dormitory} 的代取详情`}
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
              <div className="text-xs text-muted-foreground mb-2">
                {timeAgo(order.createdAt)}
              </div>

              {/* 备注 */}
              {order.remark && (
                <p className="text-sm text-muted-foreground truncate mb-3">
                  备注：{order.remark}
                </p>
              )}

              {/* 底部按钮 */}
              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  className="h-8 px-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canAccept) {
                      void handleAccept(order.id);
                    } else {
                      handleViewOrder(order.id);
                    }
                  }}
                  disabled={acceptingId === order.id}
                >
                  {acceptingId === order.id
                    ? '接单中...'
                    : canAccept
                      ? '接单'
                      : '查看详情'}
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunnerHallPage;

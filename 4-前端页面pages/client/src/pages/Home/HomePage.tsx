import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, RefreshCw, Briefcase, ArrowRight, CloudRain, Zap, Bell } from 'lucide-react';
import { clsx } from 'clsx';

import { MobileLayout } from '@client/src/components/MobileLayout';
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

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await orders.list({ status: 'pending', pageSize: 50 });
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
  }, []);

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
    if (!user) {
      navigate('/login');
      return;
    }
    void loadOrders();
    void loadUnreadCount();
  }, [user, navigate, loadOrders, loadUnreadCount]);

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
        navigate(`/order/${resp.data.id}`);
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
    navigate(`/order/${orderId}`);
  };

  const handleSwitchRole = async () => {
    if (!user) return;
    const targetRole = user.userRole === 'runner' ? 'buyer' : 'runner';
    try {
      const resp = await users.switchRole(user.id, targetRole);
      if (resp.success) {
        setUser(resp.data);
        toast.success(
          targetRole === 'runner' ? '已切换到跑腿员模式，冲！' : '已切换回买家模式',
        );
      } else {
        toast.error(resp.message || '切换失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '切换角色失败'));
    }
  };

  const handlePartTime = () => {
    if (!user) return;
    if (user.userRole === 'buyer') {
      navigate('/apply-runner');
    } else {
      void handleSwitchRole();
    }
  };

  const getAcceptButtonConfig = () => {
    if (!user) return { text: '接单', disabled: false, onClick: undefined };
    if (user.isRunner) {
      return { text: '接单', disabled: false };
    }
    switch (user.runnerStatus) {
      case 'pending':
        return { text: '审核中，暂不能接单', disabled: true };
      case 'rejected':
        return { text: '申请未通过，不能接单', disabled: true };
      case 'none':
      default:
        return { text: '申请兼职后可接单', disabled: false, goApply: true };
    }
  };

  const rightAction = (
    <button
      onClick={() => navigate('/notifications')}
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

  const getPackageSizeSummary = (order: Order): string => {
    const sizes = order.packages.map((p) => PACKAGE_SIZE_LABELS[p.size]);
    return sizes.join('');
  };

  const acceptConfig = getAcceptButtonConfig();

  if (!user) return null;

  return (
    <MobileLayout rightAction={rightAction} showTabBar>
      <div className="p-4 space-y-4">
        {/* 主操作按钮 */}
        <Button
          size="lg"
          className="w-full h-12 text-base rounded-xl shadow-sm"
          onClick={() => navigate('/create-order')}
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          发布代取需求
        </Button>

        {/* 列表标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">待接单订单广场</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePartTime}
              className="text-primary text-xs font-medium btn-press flex items-center gap-1"
              aria-label={user.userRole === 'runner' ? '切回买家' : '做兼职'}
            >
              <Briefcase className="w-4 h-4" strokeWidth={2} />
              {user.userRole === 'runner' ? '切回买家' : '做兼职'}
            </button>
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
        </div>

        {/* 订单列表 */}
        {loading ? (
          <ListSkeleton count={5} />
        ) : ordersList.length === 0 ? (
          <EmptyState
            icon="package"
            title="暂无待取订单"
            description="快来发布第一单吧！"
            action={
              <Button
                variant="default"
                onClick={() => navigate('/create-order')}
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
                  {user.isRunner ? (
                    <Button
                      size="sm"
                      className="h-8 px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleAccept(order.id);
                      }}
                      disabled={acceptingId === order.id}
                    >
                      {acceptingId === order.id ? '接单中...' : acceptConfig.text}
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={acceptConfig.disabled ? 'outline' : 'default'}
                      className={clsx(
                        'h-8 px-4',
                        acceptConfig.disabled && 'opacity-60 cursor-not-allowed',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (acceptConfig.disabled) return;
                        if ('goApply' in acceptConfig && acceptConfig.goApply) {
                          navigate('/apply-runner');
                        } else {
                          handleViewOrder(order.id);
                        }
                      }}
                      disabled={acceptConfig.disabled}
                    >
                      {acceptConfig.text}
                      {!acceptConfig.disabled && (
                        <ArrowRight className="w-4 h-4" strokeWidth={2} />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default HomePage;

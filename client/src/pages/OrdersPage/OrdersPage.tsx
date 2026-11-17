import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { orders } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { EmptyState } from '@client/src/components/EmptyState';
import { ListSkeleton } from '@client/src/components/Skeleton';
import { Button } from '@client/src/components/ui/button';
import { formatDate, formatMoney } from '@client/src/utils/format';
import type { Order, OrderStatus, PackageSize } from '@shared/api.interface';
import {
  PACKAGE_SIZE_LABELS,
  ORDER_STATUS_LABELS,
} from '@shared/api.interface';

const TAB_KEYS = ['all', 'pending', 'in_progress', 'delivered', 'completed', 'refunding'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  all: '全部',
  pending: '待接单',
  in_progress: '进行中',
  delivered: '已送达',
  completed: '已完成',
  refunding: '退款中',
};

const EmptyTextByTab: Record<TabKey, { title: string; desc: string }> = {
  all: { title: '还没有订单', desc: '去首页看看有没有合适的订单吧' },
  pending: { title: '没有待接单订单', desc: '发布一个订单或去接单大厅看看' },
  in_progress: { title: '没有进行中的订单', desc: '完成订单后会出现在这里' },
  delivered: { title: '没有待确认的订单', desc: '等快递送到后就可以确认收货啦' },
  completed: { title: '没有已完成的订单', desc: '完成的订单会记录在这里' },
  refunding: { title: '没有退款中的订单', desc: '申请退款的订单会出现在这里' },
};

const OrderCard: React.FC<{ order: Order; onClick: () => void; onAccept?: (orderId: string) => void; accepting?: boolean; isRunnerApproved?: boolean; runnerStatus?: string }> = ({ order, onClick, onAccept, accepting, isRunnerApproved, runnerStatus }) => {
  const maxSize = order.packages.reduce<PackageSize>((max, pkg) => {
    const orderOfSize: Record<PackageSize, number> = { small: 0, medium: 1, large: 2, oversize: 3 };
    return orderOfSize[pkg.size] > orderOfSize[max] ? pkg.size : max;
  }, 'small');

  const showAcceptButton = order.status === 'pending' && onAccept && runnerStatus !== undefined;
  const acceptDisabled = !isRunnerApproved || accepting;
  const acceptText = isRunnerApproved ? '接单' : runnerStatus === 'pending' ? '审核中' : '未通过';

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-4 space-y-3 cursor-pointer card-hover shadow-2xs rise"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">订单号：{order.orderNo}</p>
          <p className="text-sm font-medium text-foreground truncate">
            {order.dormitory} · {order.packageCount} 件包裹
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <StatusBadge status={order.status} size="sm" />
          {order.paymentStatus === 'unpaid' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-amber-100 text-amber-700 font-medium">
              待支付
            </span>
          )}
          {order.paymentStatus === 'pending_verify' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary font-medium">
              待核对
            </span>
          )}
          {order.paymentStatus === 'paid' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-muted text-muted-foreground/70 font-medium">
              已支付
            </span>
          )}
          {order.paymentStatus === 'refunded' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-muted text-muted-foreground font-medium">
              已退款
            </span>
          )}
          {(order.status === 'refunding' || order.status === 'refunded') && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-status-refunding/10 text-status-refunding font-medium">
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md bg-secondary text-secondary-foreground">
          {PACKAGE_SIZE_LABELS[maxSize]}
        </span>
        {order.isRainy && (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md bg-status-delivered/10 text-status-delivered">
            雨天 +0.5
          </span>
        )}
        {order.isUrgent && (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md bg-status-refunding/10 text-status-refunding">
            急送 +0.5
          </span>
        )}
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-border/60">
        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
        {showAcceptButton ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-3 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (!acceptDisabled && onAccept) {
                onAccept(order.id);
              }
            }}
            disabled={acceptDisabled}
          >
            {accepting ? '接单中...' : acceptText}
            {!acceptDisabled && <ArrowRight className="w-3 h-3 ml-1" strokeWidth={2} />}
          </Button>
        ) : (
          <p className="text-lg font-bold text-primary tnum">{formatMoney(order.totalAmount)}</p>
        )}
      </div>
    </div>
  );
};

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: { status?: string; buyerId?: string; runnerId?: string } = {};
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      if (user.userRole === 'buyer') {
        params.buyerId = user.id;
      } else {
        params.runnerId = user.id;
      }
      const res = await orders.list(params);
      if (res.success) {
        setOrdersList(res.data.items || []);
      } else {
        toast.error(res.message || '获取订单列表失败');
        setOrdersList([]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '获取订单列表失败');
      setOrdersList([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleTabChange = (tab: TabKey) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  const handleAccept = async (orderId: string) => {
    if (!user || !user.isRunner) {
      if (user?.runnerStatus === 'pending') {
        toast.info('兼职申请正在审核中，通过后即可接单');
      } else if (user?.runnerStatus === 'rejected') {
        toast.error('兼职申请未通过，不能接单');
      } else {
        navigate('/apply-runner');
      }
      return;
    }
    setAcceptingId(orderId);
    try {
      const resp = await orders.accept(orderId, user.id);
      if (resp.success) {
        toast.success('接单成功，快去取件吧');
        void loadOrders();
      } else {
        toast.error(resp.message || '接单失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || '接单失败');
    } finally {
      setAcceptingId(null);
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <EmptyState
          icon="package"
          title="请先登录"
          description="登录后查看你的订单"
          action={
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium btn-press"
            >
              去登录
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex overflow-x-auto scrollbar-hide px-2">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={clsx(
                'flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
                activeTab === tab
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABELS[tab]}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-4">
        {loading ? (
          <ListSkeleton count={5} />
        ) : ordersList.length === 0 ? (
          <EmptyState
            icon="package"
            title={EmptyTextByTab[activeTab].title}
            description={EmptyTextByTab[activeTab].desc}
          />
        ) : (
          <div className="space-y-3">
            {ordersList.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/order/${order.id}`)}
                onAccept={user?.userRole === 'runner' ? handleAccept : undefined}
                accepting={acceptingId === order.id}
                isRunnerApproved={user?.isRunner}
                runnerStatus={user?.runnerStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;

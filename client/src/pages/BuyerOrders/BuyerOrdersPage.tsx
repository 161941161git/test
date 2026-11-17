import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { CloudRain, Zap } from 'lucide-react';
import { orders } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { BuyerLayout } from '@client/src/components/BuyerLayout';
import { StatusBadge } from '@client/src/components/StatusBadge';
import { EmptyState } from '@client/src/components/EmptyState';
import { ListSkeleton } from '@client/src/components/Skeleton';
import { formatDate, formatMoney } from '@client/src/utils/format';
import type { Order, PackageSize } from '@shared/api.interface';
import { PACKAGE_SIZE_LABELS } from '@shared/api.interface';

const TAB_KEYS = [
  'all',
  'pending',
  'in_progress',
  'delivered',
  'completed',
  'refunding',
] as const;
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
  all: { title: '还没有订单', desc: '去首页发布你的第一单吧' },
  pending: { title: '没有待接单订单', desc: '发布的订单还在等待跑腿员接单' },
  in_progress: { title: '没有进行中的订单', desc: '订单被接单后会出现在这里' },
  delivered: { title: '没有待确认的订单', desc: '快递送到后记得确认收货哦' },
  completed: { title: '没有已完成的订单', desc: '完成的订单会记录在这里' },
  refunding: { title: '没有退款中的订单', desc: '申请退款的订单会出现在这里' },
};

const OrderCard: React.FC<{ order: Order; onClick: () => void }> = ({
  order,
  onClick,
}) => {
  const maxSize = order.packages.reduce<PackageSize>((max, pkg) => {
    const orderOfSize: Record<PackageSize, number> = {
      small: 0,
      medium: 1,
      large: 2,
      oversize: 3,
    };
    return orderOfSize[pkg.size] > orderOfSize[max] ? pkg.size : max;
  }, 'small');

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-4 space-y-3 cursor-pointer card-hover shadow-2xs rise"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">
            订单号：{order.orderNo}
          </p>
          <p className="text-sm font-medium text-foreground truncate">
            {order.dormitory} · {order.packageCount} 件包裹
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <StatusBadge status={order.status} size="sm" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md bg-secondary text-secondary-foreground">
          {PACKAGE_SIZE_LABELS[maxSize]}
        </span>
        {order.isRainy && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] rounded-md bg-status-delivered/10 text-status-delivered">
            <CloudRain className="w-3 h-3" strokeWidth={2} />
            雨天 +0.5
          </span>
        )}
        {order.isUrgent && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] rounded-md bg-status-refunding/10 text-status-refunding">
            <Zap className="w-3 h-3" strokeWidth={2} />
            急送 +0.5
          </span>
        )}
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-border/60">
        <p className="text-xs text-muted-foreground">
          {formatDate(order.createdAt)}
        </p>
        <p className="text-lg font-bold text-primary tnum">
          {formatMoney(order.totalAmount)}
        </p>
      </div>
    </div>
  );
};

const BuyerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: { status?: string; buyerId?: string; pageSize?: number } = {
        buyerId: user.id,
        pageSize: 50,
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
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

  if (!user) {
    return (
      <BuyerLayout showTabBar>
        <div className="p-4">
          <EmptyState
            icon="package"
            title="请先登录"
            description="登录后查看你的订单"
          />
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout showTabBar title="我的订单">
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
                  onClick={() => navigate(`/buyer/order/${order.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BuyerLayout>
  );
};

export default BuyerOrdersPage;

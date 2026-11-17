import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package,
  Clock,
  Truck,
  CheckCircle,
  DollarSign,
  PiggyBank,
  RefreshCw,
  Wallet,
  Hourglass,
  TrendingUp,
  Banknote,
  Percent,
  UserCheck,
  Users,
  Bell,
  Calendar,
  ChevronRight,
} from 'lucide-react';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney } from '@client/src/utils/format';
import { Skeleton } from '@client/src/components/ui/skeleton';

interface DashboardData {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalAmount: string;
  platformEarnings: string;
  pendingRefunds: number;
  pendingWithdraws: number;
  pendingVerifyCount: number;
  pendingVerifyAmount: string;
  pendingPayoutAmount: string;
  platformFeeTotal: string;
  escrowAmount: string;
  pendingRunnerApplications: number;
  approvedRunnerCount: number;
  todayNewOrders: number;
  unreadNotifications: number;
}

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await admin.dashboard();
      if (resp.success) {
        setData(resp.data as DashboardData);
      } else {
        toast.error(resp.message || '加载数据失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载数据失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const statCards: Array<{
    key: string;
    label: string;
    value: string;
    icon: React.ElementType;
    colorClass: string;
    bgClass: string;
    linkTo: string;
  }> = data
    ? [
        {
          key: 'total',
          label: '已下单总数',
          value: String(data.totalOrders),
          icon: Package,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/orders?status=all',
        },
        {
          key: 'pending',
          label: '等待接单',
          value: String(data.pendingOrders),
          icon: Clock,
          colorClass: 'text-status-pending',
          bgClass: 'bg-status-pending/10',
          linkTo: '/admin/orders?status=pending',
        },
        {
          key: 'inProgress',
          label: '进行中',
          value: String(data.inProgressOrders),
          icon: Truck,
          colorClass: 'text-status-in-progress',
          bgClass: 'bg-status-in-progress/10',
          linkTo: '/admin/orders?status=in_progress',
        },
        {
          key: 'completed',
          label: '已完成',
          value: String(data.completedOrders),
          icon: CheckCircle,
          colorClass: 'text-status-completed',
          bgClass: 'bg-status-completed/10',
          linkTo: '/admin/orders?status=completed',
        },
        {
          key: 'todayNew',
          label: '今日新订单',
          value: String(data.todayNewOrders ?? 0),
          icon: Calendar,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/orders?date=today',
        },
        {
          key: 'pendingRunner',
          label: '待审核兼职',
          value: String(data.pendingRunnerApplications ?? 0),
          icon: UserCheck,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/runner-reviews?status=pending',
        },
        {
          key: 'approvedRunner',
          label: '已通过跑腿员',
          value: String(data.approvedRunnerCount ?? 0),
          icon: Users,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/users?isRunner=1',
        },
        {
          key: 'pendingVerify',
          label: '待核对付款',
          value: `${data.pendingVerifyCount} 笔`,
          icon: Clock,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/payment-verification?filter=pending',
        },
        {
          key: 'pendingVerifyAmount',
          label: '待核对金额',
          value: formatMoney(data.pendingVerifyAmount),
          icon: DollarSign,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/payment-verification',
        },
        {
          key: 'escrowAmount',
          label: '托管中金额',
          value: formatMoney(data.escrowAmount),
          icon: Banknote,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/funds',
        },
        {
          key: 'pendingPayout',
          label: '待打款给跑腿员',
          value: formatMoney(data.pendingPayoutAmount),
          icon: Wallet,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/funds?filter=pending_payment',
        },
        {
          key: 'platformFeeTotal',
          label: '平台手续费累计',
          value: formatMoney(data.platformFeeTotal),
          icon: Percent,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/earnings',
        },
        {
          key: 'refunds',
          label: '待处理退款',
          value: String(data.pendingRefunds),
          icon: RefreshCw,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/refunds?status=pending',
        },
        {
          key: 'unreadNotif',
          label: '未读通知',
          value: String(data.unreadNotifications ?? 0),
          icon: Bell,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/notifications',
        },
        {
          key: 'withdraws',
          label: '待审核提现',
          value: String(data.pendingWithdraws),
          icon: PiggyBank,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          linkTo: '/admin/funds?tab=withdraw',
        },
        {
          key: 'totalAmount',
          label: '成交总额',
          value: formatMoney(data.totalAmount),
          icon: TrendingUp,
          colorClass: 'text-primary',
          bgClass: 'bg-primary/10',
          linkTo: '/admin/earnings',
        },
      ]
    : [];

  return (
    <div className="p-4 space-y-4">
      {/* 刷新按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">数据概览</h2>
        <button
          onClick={() => void loadDashboard()}
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

      {/* 数据卡片网格 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-4 space-y-2"
            >
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3" data-ai-section-type="card-stat">
          {statCards.map((card, index) => {
            const IconComp = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => navigate(card.linkTo)}
                className="text-left bg-card rounded-xl border border-border p-4 shadow-sm rise hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative"
                style={{ animationDelay: `${index * 0.03}s` }}
                aria-label={`查看${card.label}详情`}
              >
                <ChevronRight
                  className="absolute top-3 right-3 w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                  strokeWidth={2}
                />
                <div
                  className={`w-9 h-9 rounded-lg ${card.bgClass} flex items-center justify-center mb-3`}
                >
                  <IconComp
                    className={`w-5 h-5 ${card.colorClass}`}
                    strokeWidth={2}
                  />
                </div>
                <p
                  className={`text-xl font-bold tnum mb-1 ${card.colorClass}`}
                >
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;

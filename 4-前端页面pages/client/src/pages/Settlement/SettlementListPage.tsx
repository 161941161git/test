import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { Wallet, Clock, CheckCircle2, Banknote, ChevronRight } from 'lucide-react';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { settlement } from '@client/src/api/modules';
import { useUser } from '@client/src/store/userStore';
import { formatDate, formatMoney } from '@client/src/utils/format';
import {
  SETTLEMENT_SESSION_STATUS_LABELS,
  type SettlementSession,
  type SettlementSessionStatus,
  type RunnerEarningsSummary,
} from '@shared/api.interface';

const statusColorMap: Record<SettlementSessionStatus, string> = {
  pending_payment: 'bg-blue-100 text-blue-700',
  pending_settle: 'bg-blue-200 text-blue-800',
  paid: 'bg-blue-600 text-white',
  refunded: 'bg-gray-200 text-gray-600',
};

const formatFen = (fen: number): string => {
  return formatMoney(fen / 100);
};

const SettlementListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [sessions, setSessions] = useState<SettlementSession[]>([]);
  const [earnings, setEarnings] = useState<RunnerEarningsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, earningsRes] = await Promise.all([
        settlement.getRunnerList(user?.id ?? ''),
        settlement.getRunnerEarnings(user?.id ?? ''),
      ]);
      if (listRes.success) {
        setSessions(listRes.data || []);
      } else {
        toast.error(listRes.message || '获取结算列表失败');
      }
      if (earningsRes.success) {
        setEarnings(earningsRes.data);
      } else {
        toast.error(earningsRes.message || '获取收益统计失败');
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = err.response?.data?.error?.message || '加载失败，请重试';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleItemClick = (id: string) => {
    navigate(`/settlement/${id}`);
  };

  const statCards = earnings
    ? [
        {
          key: 'total',
          label: '总收益',
          value: formatMoney(earnings.totalEarnings),
          icon: Wallet,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          key: 'pending',
          label: '待结算',
          value: formatMoney(earnings.pendingSettlement),
          icon: Clock,
          color: 'text-amber-600',
          bg: 'bg-amber-100',
        },
        {
          key: 'settled',
          label: '已结算',
          value: formatMoney(earnings.settled),
          icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-100',
        },
        {
          key: 'withdraw',
          label: '可提现',
          value: formatMoney(earnings.availableWithdraw),
          icon: Banknote,
          color: 'text-orange-600',
          bg: 'bg-orange-100',
        },
      ]
    : [];

  return (
    <MobileLayout title="我的结算" showTabBar>
      <div className="p-4 space-y-4">
        {/* Earnings overview */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-4 text-white shadow-md">
          <p className="text-xs text-white/80 mb-1">累计收益</p>
          <p className="text-3xl font-bold tnum">
            {loading ? (
              <Skeleton className="h-8 w-28 bg-white/20" />
            ) : (
              formatMoney(earnings?.totalEarnings)
            )}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center">
              <p className="text-lg font-semibold tnum">
                {loading ? (
                  <Skeleton className="h-5 w-14 bg-white/20 mx-auto" />
                ) : (
                  formatMoney(earnings?.pendingSettlement)
                )}
              </p>
              <p className="text-[11px] text-white/70">待结算</p>
            </div>
            <div className="text-center border-x border-white/20">
              <p className="text-lg font-semibold tnum">
                {loading ? (
                  <Skeleton className="h-5 w-14 bg-white/20 mx-auto" />
                ) : (
                  formatMoney(earnings?.settled)
                )}
              </p>
              <p className="text-[11px] text-white/70">已结算</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold tnum">
                {loading ? (
                  <Skeleton className="h-5 w-14 bg-white/20 mx-auto" />
                ) : (
                  formatMoney(earnings?.availableWithdraw)
                )}
              </p>
              <p className="text-[11px] text-white/70">可提现</p>
            </div>
          </div>
        </div>

        {/* Session list */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-foreground">结算会话</h2>
            <span className="text-xs text-muted-foreground">
              共 {sessions.length} 条
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty className="bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock />
                </EmptyMedia>
                <EmptyTitle>加载失败</EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="text-primary text-sm font-medium"
                >
                  点击重试
                </button>
              </EmptyContent>
            </Empty>
          ) : sessions.length === 0 ? (
            <Empty className="bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wallet />
                </EmptyMedia>
                <EmptyTitle>暂无结算记录</EmptyTitle>
                <EmptyDescription>
                  完成订单后会自动创建结算会话
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleItemClick(session.id)}
                  className={clsx(
                    'w-full text-left bg-card rounded-xl border border-border p-4',
                    'hover:border-primary/30 hover:shadow-sm transition-all btn-press',
                    'flex items-center gap-3',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground truncate">
                        订单号：{session.orderNo}
                      </span>
                      <span
                        className={clsx(
                          'flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full',
                          statusColorMap[session.status],
                        )}
                      >
                        {SETTLEMENT_SESSION_STATUS_LABELS[session.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">
                          跑腿费
                        </span>
                        <span className="ml-1 text-base font-bold text-primary tnum">
                          {formatFen(session.runnerAmountFen)}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                    strokeWidth={2}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default SettlementListPage;

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Clock,
  Banknote,
  CheckCircle,
  Percent,
  Wallet,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  RefreshCcw,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { admin, settlement as settlementApi, payment as paymentApi } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { EmptyState } from '@client/src/components/EmptyState';
import {
  FUND_TX_TYPE_LABELS,
  FUND_TX_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  AdminDashboard,
  FundTransaction,
  FundTxType,
  FundTxStatus,
  SettlementSession,
} from '@shared/api.interface';

interface FundStats {
  pendingVerifyAmount: string;
  escrowAmountVerified: string;
  settledAmount: string;
  platformFeeTotal: string;
  pendingPayoutAmount: string;
}

const statCardDefs: Array<{
  key: keyof FundStats;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}> = [
  {
    key: 'pendingVerifyAmount',
    label: '待核对金额',
    icon: Clock,
    colorClass: 'text-status-refunding',
    bgClass: 'bg-status-refunding/10',
  },
  {
    key: 'escrowAmountVerified',
    label: '托管中金额',
    icon: Banknote,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  {
    key: 'settledAmount',
    label: '已结算金额',
    icon: CheckCircle,
    colorClass: 'text-status-completed',
    bgClass: 'bg-status-completed/10',
  },
  {
    key: 'platformFeeTotal',
    label: '平台手续费累计',
    icon: Percent,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  {
    key: 'pendingPayoutAmount',
    label: '待打款给跑腿员',
    icon: Wallet,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
];

function getStatusClass(status: FundTxStatus): string {
  switch (status) {
    case 'success':
      return 'bg-status-completed/15 text-status-completed';
    case 'pending_verify':
      return 'bg-status-refunding/15 text-status-refunding';
    case 'pending':
      return 'bg-primary/10 text-primary';
    case 'failed':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTxIcon(txType: FundTxType): React.ElementType {
  switch (txType) {
    case 'buyer_payment':
      return CreditCard;
    case 'settlement_pay':
      return ArrowDownLeft;
    case 'refund':
      return RefreshCcw;
    case 'withdraw':
      return ArrowUpRight;
    case 'platform_fee':
      return Percent;
    default:
      return Banknote;
  }
}

function formatAmountFen(
  amountFen: number,
  direction: 'in' | 'out',
): string {
  const yuan = amountFen / 100;
  const sign = direction === 'in' ? '+' : '-';
  return `${sign}¥${yuan.toFixed(2)}`;
}

const RECENT_PAGE_SIZE = 10;

const AdminFundsPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<FundStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementSession[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const resp = await admin.dashboard();
      if (resp.success) {
        const d = resp.data as unknown as AdminDashboard;
        setStats({
          pendingVerifyAmount: d.pendingVerifyAmount ?? '0',
          escrowAmountVerified: d.escrowAmountVerified ?? '0',
          settledAmount: d.settledAmount ?? '0',
          platformFeeTotal: d.platformFeeTotal ?? '0',
          pendingPayoutAmount: d.pendingPayoutAmount ?? '0',
        });
      } else {
        toast.error(resp.message || '加载资金概览失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const resp = await paymentApi.transactions({
        page: 1,
        pageSize: RECENT_PAGE_SIZE,
      });
      if (resp.success) {
        setTransactions(resp.data.items);
      } else {
        toast.error(resp.message || '加载资金流水失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    }
  }, []);

  const loadPendingSettlements = useCallback(async () => {
    try {
      const resp = await settlementApi.adminList('pending_settle');
      if (resp.success) {
        setPendingSettlements(resp.data.items.slice(0, 5));
      }
    } catch (err) {
      // 静默失败，不阻塞主页面
    }
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadTransactions(), loadPendingSettlements()]);
    setRefreshing(false);
  }, [loadStats, loadTransactions, loadPendingSettlements]);

  useEffect(() => {
    void (async () => {
      setStatsLoading(true);
      setTxLoading(true);
      setSettlementLoading(true);
      await Promise.all([loadStats(), loadTransactions(), loadPendingSettlements()]);
      setStatsLoading(false);
      setTxLoading(false);
      setSettlementLoading(false);
    })();
  }, [loadStats, loadTransactions, loadPendingSettlements]);

  return (
    <div className="p-4 space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">资金</h1>
        <button
          onClick={() => void loadAll()}
          disabled={refreshing}
          className="text-muted-foreground text-sm btn-press flex items-center gap-1"
          aria-label="刷新"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
          刷新
        </button>
      </div>

      {/* 资金概览 */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          资金概览
        </h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            {statCardDefs.map((card, index) => {
              const IconComp = card.icon;
              return (
                <div
                  key={card.key}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm rise"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div
                    className={`w-9 h-9 rounded-lg ${card.bgClass} flex items-center justify-center mb-3`}
                  >
                    <IconComp
                      className={`w-5 h-5 ${card.colorClass}`}
                      strokeWidth={2}
                    />
                  </div>
                  <p
                    className={`text-lg font-bold tnum mb-1 ${card.colorClass}`}
                  >
                    {formatMoney(stats[card.key])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {card.label}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* 待打款结算会话 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">待打款结算</h2>
          <button
            onClick={() => navigate('/admin/settlements')}
            className="text-xs text-primary btn-press flex items-center gap-0.5"
          >
            全部
            <ChevronRight className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
        {settlementLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-3 flex items-center gap-3"
              >
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ) : pendingSettlements.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="暂无待打款"
            description="跑腿员还没提交收款码"
          />
        ) : (
          <div className="space-y-2">
            {pendingSettlements.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/admin/settlements/${s.id}`)}
                className="w-full bg-card rounded-xl border border-border p-3 flex items-center gap-3 btn-press text-left hover:border-primary/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-warning" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    订单 {s.orderNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    跑腿员可得 ¥{((s.runnerAmountFen ?? 0) / 100).toFixed(2)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 最近资金流水 */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          最近资金流水
        </h2>
        {txLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-12 mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-12 mt-1 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="暂无资金流水"
            description="还没有资金流水记录"
          />
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const TxIcon = getTxIcon(tx.txType as FundTxType);
              const isIn = tx.direction === 'in';
              const status = tx.status as FundTxStatus;
              return (
                <div
                  key={tx.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm rise"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          isIn
                            ? 'bg-status-completed/10'
                            : 'bg-destructive/10',
                        )}
                      >
                        <TxIcon
                          className={clsx(
                            'w-5 h-5',
                            isIn
                              ? 'text-status-completed'
                              : 'text-destructive',
                          )}
                          strokeWidth={2}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {FUND_TX_TYPE_LABELS[tx.txType as FundTxType] ??
                            tx.txType}
                        </p>
                        <span
                          className={clsx(
                            'inline-block mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full',
                            getStatusClass(status),
                          )}
                        >
                          {FUND_TX_STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={clsx(
                          'text-base font-bold tnum',
                          isIn
                            ? 'text-status-completed'
                            : 'text-destructive',
                        )}
                      >
                        {formatAmountFen(tx.amountFen, tx.direction)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminFundsPage;

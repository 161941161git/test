import React, { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Banknote,
  Percent,
  CreditCard,
  ChevronDown,
} from 'lucide-react';

import { payment as paymentApi } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type {
  FundTransaction,
  FundTxType,
} from '@shared/api.interface';
import {
  FUND_TX_TYPES,
  FUND_TX_TYPE_LABELS,
} from '@shared/api.interface';

type TxStatus = 'all' | 'pending' | 'success' | 'failed';

const typeTabs: Array<{ key: 'all' | FundTxType; label: string }> = [
  { key: 'all', label: '全部' },
  ...FUND_TX_TYPES.map((t) => ({
    key: t as FundTxType,
    label: FUND_TX_TYPE_LABELS[t],
  })),
];

const statusTabs: Array<{ key: TxStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'success', label: '成功' },
  { key: 'failed', label: '失败' },
];

const statusLabelMap: Record<'pending' | 'success' | 'failed', string> = {
  pending: '待处理',
  success: '成功',
  failed: '失败',
};

function getStatusClass(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-status-completed/10 text-status-completed';
    case 'pending':
      return 'bg-status-refunding/10 text-status-refunding';
    case 'failed':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTxIcon(txType: FundTxType): React.ElementType {
  switch (txType) {
    case 'buyer_payment':
      return CreditCard;
    case 'settlement_settle':
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

const PAGE_SIZE = 20;

const FundTransactionsPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'all' | FundTxType>('all');
  const [activeStatus, setActiveStatus] = useState<TxStatus>('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadTransactions = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (isRefresh) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const params: {
          txType?: string;
          status?: string;
          page: number;
          pageSize: number;
        } = {
          page: pageNum,
          pageSize: PAGE_SIZE,
        };
        if (activeType !== 'all') {
          params.txType = activeType;
        }
        if (activeStatus !== 'all') {
          params.status = activeStatus;
        }
        const resp = await paymentApi.transactions(params);
        if (resp.success) {
          const items = resp.data.items;
          if (isRefresh) {
            setTransactions(items);
          } else {
            setTransactions((prev) => [...prev, ...items]);
          }
          setTotal(resp.data.total);
          setHasMore(items.length === PAGE_SIZE);
        } else {
          toast.error(resp.message || '加载资金流水失败');
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeType, activeStatus],
  );

  useEffect(() => {
    setPage(1);
    void loadTransactions(1, true);
  }, [loadTransactions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !loading
        ) {
          const nextPage = page + 1;
          setPage(nextPage);
          void loadTransactions(nextPage, false);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, loadTransactions]);

  const handleTypeChange = (key: 'all' | FundTxType) => {
    if (key === activeType) return;
    setActiveType(key);
  };

  const handleStatusChange = (key: TxStatus) => {
    if (key === activeStatus) return;
    setActiveStatus(key);
    setShowStatusFilter(false);
  };

  const formatAmountFen = (amountFen: number, direction: 'in' | 'out'): string => {
    const yuan = amountFen / 100;
    const sign = direction === 'in' ? '+' : '-';
    return `${sign}¥${yuan.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* 类型 Tabs */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-2">
          <div className="flex gap-1 bg-muted p-1 rounded-lg min-w-max">
            {typeTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTypeChange(tab.key)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                  activeType === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 状态筛选下拉 */}
        <div className="relative">
          <button
            onClick={() => setShowStatusFilter(!showStatusFilter)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-foreground bg-muted rounded-md"
            aria-label="筛选状态"
          >
            状态：
            {statusTabs.find((s) => s.key === activeStatus)?.label}
            <ChevronDown
              className={clsx(
                'w-3.5 h-3.5 transition-transform',
                showStatusFilter && 'rotate-180',
              )}
              strokeWidth={2}
            />
          </button>
          {showStatusFilter && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleStatusChange(tab.key)}
                  className={clsx(
                    'w-full px-3 py-2 text-xs text-left transition-colors',
                    activeStatus === tab.key
                      ? 'text-primary bg-primary/5'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-16 mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-16" />
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
            description="当前筛选条件下没有流水记录"
          />
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const TxIcon = getTxIcon(tx.txType as FundTxType);
              const isIn = tx.direction === 'in';
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
                            getStatusClass(tx.status),
                          )}
                        >
                          {statusLabelMap[
                            tx.status as 'pending' | 'success' | 'failed'
                          ] ?? tx.status}
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

                  {(tx.thirdPartyNo || tx.orderId) && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                      {tx.orderId && (
                        <div className="flex justify-between gap-3">
                          <span className="shrink-0">订单号</span>
                          <span className="font-mono truncate">
                            {tx.orderId}
                          </span>
                        </div>
                      )}
                      {tx.thirdPartyNo && (
                        <div className="flex justify-between gap-3">
                          <span className="shrink-0">第三方单号</span>
                          <span className="font-mono truncate">
                            {tx.thirdPartyNo}
                          </span>
                        </div>
                      )}
                      {tx.remark && (
                        <div className="flex justify-between gap-3">
                          <span className="shrink-0">备注</span>
                          <span className="truncate">{tx.remark}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 加载更多 / 没有更多 */}
            <div ref={loadMoreRef} className="py-4 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <RefreshCcw
                    className="w-3.5 h-3.5 animate-spin"
                    strokeWidth={2}
                  />
                  加载中...
                </div>
              )}
              {!loadingMore && !hasMore && transactions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  没有更多了 · 共 {total} 条
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FundTransactionsPage;

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type { RefundRequest, RefundStatus } from '@shared/api.interface';
import { REFUND_STATUS_LABELS } from '@shared/api.interface';

const tabs: Array<{ key: string; label: string; status?: RefundStatus }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理', status: 'pending' },
  { key: 'approved', label: '已通过', status: 'approved' },
  { key: 'rejected', label: '已拒绝', status: 'rejected' },
];

const AdminRefundsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const initialTab = urlStatus && tabs.some((t) => t.key === urlStatus)
    ? urlStatus
    : 'all';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; pageSize?: number } = { pageSize: 50 };
      const currentTab = tabs.find((t) => t.key === activeTab);
      if (currentTab?.status) {
        params.status = currentTab.status;
      }
      const resp = await admin.refunds(params);
      if (resp.success) {
        setRefunds(resp.data.items);
      } else {
        toast.error(resp.message || '加载退款列表失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-status-refunding/10 text-status-refunding';
      case 'approved':
        return 'bg-status-completed/10 text-status-completed';
      case 'rejected':
        return 'bg-status-refunded/10 text-status-refunded';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                const next = new URLSearchParams(searchParams);
                if (tab.key === 'all') {
                  next.delete('status');
                } else {
                  next.set('status', tab.key);
                }
                setSearchParams(next, { replace: true });
              }}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
                <div className="flex justify-between items-center pt-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : refunds.length === 0 ? (
          <EmptyState
            icon="file"
            title="暂无退款申请"
            description="有新的退款申请会在这里显示"
          />
        ) : (
          <div className="space-y-3">
            {refunds.map((refund) => (
              <div
                key={refund.id}
                className="bg-card rounded-xl border border-border p-4 shadow-sm card-hover cursor-pointer rise"
                onClick={() => navigate(`/admin/refunds/${refund.id}`)}
                role="button"
                aria-label={`查看 ${refund.buyerName} 的退款申请详情`}
              >
                {/* 顶部：申请人 + 状态 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {refund.buyerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {refund.buyerPhone}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                      getStatusClass(refund.status),
                    )}
                  >
                    {REFUND_STATUS_LABELS[refund.status]}
                  </span>
                </div>

                {/* 宿舍号 + 金额 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {refund.buyerDormitory}
                  </span>
                  <span className="text-base font-bold text-primary tnum">
                    {formatMoney(refund.orderAmount)}
                  </span>
                </div>

                {/* 退款理由 */}
                <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                  退款理由：{refund.reason}
                </p>

                {/* 底部：时间 + 会话按钮 */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    申请时间：{formatDate(refund.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    {refund.sessionId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/refund-session/${refund.sessionId}`);
                        }}
                        className="text-xs text-primary font-medium btn-press flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" strokeWidth={2} />
                        查看会话
                      </button>
                    )}
                    <ChevronRight
                      className="w-4 h-4 text-muted-foreground"
                      strokeWidth={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRefundsPage;

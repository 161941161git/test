import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { TrendingUp, ArrowUpRight, Info } from 'lucide-react';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney } from '@client/src/utils/format';
import { Skeleton } from '@client/src/components/ui/skeleton';

interface EarningsData {
  totalEarnings: string;
  availableWithdraw: string;
}

const AdminEarningsPage: React.FC = () => {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await admin.earnings();
      if (resp.success) {
        setData(resp.data);
      } else {
        toast.error(resp.message || '加载收益数据失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  return (
    <div className="p-4 space-y-4">
      {/* 顶部累计收益 */}
      {loading ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
          <Skeleton className="h-5 w-24 bg-primary/10" />
          <Skeleton className="h-10 w-36 bg-primary/10" />
          <Skeleton className="h-4 w-28 bg-primary/10" />
        </div>
      ) : (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 rise">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" strokeWidth={2} />
            <span className="text-sm text-muted-foreground">累计收益</span>
          </div>
          <p className="text-3xl font-bold text-primary tnum mb-4">
            {formatMoney(data?.totalEarnings)}
          </p>
          <div className="pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">待结算</p>
            <p className="text-lg font-semibold text-status-completed tnum">
              {formatMoney(data?.availableWithdraw)}
            </p>
          </div>
        </div>
      )}

      {/* 收益说明 */}
      <div
        className="bg-card rounded-xl border border-border p-4 rise"
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-foreground">收益说明</h3>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <ArrowUpRight
              className="w-3.5 h-3.5 inline-block text-primary mr-1"
              strokeWidth={2}
            />
            平台每单抽取{' '}
            <span className="text-foreground font-medium">10%</span>{' '}
            作为手续费
          </p>
          <p>
            <ArrowUpRight
              className="w-3.5 h-3.5 inline-block text-primary mr-1"
              strokeWidth={2}
            />
            跑腿员获得{' '}
            <span className="text-foreground font-medium">90%</span> 的订单金额
          </p>
          <p>
            <ArrowUpRight
              className="w-3.5 h-3.5 inline-block text-primary mr-1"
              strokeWidth={2}
            />
            订单完成后手续费计入平台收益
          </p>
          <p>
            <ArrowUpRight
              className="w-3.5 h-3.5 inline-block text-primary mr-1"
              strokeWidth={2}
            />
            退款订单手续费会相应扣减
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminEarningsPage;

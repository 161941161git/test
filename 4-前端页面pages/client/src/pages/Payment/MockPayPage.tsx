import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import { payment } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoneyPlain } from '@client/src/utils/format';
import type { PaymentOrder } from '@shared/api.interface';

const MockPayPage: React.FC = () => {
  const navigate = useNavigate();
  const { payNo } = useParams<{ payNo: string }>();

  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [payOrder, setPayOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!payNo) return;
    // 模拟加载支付单信息（实际从 URL 参数或查询接口获取）
    loadPaymentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payNo]);

  const loadPaymentInfo = async () => {
    // 由于没有单独的支付单查询接口，用 transactions 列表找一下
    // 这里简单展示 payNo，金额在 URL 中不传，从上下文获取
    // 实际项目中会有 payment detail 接口
    setLoading(false);
  };

  const handleMockSuccess = async () => {
    if (!payNo || submitting) return;
    setSubmitting(true);
    try {
      const res = await payment.mockSuccess(payNo);
      if (res.success && res.data.status === 'paid') {
        setPayOrder(res.data);
        toast.success('支付成功！');
        if (orderId) {
          navigate(`/order/${orderId}`, { replace: true });
        } else {
          navigate(-1);
        }
      } else {
        toast.error(res.message || '模拟支付失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '模拟支付失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileLayout title="模拟支付" showBack showTabBar={false}>
      <div className="p-4 space-y-4 pb-36">
        {/* Mock 标识 */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700">
              模拟支付（未接入真实通道）
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">
              点击下方按钮即可模拟支付成功，仅用于测试流程
            </p>
          </div>
        </div>

        {/* 支付信息卡片 */}
        <div className="bg-card rounded-xl border border-border p-5 rise">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">支付金额</p>
            <p className="text-4xl font-bold text-foreground tnum">
              ¥{formatMoneyPlain(payOrder?.amountFen ? payOrder.amountFen / 100 : '')}
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">支付单号</span>
              <span className="text-foreground font-medium tnum">{payNo || '--'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">支付方式</span>
              <span className="text-foreground font-medium">模拟支付</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">支付状态</span>
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-status-pending/10 text-status-pending">
                待支付
              </span>
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-card/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p>模拟支付说明：</p>
              <p className="mt-1">1. 当前环境未接入真实微信/支付宝通道</p>
              <p className="mt-0.5">2. 点击「模拟支付成功」将直接标记为已支付</p>
              <p className="mt-0.5">3. 支付成功后订单进入「等待接单」状态</p>
            </div>
          </div>
        </div>
      </div>

      {/* 底部固定按钮 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border p-4 safe-bottom">
        <Button
          className="w-full bg-amber-500 hover:bg-amber-500/90 text-white text-base font-medium"
          onClick={handleMockSuccess}
          disabled={submitting || loading}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            '模拟支付成功'
          )}
        </Button>
      </div>
    </MobileLayout>
  );
};

export default MockPayPage;

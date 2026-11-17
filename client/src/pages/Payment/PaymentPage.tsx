import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { orders as ordersApi, payment } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoneyPlain } from '@client/src/utils/format';
import type { Order, QrConfig } from '@shared/api.interface';
import { PAYMENT_STATUS_LABELS } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const DEFAULT_QR_URL = '/pay-qr.jpg';

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [qrConfig, setQrConfig] = useState<QrConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const loadData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [orderRes, qrRes] = await Promise.all([
        ordersApi.detail(orderId),
        payment.getQrConfig(),
      ]);
      if (orderRes.success) {
        setOrder(orderRes.data);
      } else {
        toast.error(orderRes.message || '加载订单信息失败');
      }
      if (qrRes.success) {
        setQrConfig(qrRes.data);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载订单信息失败'));
    } finally {
      setLoading(false);
    }
  };

  const qrUrl = qrConfig?.wechatQrUrl || DEFAULT_QR_URL;
  const payeeName = qrConfig?.payeeNickname || '平台（十二）';
  const amount = formatMoneyPlain(order?.totalAmount);
  const paymentStatus = order?.paymentStatus;
  const isPendingVerify = paymentStatus === 'pending_verify';
  const isPaid = paymentStatus === 'paid';
  const showPaidButton = !isPendingVerify && !isPaid;

  const handleMarkPaid = async () => {
    if (!orderId || submitting) return;
    setSubmitting(true);
    try {
      const res = await ordersApi.markPaid(orderId);
      if (res.success) {
        toast.success('已标记付款，等待平台核对');
        setConfirmOpen(false);
        navigate(`/order/${orderId}`);
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLater = () => {
    if (orderId) {
      navigate(`/order/${orderId}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <MobileLayout title="支付订单" showBack showTabBar={false}>
      <div className="p-4 space-y-4 pb-40">
        {/* 支付状态标签 */}
        {isPendingVerify && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 rise">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">
              {PAYMENT_STATUS_LABELS.pending_verify} · 已提交，等待平台核对
            </span>
          </div>
        )}
        {isPaid && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 rise">
            <CheckCircle2 className="w-4 h-4 text-primary" strokeWidth={2} />
            <span className="text-sm font-medium text-primary">
              {PAYMENT_STATUS_LABELS.paid} · 已到账
            </span>
          </div>
        )}

        {/* 金额展示 */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center rise">
          <p className="text-sm text-muted-foreground mb-2">应付金额</p>
          <p className="text-4xl font-bold text-primary tnum">
            ¥{loading ? '--' : amount}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            订单号：{order?.orderNo || ''}
          </p>
        </div>

        {/* 收款码卡片 */}
        <div className="bg-card rounded-xl border border-border p-5 text-center rise shadow-2xs">
          <p className="text-sm font-medium text-foreground mb-4">微信扫码支付</p>
          <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="p-2 bg-white rounded-xl border border-border/60 hover:border-primary/30 transition-colors"
              aria-label="点击放大收款码"
            >
              <Image
                src={qrUrl}
                alt="微信收款码"
                className="w-60 h-60 object-contain rounded-lg"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== DEFAULT_QR_URL) {
                    target.src = DEFAULT_QR_URL;
                  }
                }}
              />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            收款方：{payeeName} · 微信扫码支付
          </p>
        </div>

        {/* 说明文字 */}
        <div className="bg-card/50 rounded-xl p-4 border border-border/50 space-y-2">
          <p className="text-xs text-foreground leading-relaxed">
            请用微信扫码支付 <span className="font-semibold text-primary tnum">¥{amount}</span>，付完款后点下方按钮
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            平台代收后按 90%/10% 结算：跑腿员得 90%，平台抽 10% 手续费
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary/70" />
            付款后由平台人工核对到账，一般 5 分钟内完成
          </p>
        </div>

        {/* 温馨提示 */}
        <div className="flex items-start gap-2 px-1">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            请认准收款方名称，转账时备注订单号后四位方便核对。恶意点击「已付款」会被取消订单并影响信用。
          </p>
        </div>
      </div>

      {/* 底部固定按钮 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border p-4 safe-bottom z-20 space-y-2">
        {showPaidButton ? (
          <>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base font-medium h-11"
              onClick={() => setConfirmOpen(true)}
              disabled={loading || submitting}
            >
              我已完成付款
            </Button>
            <Button
              variant="outline"
              className="w-full text-base font-medium h-11"
              onClick={handleLater}
              disabled={submitting}
            >
              稍后付款
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/5 border border-primary/20 py-3">
              {isPendingVerify && (
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              {isPaid && (
                <CheckCircle2 className="w-4 h-4 text-primary" strokeWidth={2} />
              )}
              <span className="text-sm font-medium text-primary">
                {isPendingVerify
                  ? '已提交，等待平台核对'
                  : '已到账'}
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full text-base font-medium h-11"
              onClick={handleLater}
            >
              返回订单详情
            </Button>
          </>
        )}
      </div>

      {/* 二次确认弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认已付款？</DialogTitle>
            <DialogDescription>
              请确认已向收款码转账 <span className="font-semibold text-primary tnum">¥{amount}</span>
              ，恶意点击会被取消订单。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              再想想
            </Button>
            <Button onClick={() => void handleMarkPaid()} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认已付款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片放大预览 */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-label="收款码大图预览"
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setPreviewOpen(false)}
            aria-label="关闭预览"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
          <Image
            src={qrUrl}
            alt="微信收款码"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </MobileLayout>
  );
};

export default PaymentPage;

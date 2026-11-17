import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Phone, MessageCircle, CheckCircle, ArrowLeft, AlertCircle, Upload, Trash2, X, QrCode } from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { logger } from '@client/src/lib/shims/logger';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Image } from '@client/src/components/ui/image';
import { useUser } from '@client/src/store/userStore';
import { users } from '@client/src/api/modules';
import type { RunnerApplication } from '@shared/api.interface';

export default function ApplyRunnerPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [latestApp, setLatestApp] = useState<RunnerApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  const handleUploadQr = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    setUploadingQr(true);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (error) {
        const wrapped = error as { code?: unknown; status?: unknown; originalError?: unknown };
        const original = typeof wrapped.originalError === 'object' && wrapped.originalError !== null
          ? (wrapped.originalError as { code?: unknown; status?: unknown })
          : {};
        const is429 = [wrapped.code, wrapped.status, original.code, original.status].some(
          (value) => value === 429 || value === '429',
        );
        if (is429) logger.error('文件上传请求受限（429）', error);
        throw error;
      }
      if (!data) throw new Error('上传失败：未返回数据');
      setPaymentQrUrl(data.download_url || '');
      toast.success('收款码上传成功');
    } catch (err) {
      logger.error('收款码上传失败', err);
      const e = err as { message?: string };
      toast.error(e.message || '上传失败，请重试');
    } finally {
      setUploadingQr(false);
    }
  };

  const handleDeleteQr = () => {
    setPaymentQrUrl('');
  };

  useEffect(() => {
    if (!user) return;
    setLoadingApp(true);
    void users.getLatestApplication(user.id).then((resp) => {
      if (resp.success && resp.data) {
        setLatestApp(resp.data);
        if (resp.data.status === 'pending') {
          setSubmitted(true);
        }
      }
      setLoadingApp(false);
    }).catch(() => {
      setLoadingApp(false);
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error('请先登录');
      navigate('/login');
      return;
    }

    if (!name.trim()) {
      toast.error('请填写姓名');
      return;
    }
    if (!wechatId.trim()) {
      toast.error('请填写微信号，方便后续提现哦');
      return;
    }
    if (!paymentQrUrl.trim()) {
      toast.error('请上传你的收款码，方便平台给你结款');
      return;
    }

    setSubmitting(true);
    try {
      const res = await users.applyRunner({
        userId: user.id,
        name: name.trim(),
        phone,
        wechatId: wechatId.trim(),
        paymentQrUrl: paymentQrUrl.trim(),
      });

      if (res.success) {
        setUser(res.data);
        setSubmitted(true);
        toast.success('申请已提交，等待平台审核');
      } else {
        toast.error(res.message || '申请失败');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || '申请失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 提交成功后的状态页
  if (submitted) {
    return (
      <MobileLayout title="申请已提交" showBack showTabBar={false}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-20 h-20 rounded-full bg-status-completed/10 flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-status-completed" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">申请已提交</h2>
          <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
            等待平台审核，通过后即可接单赚钱～
            <br />
            审核结果会通过消息通知你，请留意
          </p>
          <Button
            className="w-full max-w-[200px] h-11"
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={2} />
            返回我的
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const isRejected = latestApp?.status === 'rejected';

  return (
    <MobileLayout title="成为跑腿员" showBack showTabBar={false}>
      <div className="p-4 space-y-4">
        {/* 被拒绝提示 */}
        {isRejected && latestApp.rejectReason && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-sm font-semibold text-destructive mb-1">上次申请未通过</p>
              <p className="text-xs text-destructive/80 leading-relaxed">
                拒绝原因：{latestApp.rejectReason}
              </p>
            </div>
          </div>
        )}

        {/* Intro Card */}
        <div className="bg-card rounded-xl p-5 shadow-xs border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-2">成为跑腿员</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            填写信息，审核通过后即可接单赚钱～
            <br />
            利用课余时间，顺便赚点奶茶钱 🧋
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-xl p-5 shadow-xs border border-border space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              姓名
            </label>
            <Input
              type="text"
              placeholder="请输入姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              手机号
            </label>
            <Input
              type="tel"
              value={phone}
              disabled
              className="h-11 bg-muted/50 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">手机号不可修改</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              微信号 <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="请输入微信号，用于提现到账"
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
              maxLength={50}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              提现会通过微信转账给你，请确保微信号正确
            </p>
          </div>

          {/* 收款码上传 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <QrCode className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
              收款码 <span className="text-destructive">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadQr(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            {!paymentQrUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingQr}
                className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-muted/30 disabled:opacity-60"
              >
                {uploadingQr ? (
                  <>
                    <Upload className="w-6 h-6 animate-bounce" strokeWidth={2} />
                    <span className="text-xs">上传中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" strokeWidth={2} />
                    <span className="text-xs">点击上传收款码</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewImage(paymentQrUrl)}
                  className="relative w-24 h-24 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted/30"
                  aria-label="预览收款码大图"
                >
                  <Image
                    src={paymentQrUrl}
                    alt="收款码"
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="flex-1 flex flex-col justify-center gap-2 pt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    上传微信或支付宝收款码截图，方便平台给你结款
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteQr}
                    className="w-24 h-8 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                    删除重传
                  </Button>
                </div>
              </div>
            )}
            {!paymentQrUrl && (
              <p className="text-xs text-muted-foreground">
                上传微信或支付宝收款码截图，方便平台给你结款
              </p>
            )}
          </div>
        </div>

        {/* 图片预览 */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
            role="button"
            aria-label="关闭预览"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              aria-label="关闭"
            >
              <X className="w-7 h-7" strokeWidth={2} />
            </button>
            <Image
              src={previewImage}
              alt="收款码预览"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            className="w-full h-12 text-base rounded-lg"
            onClick={handleSubmit}
            disabled={submitting || loadingApp}
          >
            {submitting ? '提交中...' : isRejected ? '重新提交申请' : '提交申请'}
          </Button>
        </div>

        {/* Tips */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>· 申请通过后即可接单，每单赚取跑腿费的90%</p>
          <p>· 跑腿费可随时申请提现，审核后打款到微信</p>
          <p>· 请保持手机畅通，有新订单会及时通知你</p>
        </div>
      </div>
    </MobileLayout>
  );
}

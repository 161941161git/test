import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Package, CloudRain, Zap } from 'lucide-react';

import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Switch } from '@client/src/components/ui/switch';
import { Label } from '@client/src/components/ui/label';
import { useUser } from '@client/src/store/userStore';
import { orders } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, validatePhone } from '@client/src/utils/format';
import type { PackageSize } from '@shared/api.interface';
import { PACKAGE_SIZES, PACKAGE_SIZE_LABELS } from '@shared/api.interface';

interface PackageForm {
  trackingNo: string;
  pickupPhone: string;
  size: PackageSize;
}

const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const [packages, setPackages] = useState<PackageForm[]>([
    { trackingNo: '', pickupPhone: user?.phone || '', size: 'small' },
  ]);
  const [isRainy, setIsRainy] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [dormitory, setDormitory] = useState(user?.dormitory || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // 计费计算
  const feeDetail = useMemo(() => {
    const count = packages.length;
    const baseFee = count <= 2 ? 1.0 : 1.0 + (count - 2) * 0.5;
    const extraFee = count > 2 ? (count - 2) * 0.5 : 0;
    const rainyFee = isRainy ? 0.5 : 0;
    const urgentFee = isUrgent ? 0.5 : 0;
    const total = baseFee + rainyFee + urgentFee;
    return {
      baseFee: baseFee.toFixed(2),
      extraFee: extraFee.toFixed(2),
      rainyFee: rainyFee.toFixed(2),
      urgentFee: urgentFee.toFixed(2),
      total: total.toFixed(2),
    };
  }, [packages.length, isRainy, isUrgent]);

  const addPackage = () => {
    setPackages((prev) => [
      ...prev,
      { trackingNo: '', pickupPhone: user?.phone || '', size: 'small' },
    ]);
  };

  const removePackage = (index: number) => {
    if (packages.length <= 1) {
      toast.warning('至少需要一个包裹哦');
      return;
    }
    setPackages((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: keyof PackageForm, value: string) => {
    setPackages((prev) =>
      prev.map((pkg, i) => (i === index ? { ...pkg, [field]: value } : pkg)),
    );
  };

  const validate = (): boolean => {
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      if (!pkg.trackingNo.trim()) {
        toast.error(`第${i + 1}个包裹的快递单号不能为空`);
        return false;
      }
      if (!validatePhone(pkg.pickupPhone)) {
        toast.error(`第${i + 1}个包裹的取件手机号格式不正确`);
        return false;
      }
    }
    if (!dormitory.trim()) {
      toast.error('请填写宿舍号');
      return false;
    }
    if (!validatePhone(contactPhone)) {
      toast.error('联系电话格式不正确');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const resp = await orders.create({
        buyerId: user.id,
        packages: packages.map((p) => ({
          trackingNo: p.trackingNo.trim(),
          pickupPhone: p.pickupPhone,
          size: p.size,
        })),
        isRainy,
        isUrgent,
        dormitory: dormitory.trim(),
        contactPhone,
        remark: remark.trim(),
      });
      if (resp.success) {
        toast.success('订单已创建，请完成支付');
        navigate(`/buyer/payment/${resp.data.id}`);
      } else {
        toast.error(resp.message || '发布失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '发布失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <MobileLayout
      title="发布代取"
      showBack
      showTabBar={false}
    >
      <div className="p-4 pb-36 space-y-4">
        {/* 包裹列表 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4" strokeWidth={2} />
              包裹信息
            </h2>
            <span className="text-sm text-muted-foreground">
              共 {packages.length} 件
            </span>
          </div>

          {packages.map((pkg, index) => (
            <div
              key={index}
              className="bg-secondary/50 rounded-xl p-4 space-y-3 border border-border/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  包裹 {index + 1}
                </span>
                <button
                  onClick={() => removePackage(index)}
                  className="text-muted-foreground hover:text-destructive btn-press p-1"
                  aria-label={`删除包裹 ${index + 1}`}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`tracking-${index}`} className="text-xs text-muted-foreground">
                  快递单号 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`tracking-${index}`}
                  placeholder="请输入快递单号"
                  value={pkg.trackingNo}
                  onChange={(e) => updatePackage(index, 'trackingNo', e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`phone-${index}`} className="text-xs text-muted-foreground">
                  取件手机号 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`phone-${index}`}
                  placeholder="请输入取件手机号"
                  value={pkg.pickupPhone}
                  onChange={(e) => updatePackage(index, 'pickupPhone', e.target.value)}
                  maxLength={11}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">规格</Label>
                <div className="flex gap-2">
                  {PACKAGE_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updatePackage(index, 'size', size)}
                      className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all btn-press ${
                        pkg.size === size
                          ? 'bg-primary text-primary-foreground border border-primary-border'
                          : 'bg-card text-muted-foreground border border-border hover:border-primary/30'
                      }`}
                    >
                      {PACKAGE_SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-dashed"
            onClick={addPackage}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            添加包裹
          </Button>
        </div>

        {/* 加价项 */}
        <div className="bg-card rounded-xl p-4 border border-border space-y-4">
          <h3 className="text-base font-semibold text-foreground">加价服务</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CloudRain className="w-4 h-4 text-primary" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">下雨天加价</p>
                <p className="text-xs text-muted-foreground">雨天路滑，多给点辛苦费</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-warning tnum font-medium">+¥0.50</span>
              <Switch checked={isRainy} onCheckedChange={setIsRainy} />
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-warning" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">急送加价</p>
                <p className="text-xs text-muted-foreground">加急优先配送，马上出发</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-warning tnum font-medium">+¥0.50</span>
              <Switch checked={isUrgent} onCheckedChange={setIsUrgent} />
            </div>
          </div>
        </div>

        {/* 送达信息 */}
        <div className="bg-card rounded-xl p-4 border border-border space-y-4">
          <h3 className="text-base font-semibold text-foreground">送达信息</h3>

          <div className="space-y-2">
            <Label htmlFor="dormitory" className="text-xs text-muted-foreground">
              宿舍号 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dormitory"
              placeholder="如：3号楼 302"
              value={dormitory}
              onChange={(e) => setDormitory(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="text-xs text-muted-foreground">
              联系电话 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactPhone"
              placeholder="请输入联系电话"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={11}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remark" className="text-xs text-muted-foreground">
              备注
            </Label>
            <Input
              id="remark"
              placeholder="选填，有特殊要求写在这里"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </div>

      {/* 底部费用明细 + 提交按钮 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-30 safe-bottom">
        <div className="p-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>基础跑腿费</span>
            <span className="tnum">{formatMoney(feeDetail.baseFee)}</span>
          </div>
          {packages.length > 2 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>超件加价（{packages.length - 2}件）</span>
              <span className="tnum">+{formatMoney(feeDetail.extraFee)}</span>
            </div>
          )}
          {isRainy && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>下雨天加价</span>
              <span className="tnum">+{formatMoney(feeDetail.rainyFee)}</span>
            </div>
          )}
          {isUrgent && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>急送加价</span>
              <span className="tnum">+{formatMoney(feeDetail.urgentFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-sm font-medium text-foreground">合计</span>
            <span className="text-xl font-bold text-primary tnum">
              {formatMoney(feeDetail.total)}
            </span>
          </div>
          <Button
            size="lg"
            className="w-full h-11 text-base rounded-xl mt-1"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交订单'}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default CreateOrderPage;

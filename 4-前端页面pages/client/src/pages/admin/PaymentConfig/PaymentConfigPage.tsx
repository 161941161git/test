import React from 'react';
import {
  ShieldCheck,
  CreditCard,
  FileText,
  Info,
  Lock,
} from 'lucide-react';

import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';

const PaymentConfigPage: React.FC = () => {
  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 当前模式提示卡片 */}
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              当前模式
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              人工收款码模式（平台开发者线下收款，系统只记账）
            </p>
          </div>
        </div>
      </div>

      {/* 说明文字 */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm rise">
        <p className="text-sm text-foreground mb-3">
          取得营业执照与商户号后，可填写以下信息切换为官方分账模式：
        </p>

        {/* 微信支付配置 */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard
                className="w-4 h-4 text-primary"
                strokeWidth={2}
              />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              微信支付
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                微信商户号 (mchId)
              </Label>
              <Input
                value=""
                disabled
                placeholder="待填写"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                微信 APIv3 密钥
              </Label>
              <Input
                type="password"
                value=""
                disabled
                placeholder="待填写"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                微信证书序列号
              </Label>
              <Input
                value=""
                disabled
                placeholder="待填写"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                微信商户私钥
              </Label>
              <Textarea
                value=""
                disabled
                placeholder="待填写"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* 支付宝配置 */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText
                className="w-4 h-4 text-primary"
                strokeWidth={2}
              />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              支付宝
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                支付宝 AppID
              </Label>
              <Input
                value=""
                disabled
                placeholder="待填写"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                支付宝应用私钥
              </Label>
              <Textarea
                value=""
                disabled
                placeholder="待填写"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="w-5 h-5 text-muted-foreground"
                strokeWidth={2}
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  支付模式
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  当前：人工收款码模式
                </p>
              </div>
            </div>
            <Switch
              checked={false}
              disabled
              aria-label="支付模式（暂不可切换）"
            />
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-start gap-2">
            <Lock
              className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              当前为人工收款码模式，所有资金由开发者线下处理。如需切换官方分账模式，请先取得相关资质并联系技术支持。
            </p>
          </div>
        </div>
      </div>

      {/* 禁用的保存按钮 */}
      <Button disabled className="w-full">
        <Lock className="w-4 h-4 mr-2" strokeWidth={2} />
        模式暂不可切换
      </Button>
    </div>
  );
};

export default PaymentConfigPage;

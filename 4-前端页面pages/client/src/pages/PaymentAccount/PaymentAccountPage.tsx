import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Loader2, Check, Plus } from 'lucide-react';

import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { payment } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { PAY_CHANNEL_LABELS } from '@shared/api.interface';
import type { PaymentAccount, PayChannel, PaymentConfig } from '@shared/api.interface';

const PaymentAccountPage: React.FC = () => {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PayChannel | null>(null);
  const [accountNo, setAccountNo] = useState('');
  const [realName, setRealName] = useState('');
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);

  const isReal = payConfig?.paymentMode === 'real';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, configRes] = await Promise.all([
        payment.getAccounts(),
        payment.getConfig(),
      ]);
      if (accountsRes.success) {
        setAccounts(accountsRes.data);
      }
      if (configRes.success) {
        setPayConfig(configRes.data);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载收款账户失败'));
    } finally {
      setLoading(false);
    }
  };

  const getAccountByChannel = (ch: PayChannel): PaymentAccount | undefined => {
    return accounts.find((a) => a.channel === ch);
  };

  const startEdit = (ch: PayChannel) => {
    const existing = getAccountByChannel(ch);
    setEditingChannel(ch);
    setAccountNo(existing?.accountNo || '');
    setRealName(existing?.realName || '');
  };

  const cancelEdit = () => {
    setEditingChannel(null);
    setAccountNo('');
    setRealName('');
  };

  const handleSave = async () => {
    if (!editingChannel || saving) return;

    if (!accountNo.trim()) {
      toast.error('请填写账号');
      return;
    }
    if (editingChannel === 'alipay_qr' && !realName.trim()) {
      toast.error('请填写真实姓名');
      return;
    }

    setSaving(true);
    try {
      const res = await payment.saveAccount({
        channel: editingChannel,
        accountNo: accountNo.trim(),
        realName: editingChannel === 'alipay_qr' ? realName.trim() : undefined,
      });
      if (res.success) {
        toast.success('保存成功');
        setAccounts((prev) => {
          const idx = prev.findIndex((a) => a.channel === editingChannel);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data;
            return next;
          }
          return [...prev, res.data];
        });
        cancelEdit();
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  };

  const displayChannels: PayChannel[] = isReal
    ? ['wechat_qr', 'alipay_qr']
    : ['wechat_qr', 'alipay_qr'];

  return (
    <MobileLayout title="收款账户" showBack showTabBar={false}>
      <div className="p-4 space-y-4">
        {/* 顶部说明 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">收款账户管理</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                绑定收款账户后，提现金额将转到对应账户
              </p>
            </div>
          </div>
        </div>

        {/* 账户列表 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i: number) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayChannels.map((ch) => {
              const account = getAccountByChannel(ch);
              const isEditing = editingChannel === ch;

              return (
                <div
                  key={ch}
                  className="bg-card rounded-xl border border-border p-4 rise"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${
                        ch === 'wechat_qr' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                    >
                      {ch === 'wechat_qr' ? '微' : '支'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {PAY_CHANNEL_LABELS[ch]}
                      </p>
                      {account && !isEditing && (
                        <p className="text-xs text-muted-foreground mt-0.5 tnum truncate">
                          {account.accountNo}
                          {account.realName && ` · ${account.realName}`}
                        </p>
                      )}
                      {!account && !isEditing && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          未绑定
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(ch)}
                      >
                        {account ? '修改' : (
                          <>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            绑定
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* 编辑表单 */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {ch === 'wechat_qr' && (
                        <div className="space-y-2">
                          <Label htmlFor="wechat-account" className="text-xs text-muted-foreground">
                            微信号
                            {isReal && (
                              <span className="text-amber-600 ml-1">
                                （真实模式需 openid）
                              </span>
                            )}
                          </Label>
                          <Input
                            id="wechat-account"
                            placeholder="请输入微信号"
                            value={accountNo}
                            onChange={(e) => setAccountNo(e.target.value)}
                            className="h-10"
                          />
                        </div>
                      )}

                      {ch === 'alipay_qr' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="alipay-account" className="text-xs text-muted-foreground">
                              支付宝账号
                            </Label>
                            <Input
                              id="alipay-account"
                              placeholder="请输入支付宝账号"
                              value={accountNo}
                              onChange={(e) => setAccountNo(e.target.value)}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="alipay-name" className="text-xs text-muted-foreground">
                              真实姓名
                            </Label>
                            <Input
                              id="alipay-name"
                              placeholder="请输入真实姓名"
                              value={realName}
                              onChange={(e) => setRealName(e.target.value)}
                              className="h-10"
                            />
                          </div>
                        </>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          取消
                        </Button>
                        <Button
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              保存中
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              保存
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 底部说明 */}
        <div className="bg-card/50 rounded-xl p-4 border border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">
            温馨提示：请确保收款账户信息准确无误，提现申请审核通过后将直接打款至对应账户，打款失败会退回余额。
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default PaymentAccountPage;

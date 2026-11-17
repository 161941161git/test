import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardList,
  TrendingUp,
  LogOut,
  ChevronRight,
  RefreshCw,
  Wallet,
  UserCheck,
  CreditCard,
  MessageSquare,
  Clock,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MobileLayout } from '@client/src/components/MobileLayout';
import { Button } from '@client/src/components/ui/button';
import { useUser } from '@client/src/store/userStore';
import { users } from '@client/src/api/modules';
import { formatMoney } from '@client/src/utils/format';
import type { RunnerApplication } from '@shared/api.interface';
import { RUNNER_APPLY_STATUS_LABELS } from '@shared/api.interface';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, clearUser } = useUser();
  const [switching, setSwitching] = useState(false);
  const [latestApp, setLatestApp] = useState<RunnerApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingApp(true);
    void users.getLatestApplication(user.id).then((resp) => {
      if (resp.success) {
        setLatestApp(resp.data);
      }
      setLoadingApp(false);
    }).catch(() => {
      setLoadingApp(false);
    });
  }, [user]);

  const handleSwitchRole = async () => {
    if (!user || switching) return;
    const nextRole = user.userRole === 'buyer' ? 'runner' : 'buyer';
    setSwitching(true);
    try {
      const res = await users.switchRole(user.id, nextRole);
      if (res.success) {
        setUser(res.data);
        toast.success(`已切换为${nextRole === 'buyer' ? '买家' : '跑腿员'}身份`);
      } else {
        toast.error(res.message || '切换失败');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || '切换失败，请稍后重试');
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const runnerStatus = user?.runnerStatus ?? 'none';

  // 兼职申请状态展示（非跑腿员时显示）
  const renderRunnerStatusCard = () => {
    if (!user || user.isRunner) return null;

    const status = runnerStatus;

    if (status === 'none') return null;

    let statusConfig: {
      label: string;
      colorClass: string;
      bgClass: string;
      icon: React.ElementType;
      desc: string;
      action?: React.ReactNode;
    };

    switch (status) {
      case 'pending':
        statusConfig = {
          label: RUNNER_APPLY_STATUS_LABELS.pending,
          colorClass: 'text-warning',
          bgClass: 'bg-warning/10',
          icon: Clock,
          desc: '申请已提交，等待平台审核，通过后即可接单～',
        };
        break;
      case 'rejected':
        statusConfig = {
          label: RUNNER_APPLY_STATUS_LABELS.rejected,
          colorClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          icon: XCircle,
          desc: latestApp?.rejectReason
            ? `拒绝原因：${latestApp.rejectReason}`
            : '申请未通过，可重新提交',
          action: (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => navigate('/apply-runner')}
            >
              重新申请
            </Button>
          ),
        };
        break;
      default:
        return null;
    }

    const IconComp = statusConfig.icon;

    return (
      <div
        className={clsx(
          'rounded-xl border p-4 shadow-sm rise',
          status === 'rejected'
            ? 'bg-destructive/5 border-destructive/20'
            : 'bg-warning/5 border-warning/20',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              statusConfig.bgClass,
            )}
          >
            <IconComp
              className={clsx('w-5 h-5', statusConfig.colorClass)}
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={clsx(
                  'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                  statusConfig.bgClass,
                  statusConfig.colorClass,
                )}
              >
                {statusConfig.label}
              </span>
              <span className="text-xs text-muted-foreground">兼职申请</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {statusConfig.desc}
            </p>
            {statusConfig.action && (
              <div className="mt-3">{statusConfig.action}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const menuItems: {
    key: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    hint?: string;
  }[] = [
    {
      key: 'orders',
      icon: ClipboardList,
      label: '我的订单',
      onClick: () => navigate('/orders'),
    },
    ...(user?.isRunner
      ? [
          {
            key: 'earnings',
            icon: TrendingUp,
            label: '收益明细',
            onClick: () => navigate('/earnings'),
          },
          {
            key: 'payment-account',
            icon: CreditCard,
            label: '收款账户',
            onClick: () => navigate('/payment-account'),
          },
          {
            key: 'settlements',
            icon: MessageSquare,
            label: '结算会话',
            onClick: () => navigate('/settlements'),
          },
        ]
      : []),
    ...(user?.isRunner
      ? []
      : [
          {
            key: 'apply-runner',
            icon: UserCheck,
            label:
              runnerStatus === 'pending'
                ? '兼职申请审核中'
                : runnerStatus === 'rejected'
                  ? '重新申请跑腿员'
                  : '申请成为跑腿员',
            onClick: () => {
              if (runnerStatus === 'pending') {
                toast.info('申请正在审核中，请耐心等待～');
                return;
              }
              navigate('/apply-runner');
            },
            disabled: runnerStatus === 'pending',
            hint: runnerStatus === 'pending' ? '审核中' : undefined,
          },
        ]),
    {
      key: 'logout',
      icon: LogOut,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <MobileLayout title="我的" showTabBar>
      <div className="p-4 space-y-4">
        {/* 用户信息卡片 */}
        <div className="bg-card rounded-xl border border-border p-4 rise">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xl font-bold">
                {user?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {user?.name || '加载中'}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary flex-shrink-0">
                  {user?.userRole === 'runner' ? '跑腿员' : '买家'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {user?.phone || ''}
              </p>
              <p className="text-sm text-muted-foreground">
                {user?.dormitory || ''}
              </p>
            </div>
          </div>
          {user?.isRunner && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={handleSwitchRole}
              disabled={switching}
            >
              {switching ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              切换为{user.userRole === 'buyer' ? '跑腿员' : '买家'}
            </Button>
          )}
        </div>

        {/* 兼职申请状态卡片 */}
        {renderRunnerStatusCard()}

        {/* 累计收益卡（跑腿员显示） */}
        {user?.isRunner && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 rise">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">累计收益</span>
            </div>
            <p className="text-3xl font-bold text-primary tnum mb-4">
              {formatMoney(user.totalEarnings)}
            </p>
            <div className="flex items-center justify-between border-t border-primary/10 pt-3">
              <div className="text-center flex-1">
                <p className="text-lg font-semibold text-foreground tnum">
                  {user.totalOrders}
                </p>
                <p className="text-xs text-muted-foreground">完成单数</p>
              </div>
              <div className="w-px h-10 bg-primary/10" />
              <div className="text-center flex-1">
                <p className="text-lg font-semibold text-foreground tnum">
                  {formatMoney(user.balance)}
                </p>
                <p className="text-xs text-muted-foreground">待结算</p>
              </div>

            </div>
          </div>
        )}

        {/* 功能菜单 */}
        <div className="bg-card rounded-xl border border-border overflow-hidden rise">
          {menuItems.map((item, index) => {
            const IconComp = item.icon;
            const hasDivider = index < menuItems.length - 1;
            return (
              <button
                key={item.key}
                onClick={item.onClick}
                disabled={item.disabled}
                className={clsx(
                  'w-full flex items-center px-4 py-3 btn-press',
                  item.danger ? 'text-destructive' : 'text-foreground',
                  item.disabled && 'opacity-50 cursor-not-allowed',
                  hasDivider ? 'border-b border-border' : '',
                )}
              >
                <IconComp className="w-5 h-5 mr-3 flex-shrink-0" strokeWidth={2} />
                <span className="flex-1 text-left text-sm font-medium">
                  {item.label}
                </span>
                {item.hint && (
                  <span className="text-xs text-warning mr-2">{item.hint}</span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* 底部说明 */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          线下支付给跑腿同学
        </p>
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;

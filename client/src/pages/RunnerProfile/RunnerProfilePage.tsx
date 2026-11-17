import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardList,
  TrendingUp,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { useUser, setLastRole } from '@client/src/store/userStore';
import { users, support } from '@client/src/api/modules';
import LeaderboardCard from '@client/src/components/LeaderboardCard';
import { formatMoney } from '@client/src/utils/format';
import { getApiErrorMessage } from '@client/src/lib/api-error';

const RunnerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, clearUser } = useUser();
  const [switching, setSwitching] = useState(false);

  // 进入页面刷新用户信息
  useEffect(() => {
    if (!user) return;
    void users.getById(user.id).then((resp) => {
      if (resp.success) {
        setUser(resp.data);
      }
    }).catch(() => {
      // 静默失败，用本地缓存
    });
  }, [user?.id, setUser]);

  const handleContactSupport = async () => {
    if (!user) return;
    try {
      const resp = await support.getUserSession('runner_platform', user.id);
      if (resp.success && resp.data) {
        navigate(`/runner/support/${resp.data.id}`);
      } else {
        toast.error(resp.message || '客服会话获取失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '客服会话获取失败'));
    }
  };

  const handleSwitchToBuyer = async () => {
    if (!user || switching) return;
    setSwitching(true);
    try {
      const res = await users.switchRole(user.id, 'buyer');
      if (res.success) {
        setUser(res.data);
        setLastRole('buyer');
        toast.success('已切换为买家身份');
        navigate('/buyer/home');
      } else {
        toast.error(res.message || '切换失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '切换失败，请稍后重试'));
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const menuItems: {
    key: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }[] = [
    {
      key: 'orders',
      icon: ClipboardList,
      label: '我的接单',
      onClick: () => navigate('/runner/orders'),
    },
    {
      key: 'support',
      icon: MessageSquare,
      label: '联系客服',
      onClick: handleContactSupport,
    },
    {
      key: 'settings',
      icon: SettingsIcon,
      label: '设置',
      onClick: () => navigate('/runner/settings'),
    },
    {
      key: 'switch-buyer',
      icon: RefreshCw,
      label: '切换为买家',
      onClick: handleSwitchToBuyer,
    },
    {
      key: 'logout',
      icon: LogOut,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* 用户信息卡片 */}
      <div className="bg-card rounded-xl border border-border p-4 rise">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-lg font-bold">
              {user?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground truncate">
                {user?.name || '加载中'}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded bg-blue-100 text-blue-700 flex-shrink-0">
                接单员
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 tnum">
              {user?.phone || ''}
            </p>
            <p className="text-xs text-muted-foreground">
              微信号：{user?.wechatId || ''}
            </p>
          </div>
        </div>
      </div>

      {/* 收益卡片 */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 rise">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-foreground">我的收益</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">可提现</p>
            <p className="text-2xl font-bold text-primary tnum">
              {formatMoney(user?.balance)}
            </p>
          </div>
          <div className="w-px h-12 bg-primary/10" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">已结算</p>
            <p className="text-base font-semibold text-foreground tnum">
              {formatMoney(user?.totalEarnings)}
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => navigate('/runner/orders')}
            className="flex-1 py-2 bg-primary/10 text-primary text-xs font-medium rounded-lg btn-press"
          >
            我的接单
          </button>
          <button
            onClick={() => navigate('/runner/earnings')}
            className="flex-1 py-2 bg-primary/10 text-primary text-xs font-medium rounded-lg btn-press"
          >
            收益明细
          </button>
        </div>
      </div>

      {/* 接单排行榜 */}
      <div className="rise">
        <LeaderboardCard highlightUserId={user?.id} limit={10} />
      </div>

      {/* 收款码入口 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden rise">
        <button
          onClick={() => navigate('/runner/payment-account')}
          className="w-full flex items-center px-4 py-3 btn-press"
        >
          <CreditCard className="w-5 h-5 mr-3 flex-shrink-0 text-primary" strokeWidth={2} />
          <span className="flex-1 text-left text-sm font-medium text-foreground">
            我的收款码
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      </div>

      {/* 功能菜单 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden rise">
        {menuItems.map((item, index) => {
          const IconComp = item.icon;
          const hasDivider = index < menuItems.length - 1;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={
                'w-full flex items-center px-4 py-3 btn-press ' +
                (item.danger ? 'text-destructive ' : 'text-foreground ') +
                (hasDivider ? 'border-b border-border' : '')
              }
            >
              <IconComp className="w-5 h-5 mr-3 flex-shrink-0" strokeWidth={2} />
              <span className="flex-1 text-left text-sm font-medium">
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RunnerProfilePage;

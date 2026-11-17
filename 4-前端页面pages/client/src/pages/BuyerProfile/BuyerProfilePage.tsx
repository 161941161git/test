import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardList,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useUser } from '@client/src/store/userStore';
import { users, support } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';

const BuyerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, clearUser } = useUser();

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
      const resp = await support.getUserSession('buyer_platform', user.id);
      if (resp.success && resp.data) {
        navigate(`/buyer/support/${resp.data.id}`);
      } else {
        toast.error(resp.message || '客服会话获取失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '客服会话获取失败'));
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
      label: '我的订单',
      onClick: () => navigate('/buyer/orders'),
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
      onClick: () => navigate('/buyer/settings'),
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
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded bg-green-100 text-green-700 flex-shrink-0">
                买家
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 tnum">
              {user?.phone || ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.dormitory || ''}
            </p>
          </div>
        </div>
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

      {/* 底部说明 */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        线下支付给跑腿同学
      </p>
    </div>
  );
};

export default BuyerProfilePage;

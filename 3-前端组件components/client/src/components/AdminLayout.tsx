import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { useAdmin } from '../store/userStore';
import { admin, clearAdminToken } from '../api/modules';

const navItems = [
  { key: 'dashboard', label: '看板', path: '/admin/dashboard' },
  { key: 'payment-verification', label: '收款核对', path: '/admin/payment-verification' },
  { key: 'runner-reviews', label: '兼职审核', path: '/admin/runner-reviews' },
  { key: 'refunds', label: '退款', path: '/admin/refunds' },
  { key: 'orders', label: '订单', path: '/admin/orders' },
  { key: 'users', label: '用户', path: '/admin/users' },
  { key: 'support', label: '消息', path: '/admin/support' },
  { key: 'earnings', label: '收益', path: '/admin/earnings' },
  { key: 'payment-config', label: '支付配置', path: '/admin/payment-config' },
];

const pageTitles: Record<string, string> = {
  dashboard: '数据看板',
  'payment-verification': '收款核对',
  'runner-reviews': '兼职审核',
  refunds: '退款管理',
  orders: '订单管理',
  users: '用户列表',
  support: '消息中心',
  earnings: '我的收益',
  'payment-config': '支付配置',
};

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin: adminUser, clearAdmin } = useAdmin();
  const [unreadCount, setUnreadCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [pendingRunnerCount, setPendingRunnerCount] = useState(0);
  const [pendingRefundCount, setPendingRefundCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从路径中提取当前页 key
  const currentKey = navItems.find((item) =>
    location.pathname.startsWith(item.path),
  )?.key;

  const pageTitle = currentKey ? pageTitles[currentKey] : '管理后台';

  const loadUnreadCount = useCallback(async () => {
    try {
      const [notifResp, dashResp, supportResp] = await Promise.all([
        admin.notifications({ pageSize: 1 }),
        admin.dashboard(),
        admin.support.list({ pageSize: 1 }).catch(() => null),
      ]);
      if (notifResp.success) {
        setUnreadCount(notifResp.data.unreadCount);
      }
      if (dashResp.success) {
        setPendingRunnerCount(dashResp.data.pendingRunnerApplications ?? 0);
        setPendingRefundCount(dashResp.data.pendingRefunds ?? 0);
      }
      if (supportResp && supportResp.success) {
        const total = supportResp.data.items.reduce(
          (sum: number, s: { unreadAdminCount: number }) => sum + (s.unreadAdminCount || 0),
          0,
        );
        setSupportUnreadCount(total);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!adminUser) {
      navigate('/admin/login', { replace: true });
      return;
    }
    void loadUnreadCount();
    // 30s 定时刷新
    timerRef.current = setInterval(() => {
      void loadUnreadCount();
    }, 30000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [adminUser, navigate, loadUnreadCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadUnreadCount]);

  const handleLogout = () => {
    clearAdmin();
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  };

  const handleNotifications = () => {
    navigate('/admin/notifications');
  };

  const handleNavClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const handleBack = () => {
    navigate('/admin/dashboard');
  };

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {/* 顶部标题栏 */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="h-12 flex items-center px-4 relative">
          <button
            onClick={handleBack}
            className="absolute left-2 p-2 -ml-2 text-foreground btn-press flex items-center gap-1"
            aria-label="返回看板"
          >
            <Home className="w-4 h-4" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate px-8">
            {pageTitle}
          </h1>
          <div className="absolute right-4 flex items-center gap-3">
            <button
              onClick={handleNotifications}
              className="relative p-1 text-foreground btn-press"
              aria-label="消息通知"
            >
              <Bell className="w-4 h-4" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[12px] font-bold flex items-center justify-center border-2 border-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="text-muted-foreground btn-press flex items-center gap-1 text-xs"
              aria-label="退出登录"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
              退出
            </button>
          </div>
        </div>

        {/* 顶部 tab 导航 */}
        <nav className="border-t border-border/50 overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max px-2">
            {navItems.map((item) => {
              const isActive = currentKey === item.key;
              const badge = item.key === 'runner-reviews'
                ? pendingRunnerCount
                : item.key === 'refunds'
                  ? pendingRefundCount
                  : item.key === 'support'
                    ? supportUnreadCount
                    : 0;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.path)}
                  className={clsx(
                    'relative px-4 py-2.5 text-sm font-medium whitespace-nowrap btn-press transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {badge > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[12px] font-bold align-middle">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto pb-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

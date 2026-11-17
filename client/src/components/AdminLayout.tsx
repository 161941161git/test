import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, Bell, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import { useAdmin } from '../store/userStore';
import { admin, clearAdminToken } from '../api/modules';
import { useDisplayMode, useIsDesktop, shellClassName } from '@client/src/lib/display-mode';

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
  const mode = useDisplayMode();
  const isDesktop = useIsDesktop();
  const isWide = isDesktop && mode === 'wide';
  const [unreadCount, setUnreadCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [pendingRunnerCount, setPendingRunnerCount] = useState(0);
  const [pendingRefundCount, setPendingRefundCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentKey = navItems.find((item) => location.pathname.startsWith(item.path))?.key;
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

  const badgeOf = (key: string): number => {
    if (key === 'runner-reviews') return pendingRunnerCount;
    if (key === 'refunds') return pendingRefundCount;
    if (key === 'support') return supportUnreadCount;
    return 0;
  };

  if (!adminUser) return null;

  /* ---------------- 电脑全屏：左侧竖向导航 + 宽内容区 ---------------- */
  if (isWide) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <aside className="w-60 shrink-0 border-r border-border bg-card/70 sticky top-0 h-screen flex flex-col">
          <div className="px-5 py-5 border-b border-border/70">
            <div className="text-sm font-semibold text-foreground">顺手捎 · 开发者后台</div>
            <div className="text-xs text-muted-foreground mt-1">{adminUser.username}</div>
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {navItems.map((item) => {
              const active = currentKey === item.key;
              const badge = badgeOf(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.path)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-5 py-2.5 text-sm transition-colors btn-press',
                    active
                      ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent',
                  )}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-destructive text-white text-[11px] font-bold">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="m-4 flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 btn-press"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            退出登录
          </button>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="h-14 flex items-center gap-3 px-6">
              <button
                onClick={handleBack}
                className="p-1.5 text-muted-foreground hover:text-foreground btn-press"
                aria-label="返回看板"
              >
                <Home className="w-4 h-4" strokeWidth={2} />
              </button>
              <h1 className="flex-1 text-base font-semibold text-foreground truncate">{pageTitle}</h1>
              <button
                onClick={handleNotifications}
                className="relative p-1.5 text-foreground btn-press"
                aria-label="消息通知"
              >
                <Bell className="w-4 h-4" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[12px] font-bold flex items-center justify-center border-2 border-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-10">
            <div className="w-full max-w-[1200px] mx-auto px-6 py-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* ---------------- 手机 / 小窗：原有单列布局 ---------------- */
  return (
    <div className={shellClassName(mode, isDesktop, 'relative')}>
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

        <nav className="border-t border-border/50 overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max px-2">
            {navItems.map((item) => {
              const isActive = currentKey === item.key;
              const badge = badgeOf(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.path)}
                  className={clsx(
                    'relative px-4 py-2.5 text-sm font-medium whitespace-nowrap btn-press transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
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

      <main className="flex-1 overflow-y-auto pb-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

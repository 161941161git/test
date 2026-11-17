import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { Home, ClipboardList, User } from 'lucide-react';
import { useUser, setLastRole, getLastRole } from '@client/src/store/userStore';
import { warmBuyerCache } from '@client/src/api/prefetch';

interface BuyerLayoutProps {
  title?: string;
  showTabBar?: boolean;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
}

const tabItems = [
  { key: 'home', label: '首页', icon: Home, path: '/buyer/home' },
  { key: 'orders', label: '订单', icon: ClipboardList, path: '/buyer/orders' },
  { key: 'profile', label: '我的', icon: User, path: '/buyer/profile' },
];

const tabPaths = tabItems.map((t) => t.path);

export const BuyerLayout: React.FC<BuyerLayoutProps> = ({
  title,
  showTabBar,
  rightAction,
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const { user } = useUser();

  // 未登录 → 跳登录
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // 记住买家身份
  useEffect(() => {
    if (user && getLastRole() !== 'buyer') {
      setLastRole('buyer');
    }
  }, [user]);

  // 首屏渲染后空闲预热列表数据，切标签时直接命中缓存
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => warmBuyerCache(user), 600);
    return () => clearTimeout(timer);
  }, [user]);

  const isTabPage =
    showTabBar !== undefined
      ? showTabBar
      : tabPaths.some(
          (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
        );

  const activeTab = tabItems.find((t) =>
    location.pathname === t.path || location.pathname.startsWith(t.path + '/'),
  )?.key;

  const showBack = !isTabPage;

  const handleTabClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const displayTitle = title || '顺手捎 · 校园代取';
  const content = children ?? outlet;

  // 未登录时渲染骨架
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="h-12 flex items-center px-4 relative">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="absolute left-2 p-2 -ml-2 text-foreground btn-press"
              aria-label="返回"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate px-8">
            {displayTitle}
          </h1>
          {rightAction && (
            <div className="absolute right-2">{rightAction}</div>
          )}
        </div>
      </header>

      <main className={clsx('flex-1 overflow-y-auto', isTabPage ? 'pb-16' : '')}>
        {content}
      </main>

      {isTabPage && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-20 safe-bottom">
          <div className="flex justify-around items-center h-14">
            {tabItems.map((item) => {
              const isActive = activeTab === item.key;
              const IconComp = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => handleTabClick(item.path)}
                  className={clsx(
                    'flex-1 flex flex-col items-center justify-center gap-0.5 py-1 btn-press',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <IconComp className="w-5 h-5" strokeWidth={2} />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default BuyerLayout;

import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Briefcase, ClipboardList, User, UserX } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { useUser, getLastRole, setLastRole } from '@client/src/store/userStore';
import { warmRunnerCache } from '@client/src/api/prefetch';
import { useDisplayMode, useIsDesktop, shellClassName, contentClassName } from '@client/src/lib/display-mode';

interface RunnerLayoutProps {
  title?: string;
}

const tabItems = [
  { key: 'hall', label: '大厅', icon: Briefcase, path: '/runner/hall' },
  { key: 'orders', label: '订单', icon: ClipboardList, path: '/runner/orders' },
  { key: 'profile', label: '我的', icon: User, path: '/runner/profile' },
];

const tabPaths = tabItems.map((t) => t.path);

const RunnerBlockedContent: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="h-12 flex items-center px-4 relative">
          <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate px-8">
            顺手捎 · 校园代取
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
          <UserX className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">你还不是接单员</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          申请成为接单员，审核通过后即可接单赚钱
        </p>
        <div className="w-full space-y-3">
          <Button
            className="w-full h-11"
            onClick={() => navigate('/apply-runner')}
          >
            申请成为接单员
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => navigate('/buyer/home')}
          >
            返回首页
          </Button>
        </div>
      </main>
    </div>
  );
};

export const RunnerLayout: React.FC<RunnerLayoutProps> = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const mode = useDisplayMode();
  const isDesktop = useIsDesktop();

  // 记住用户当前访问的身份
  useEffect(() => {
    if (user && user.isRunner && user.runnerStatus === 'approved') {
      if (getLastRole() !== 'runner') {
        setLastRole('runner');
      }
    }
  }, [user]);

  // 未登录 → 跳登录
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // 首屏渲染后空闲预热大厅/订单数据，切标签时直接命中缓存
  useEffect(() => {
    if (!user || !user.isRunner || user.runnerStatus !== 'approved') return;
    const timer = setTimeout(() => warmRunnerCache(user), 600);
    return () => clearTimeout(timer);
  }, [user]);

  const isTabPage = tabPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
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

  // 未登录时渲染骨架，避免闪烁
  if (!user) {
    return (
      <div className={shellClassName(mode, isDesktop)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  // 未通过审核 → 显示拦截页
  if (!user.isRunner || user.runnerStatus !== 'approved') {
    return <RunnerBlockedContent />;
  }

  return (
    <div className={shellClassName(mode, isDesktop, 'relative')}>
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
        </div>
      </header>

      <main className={clsx('flex-1 overflow-y-auto', contentClassName(mode, isDesktop), isTabPage ? 'pb-16' : '')}>
        <Outlet />
      </main>

      {isTabPage && (
        <nav className={clsx('fixed bottom-0 left-1/2 -translate-x-1/2 w-full bg-card border-t border-border z-20 safe-bottom', !isDesktop || mode === 'compact' ? 'max-w-[430px]' : 'max-w-5xl rounded-t-2xl shadow-lg')}>
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

export default RunnerLayout;

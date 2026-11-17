import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useUser } from '../store/userStore';
import { Home, ClipboardList, User } from 'lucide-react';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  showTabBar?: boolean;
  hideHeader?: boolean;
  /** 内容区自己做滚动（聊天页用），避免外层滚动导致底部输入框悬空 */
  noScroll?: boolean;
}

const tabItems = [
  { key: 'home', label: '首页', icon: Home, path: '/home' },
  { key: 'orders', label: '订单', icon: ClipboardList, path: '/orders' },
  { key: 'profile', label: '我的', icon: User, path: '/profile' },
];

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  showBack = false,
  rightAction,
  showTabBar = true,
  hideHeader = false,
  noScroll = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const activeTab = tabItems.find((t) => location.pathname.startsWith(t.path))?.key;

  const handleTabClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {!hideHeader && (
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
              {title || '顺手捎 · 校园代取'}
            </h1>
            {rightAction && <div className="absolute right-4">{rightAction}</div>}
          </div>
        </header>
      )}

      <main
        className={clsx(
          'flex-1 min-h-0',
          noScroll ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
          showTabBar ? 'pb-16' : '',
        )}
      >
        {children}
      </main>

      {showTabBar && (
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

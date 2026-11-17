import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Trash2,
  Info,
  LogOut,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { useUser } from '@client/src/store/userStore';
import AddToHomeSheet from '@client/src/components/AddToHomeSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearUser } = useUser();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const handleClearCache = () => {
    toast.success('缓存已清除');
  };

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const accountItems: { key: string; label: string; value?: string }[] = [
    { key: 'name', label: '姓名', value: user?.name },
    { key: 'phone', label: '手机号', value: user?.phone },
    { key: 'dormitory', label: '宿舍号', value: user?.dormitory },
  ];

  const functionItems: {
    key: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
    trailing?: React.ReactNode;
  }[] = [
    {
      key: 'add-to-home',
      icon: Smartphone,
      label: '添加到手机桌面',
      onClick: () => setInstallOpen(true),
    },
    {
      key: 'clear-cache',
      icon: Trash2,
      label: '清除缓存',
      onClick: handleClearCache,
      trailing: <span className="text-xs text-muted-foreground mr-1">0KB</span>,
    },
    {
      key: 'about',
      icon: Info,
      label: '关于',
      onClick: () => setAboutOpen(true),
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
      {/* 账号信息 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden rise">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">账号信息</span>
        </div>
        {accountItems.map((item, index) => {
          const hasDivider = index < accountItems.length - 1;
          return (
            <div
              key={item.key}
              className={
                'flex items-center px-4 py-3 ' +
                (hasDivider ? 'border-b border-border' : '')
              }
            >
              <span className="text-sm text-foreground">{item.label}</span>
              <span className="flex-1 text-right text-sm text-muted-foreground truncate ml-4">
                {item.value || '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* 功能列表 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden rise">
        {functionItems.map((item, index) => {
          const IconComp = item.icon;
          const hasDivider = index < functionItems.length - 1;
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
              {item.trailing}
              {!item.danger && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <AddToHomeSheet open={installOpen} onClose={() => setInstallOpen(false)} />

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>关于</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-2xl font-bold">捎</span>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                顺手捎 · 校园代取
              </p>
              <p className="text-sm text-muted-foreground mt-1">v1.0.0</p>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              校园快递代取服务平台
              <br />
              连接买家与跑腿员，让取件更轻松
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAboutOpen(false)} className="w-full">
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import AddToHomeSheet, { detectInstallEnv, installPromptEvent } from './AddToHomeSheet';

const DISMISS_KEY = 'shunshou_install_dismissed';

/** 「添加到桌面」提示：支持原生安装的直接装，不支持的给对应步骤指引 */
const InstallPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [env] = useState(() => detectInstallEnv());

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }
    if (dismissed || env === 'installed') return;
    // 下载页本身就在引导安装，不再叠加悬浮提示
    if (window.location.pathname.startsWith('/download')) return;

    // 顶部是登录页/首页时不挡操作，延时出现
    const timer = setTimeout(() => setVisible(true), 2500);
    const onInstallable = () => setVisible(true);
    window.addEventListener('shunshou-installable', onInstallable);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('shunshou-installable', onInstallable);
    };
  }, [env]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handlePrimary = async () => {
    const evt = installPromptEvent.current;
    if (evt) {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
        installPromptEvent.current = null;
      }
      return;
    }
    setSheetOpen(true);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[430px]">
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">把顺手捎添加到桌面</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              添加后从桌面图标直接进入，像 App 一样全屏使用，不用每次输网址。
            </div>
            <button
              onClick={() => void handlePrimary()}
              className="mt-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium btn-press"
            >
              {installPromptEvent.current ? '立即添加' : '查看添加方法'}
            </button>
          </div>
          <button onClick={dismiss} className="p-1 text-muted-foreground" aria-label="不再提示">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <AddToHomeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};

export default InstallPrompt;

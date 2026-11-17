import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'shunshou_install_dismissed';

/** 「添加到桌面」提示：Chrome/Edge 走官方安装，iOS Safari 给操作指引 */
const InstallPrompt: React.FC = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    // 已经以独立应用方式运行，就不再提示
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isStandaloneIOS = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandaloneIOS) {
      setShowIOSHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[430px]">
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">把顺手捎添加到桌面</div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {showIOSHint
              ? '点浏览器底部「分享」，选择「添加到主屏幕」，就能像 App 一样打开。'
              : '添加后从桌面图标直接进入，不用每次输网址。'}
          </div>
          {!showIOSHint && (
            <button
              onClick={() => void install()}
              className="mt-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium btn-press"
            >
              立即添加
            </button>
          )}
        </div>
        <button onClick={dismiss} className="p-1 text-muted-foreground" aria-label="不再提示">
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;

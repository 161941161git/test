import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

export type InstallEnv =
  | 'installed'
  | 'wechat'
  | 'ios'
  | 'android-native'
  | 'android-generic'
  | 'desktop';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const installPromptEvent = {
  current: null as BeforeInstallPromptEvent | null,
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPromptEvent.current = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('shunshou-installable'));
  });
}

/** 判断当前浏览器/系统，用来给出正确的添加步骤 */
export function detectInstallEnv(): InstallEnv {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';

  if (/MicroMessenger|QQ\/|Weibo/.test(ua)) return 'wechat';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) {
    // 国产手机自带浏览器大多不支持自动安装，需要走菜单添加
    const oem =
      /VivoBrowser|HeyTapBrowser|MiuiBrowser|HuaweiBrowser|HonorBrowser|UCBrowser|MQQBrowser|QQBrowser|Quark|baiduboxapp|SamsungBrowser|360SE|SogouMobileBrowser/i.test(
        ua,
      );
    if (oem) return 'android-generic';
    return /Chrome\/|EdgA\/|CriOS/.test(ua) ? 'android-native' : 'android-generic';
  }
  return 'desktop';
}

const STEPS: Record<InstallEnv, { title: string; steps: string[] }> = {
  installed: {
    title: '已经在桌面了',
    steps: ['你当前就是从桌面图标打开的，不用再添加。'],
  },
  wechat: {
    title: '微信内打开，要先跳到浏览器',
    steps: [
      '点右上角「···」',
      '选择「在浏览器打开」',
      '在浏览器里点菜单「≡」或「⋮」，选「添加到桌面」',
    ],
  },
  ios: {
    title: 'iPhone 用 Safari 添加',
    steps: [
      '点底部的「分享」图标（方框向上箭头）',
      '向下滑动，找到「添加到主屏幕」',
      '点右上角「添加」，桌面就会出现图标',
    ],
  },
  'android-native': {
    title: '安卓浏览器添加',
    steps: [
      '点右上角「⋮」菜单',
      '选「安装应用」或「添加到主屏幕」',
      '确认后桌面会出现「顺手捎」图标',
    ],
  },
  'android-generic': {
    title: '你的浏览器不支持自动安装，用菜单添加',
    steps: [
      '点浏览器右上角或底部的菜单按钮「≡」／「⋮」',
      '在菜单里找「添加到桌面」或「添加到主屏幕」',
      '确认后桌面会出现「顺手捎」图标，点开即全屏使用',
    ],
  },
  desktop: {
    title: '电脑端安装',
    steps: [
      '用 Chrome 或 Edge 打开当前页面',
      '点地址栏右侧的「安装」图标（显示器带箭头）',
      '没有图标时，点右上角「⋮」→「安装顺手捎」',
    ],
  },
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const AddToHomeSheet: React.FC<Props> = ({ open, onClose }) => {
  const [env] = useState<InstallEnv>(() => detectInstallEnv());
  const [canNative, setCanNative] = useState<boolean>(!!installPromptEvent.current);

  useEffect(() => {
    const handler = () => setCanNative(!!installPromptEvent.current);
    window.addEventListener('shunshou-installable', handler);
    return () => window.removeEventListener('shunshou-installable', handler);
  }, []);

  if (!open) return null;

  const info = STEPS[env];

  const startNative = async () => {
    const evt = installPromptEvent.current;
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') {
      onClose();
      installPromptEvent.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[430px] rounded-t-2xl bg-card p-5 pb-7 rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-foreground">添加到手机桌面</div>
            <div className="text-xs text-muted-foreground mt-1">{info.title}</div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground" aria-label="关闭">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {info.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-foreground leading-relaxed">{step}</span>
            </div>
          ))}
        </div>

        {canNative && env !== 'installed' && (
          <button
            onClick={() => void startNative()}
            className="mt-5 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium btn-press"
          >
            立即安装
          </button>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full h-11 rounded-xl border border-border text-sm text-muted-foreground btn-press"
        >
          知道了
        </button>
      </div>
    </div>
  );
};

export default AddToHomeSheet;

import { useEffect, useState } from 'react';

export type DisplayMode = 'wide' | 'compact';

const MODE_KEY = 'shunshou_display_mode';
const MODE_EVENT = 'shunshou-display-mode-change';

export function getDisplayMode(): DisplayMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'compact' || raw === 'wide') return raw;
  } catch {
    // ignore
  }
  return 'wide';
}

export function setDisplayMode(mode: DisplayMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>(getDisplayMode);
  useEffect(() => {
    const onChange = () => setMode(getDisplayMode());
    window.addEventListener(MODE_EVENT, onChange);
    return () => window.removeEventListener(MODE_EVENT, onChange);
  }, []);
  return mode;
}

/** 视口宽度是否达到桌面尺寸（>=1024px） */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

/** 各角色布局的根节点样式：小窗模式保持手机宽度并居中，全屏模式铺满 */
export function shellClassName(mode: DisplayMode, isDesktop: boolean, extra = ''): string {
  const base = 'min-h-screen bg-background flex flex-col relative';
  const compact = 'max-w-[430px] mx-auto w-full shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';
  const wide = 'w-full';
  const chosen = !isDesktop || mode === 'compact' ? compact : wide;
  return `${base} ${chosen} ${extra}`.trim();
}

/** 内容区宽度：全屏模式下限制到舒适的阅读宽度 */
export function contentClassName(mode: DisplayMode, isDesktop: boolean): string {
  return !isDesktop || mode === 'compact' ? 'w-full' : 'w-full max-w-5xl mx-auto px-2';
}

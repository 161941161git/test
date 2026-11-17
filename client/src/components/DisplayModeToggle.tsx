import React from 'react';
import { clsx } from 'clsx';
import { Maximize2, Smartphone } from 'lucide-react';
import { useDisplayMode, setDisplayMode, useIsDesktop } from '@client/src/lib/display-mode';

/** 只在电脑端出现的「全屏 / 小窗」切换按钮 */
const DisplayModeToggle: React.FC = () => {
  const isDesktop = useIsDesktop();
  const mode = useDisplayMode();
  if (!isDesktop) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-card/95 backdrop-blur border border-border shadow-lg p-1">
      <button
        onClick={() => setDisplayMode('wide')}
        className={clsx(
          'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors btn-press',
          mode === 'wide' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="全屏展示"
      >
        <Maximize2 className="w-3.5 h-3.5" strokeWidth={2} />
        全屏
      </button>
      <button
        onClick={() => setDisplayMode('compact')}
        className={clsx(
          'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors btn-press',
          mode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="小窗展示"
      >
        <Smartphone className="w-3.5 h-3.5" strokeWidth={2} />
        小窗
      </button>
    </div>
  );
};

export default DisplayModeToggle;

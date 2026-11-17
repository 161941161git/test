import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import RoutesComponent from './app.tsx';
import './index.css';
import { Toaster } from '@client/src/components/ui/sonner';
import DisplayModeToggle from './components/DisplayModeToggle';
import InstallPrompt from './components/InstallPrompt';

/** 出错时的兜底页，不再依赖任何平台组件 */
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
      <div className="text-lg font-semibold text-slate-800">页面出了点问题</div>
      <div className="max-w-md break-all text-sm text-slate-500">{error.message}</div>
      <button
        type="button"
        className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white"
        onClick={resetErrorBoundary}
      >
        重试
      </button>
    </div>
  );
}

const MainApp = () => (
  <BrowserRouter>
    <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
      <ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />
    )}>
      <RoutesComponent />
      {createPortal(<Toaster />, document.body)}
      <DisplayModeToggle />
      <InstallPrompt />
    </ErrorBoundary>
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(<MainApp />);

// 生产环境注册 Service Worker：让页面可以安装到桌面并支持离线打开壳
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

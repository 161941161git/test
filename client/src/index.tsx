import React from 'react';
import { createRoot, createPortal } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import RoutesComponent from './app.tsx';
import './index.css';
import { Toaster } from '@client/src/components/ui/sonner';

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
    </ErrorBoundary>
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(<MainApp />);

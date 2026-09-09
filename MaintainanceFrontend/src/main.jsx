import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { store } from '@/app/store';
import { AuthGate } from '@/app/AuthGate';
import { AppRoutes } from '@/app/routes';
import { Toaster } from '@/components/common/Toaster';
import { ThemeEffect } from '@/app/ThemeEffect';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <TooltipProvider delayDuration={200}>
          <ThemeEffect />
          <AuthGate>
            <AppRoutes />
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);

// The field app has to open in a basement with no signal. Registered in
// production only, so a dev reload never serves a stale bundle.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

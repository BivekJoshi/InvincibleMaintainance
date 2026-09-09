import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '@/providers';
import { AppRoutes } from '@/routes';
import { IS_PROD } from '@/config/env';
import '@/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </React.StrictMode>,
);

// The field app has to open in a basement with no signal. Registered in
// production only, so a dev reload never serves a stale bundle.
if ('serviceWorker' in navigator && IS_PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

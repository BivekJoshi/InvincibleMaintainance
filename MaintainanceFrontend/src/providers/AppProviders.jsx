import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/common/Toaster';
import { store } from '@/redux/store';
import { AuthGate } from './AuthGate';
import { ThemeEffect } from './ThemeEffect';
import { ScrollToTop } from './ScrollToTop';

/**
 * Everything the tree needs before a route can render, in the order it needs it:
 * store → router → tooltips → theme + scroll side effects → session bootstrap.
 * `main.jsx` stays a mount point; anything app-wide is added here instead.
 */
export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <TooltipProvider delayDuration={200}>
          <ThemeEffect />
          <ScrollToTop />
          <AuthGate>{children}</AuthGate>
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </Provider>
  );
}

export { AuthGate, ThemeEffect, ScrollToTop };

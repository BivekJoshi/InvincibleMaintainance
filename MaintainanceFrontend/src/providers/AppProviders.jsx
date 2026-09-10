import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/common/Toaster';
import { store } from '@/redux/store';
import { SessionEffect } from './SessionEffect';
import { ThemeProvider } from './ThemeProvider';
import { ScrollToTop } from './ScrollToTop';

/**
 * Everything the tree needs before a route can render, in the order it needs it:
 * store → router → theme → tooltips → scroll and session side effects.
 * `main.jsx` stays a mount point; anything app-wide is added here instead.
 *
 * `ThemeProvider` sits above the tooltips and the routes because it is what
 * puts the colour class on <html>; anything that reads the resolved theme —
 * an icon, a WebGL palette — is below it and so cannot render a frame ahead
 * of the class it is styled by.
 *
 * None of these hold the first paint back. Restoring a session is a background
 * errand, not a gate — see `SessionEffect`.
 */
export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <ScrollToTop />
            <SessionEffect />
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

export { SessionEffect, ThemeProvider, ScrollToTop };

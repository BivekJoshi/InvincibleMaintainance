import { useState } from 'react';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/common/Toaster';
import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { RouteErrorBoundary, RouterErrorElement } from '@/components/common/ErrorBoundary/RouteErrorBoundary';
import { store } from '@/redux/store';
import { SessionEffect } from './SessionEffect';
import { ThemeProvider } from './ThemeProvider';
import { ScrollToTop } from './ScrollToTop';

/** Everything that needs the router, in the order it needs it: theme → tooltips → scroll and session effects. */
function RouterShell({ children }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <ScrollToTop />
        <SessionEffect />
        {/* Clears on navigation. A page inside a shell has its own, in `PageOutlet`. */}
        <RouteErrorBoundary variant="app">{children}</RouteErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

/**
 * Everything the tree needs before a route can render, in the order it needs it:
 * store → router → theme → tooltips → scroll and session side effects.
 * `main.jsx` stays a mount point; anything app-wide is added here instead.
 *
 * The router is a data router with one splat route around `<AppRoutes>`, so the
 * route table keeps its `<Routes>` and nothing in it changed. A data router is what
 * `useBlocker` needs, and `useBlocker` is how a form with unsaved changes holds a
 * navigation — the back button included — until someone confirms
 * (`hooks/useUnsavedChangesGuard.js`). `<BrowserRouter>` cannot do that.
 *
 * `ThemeProvider` sits above the tooltips and the routes because it is what
 * puts the colour class on <html>; anything that reads the resolved theme —
 * an icon, a WebGL palette — is below it and so cannot render a frame ahead
 * of the class it is styled by.
 *
 * Errors are caught at three levels, innermost first: a page inside a shell
 * (`PageOutlet`, the shell stays usable), anything under the router (below, and
 * the route's `errorElement`, which otherwise shows React Router's own screen),
 * and the store and router themselves (the outer `ErrorBoundary`).
 *
 * None of these hold the first paint back. Restoring a session is a background
 * errand, not a gate — see `SessionEffect`.
 */
export function AppProviders({ children }) {
  // Created once. `children` is the route table, which is the same element for the app's lifetime.
  const [router] = useState(() => createBrowserRouter([
    { path: '*', element: <RouterShell>{children}</RouterShell>, errorElement: <RouterErrorElement /> },
  ]));

  return (
    <ErrorBoundary variant="app">
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </ErrorBoundary>
  );
}

export { SessionEffect, ThemeProvider, ScrollToTop };

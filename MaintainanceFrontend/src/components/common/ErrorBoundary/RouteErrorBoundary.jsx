import { useLocation, useRouteError } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

/**
 * An `ErrorBoundary` that clears itself on navigation, so a broken page is left
 * behind by clicking any link. Needs the router; above it, use `ErrorBoundary`.
 */
export function RouteErrorBoundary({ children, variant = 'page', ...props }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary variant={variant} resetKeys={[pathname]} {...props}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * The data router's `errorElement`. Without one, React Router catches the error
 * first and shows its own bare "Unexpected Application Error!" screen.
 */
export function RouterErrorElement() {
  const error = useRouteError();
  const normalized = error instanceof Error
    ? error
    : new Error(error?.statusText || error?.data || String(error));
  return <ErrorFallback error={normalized} variant="app" />;
}

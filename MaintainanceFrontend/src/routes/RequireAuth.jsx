import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FIELD_ROLES } from '@/config/constants';

/**
 * Route guard. Convenience only — every one of these routes is also enforced
 * server-side, so a hand-typed URL gains nothing.
 *
 * `fallbackTo` is where an authenticated user goes when they fail the role or
 * capability check. It defaults per role rather than always to /admin, because
 * a field user bounced into the admin shell sees a dashboard they cannot act on.
 */
export function RequireAuth({ roles, capability, redirectTo = '/login', fallbackTo }) {
  const { isAuthenticated, role, can } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  const home = fallbackTo ?? (FIELD_ROLES.includes(role) ? '/tech' : '/admin');
  if (roles && !roles.includes(role)) {
    return <Navigate to={home} replace />;
  }
  if (capability && !can(capability)) {
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}

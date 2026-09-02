import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Route guard. Convenience only — every one of these routes is also enforced
 * server-side, so a hand-typed URL gains nothing.
 */
export function RequireAuth({ roles, capability, redirectTo = '/login' }) {
  const { isAuthenticated, role, can } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  if (roles && !roles.includes(role)) {
    return <Navigate to="/admin" replace />;
  }
  if (capability && !can(capability)) {
    return <Navigate to="/admin" replace />;
  }
  return <Outlet />;
}

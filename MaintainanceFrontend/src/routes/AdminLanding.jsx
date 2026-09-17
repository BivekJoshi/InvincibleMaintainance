import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { contentHomeFor, landingPathFor } from '@/config/admin/adminNav';
import { DashboardPage } from './routeModules';

/** `/admin` — the dashboard, unless this role starts somewhere else (an EDITOR starts on Content). */
export function AdminHome() {
  const { role } = useAuth();
  const to = landingPathFor(role);
  return to === '/admin' ? <DashboardPage /> : <Navigate to={to} replace />;
}

/** `/admin/content` — the first content screen this role can open. */
export function ContentHome() {
  const { role } = useAuth();
  return <Navigate to={contentHomeFor(role)} replace />;
}

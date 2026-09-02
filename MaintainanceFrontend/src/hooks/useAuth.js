import { useSelector } from 'react-redux';
import { selectUser, selectRole, selectIsAuthenticated, selectAuthStatus } from '@/features/auth/authSlice';
import { can } from '@/lib/permissions';

export function useAuth() {
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const status = useSelector(selectAuthStatus);

  return {
    user,
    role,
    isAuthenticated,
    status,
    isReady: status === 'authenticated' || status === 'anonymous',
    /** UI convenience only — the API enforces the same rules. */
    can: (capability) => can(role, capability),
  };
}

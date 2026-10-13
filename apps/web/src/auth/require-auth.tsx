import { Navigate, Outlet } from 'react-router';
import { useAuth } from './auth-context';

export function RequireAuth() {
  const { user } = useAuth();

  // No "return to" path: after sign-in everyone lands on their role's home
  // (D-010). Remembering the old page sent a user to /admin/courts after an
  // admin had signed out there.
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

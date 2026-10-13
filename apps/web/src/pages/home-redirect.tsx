import { Navigate } from 'react-router';
import { useAuth } from '@/auth/auth-context';

// "/" sends each role to its own landing page.
export function HomeRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === 'ADMIN' ? '/admin/bookings' : '/courts'}
      replace
    />
  );
}

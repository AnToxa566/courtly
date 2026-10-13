import { Outlet } from 'react-router';
import type { Role } from '@courtly/contracts';
import { StatusPage } from '@/components/status-page';
import { useAuth } from './auth-context';

// Only a convenience for the screen: the API checks the role on every request.
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <StatusPage status={403} />;
  }
  return <Outlet />;
}

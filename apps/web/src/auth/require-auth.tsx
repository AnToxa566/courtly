import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // `from` lets sign-in return to the page that was asked for.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }
  return <Outlet />;
}

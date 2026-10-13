import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/auth/require-auth';
import { RequireRole } from '@/auth/require-role';
import { ShellOutlet } from '@/components/app-shell';
import { AdminBookingsPage } from '@/pages/admin-bookings-page';
import { AdminCourtsPage } from '@/pages/admin-courts-page';
import { CourtPage } from '@/pages/court-page';
import { HomeRedirect } from '@/pages/home-redirect';
import { CourtsPage } from '@/pages/courts-page';
import { MyBookingsPage } from '@/pages/my-bookings-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { SignInPage } from '@/pages/sign-in-page';

export const router = createBrowserRouter([
  { path: '/login', element: <SignInPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <ShellOutlet />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          { path: '/courts', element: <CourtsPage /> },
          { path: '/courts/:courtId', element: <CourtPage /> },
          { path: '/bookings', element: <MyBookingsPage /> },
          {
            element: <RequireRole role="ADMIN" />,
            children: [
              { path: '/admin/courts', element: <AdminCourtsPage /> },
              { path: '/admin/bookings', element: <AdminBookingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  // Public on purpose: signed out, /nope shows the 404 instead of sign-in.
  { path: '*', element: <NotFoundPage /> },
]);

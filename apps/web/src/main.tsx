import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import { queryClient } from '@/api/query-client';
import { AuthProvider } from '@/auth/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { router } from '@/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      {/* Outside the router, so a toast survives the redirect to sign-in. */}
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);

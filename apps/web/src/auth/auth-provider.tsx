import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { LoginResponse } from '@courtly/contracts';
import { fetchMe } from '@/api/auth';
import { setUnauthorizedHandler } from '@/api/client';
import { clearToken, getToken, setToken } from '@/api/token-storage';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => getToken() !== null);

  // Fetched once per session. This copy of the role only decides what to
  // render; the API re-reads the role on every request. A 401 here is handled
  // by the unauthorized handler below.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: hasToken,
    staleTime: Infinity,
  });

  function signOut() {
    clearToken();
    setHasToken(false);
    queryClient.clear();
  }

  function signIn(response: LoginResponse) {
    setToken(response.accessToken);
    setHasToken(true);
    queryClient.setQueryData(['me'], response.user);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setHasToken(false);
      queryClient.clear();
      // One toast however many requests failed together.
      toast.error('Session expired', {
        id: 'session-expired',
        description: 'Sign in again to continue.',
        duration: Infinity,
      });
    });
    return () => setUnauthorizedHandler(undefined);
  }, [queryClient]);

  if (hasToken && me.isPending) {
    return (
      <div
        role="status"
        className="grid min-h-screen place-items-center text-muted-foreground"
      >
        <LoaderCircleIcon
          className="size-6 animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (hasToken && me.isError) {
    return (
      <div className="mx-auto grid min-h-screen max-w-md content-center gap-4 px-5">
        <ErrorBanner
          title="We couldn’t reach the server."
          description="Check your connection and try again."
        />
        <Button variant="outline" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const user = hasToken ? me.data : undefined;

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

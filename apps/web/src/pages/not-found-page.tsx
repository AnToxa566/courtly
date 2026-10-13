import { AppShell } from '@/components/app-shell';
import { StatusPage } from '@/components/status-page';
import { useAuth } from '@/auth/auth-context';

// Public route: signed in it keeps the shell, signed out it stands alone.
export function NotFoundPage() {
  const { user } = useAuth();

  if (user) {
    return (
      <AppShell>
        <StatusPage status={404} />
      </AppShell>
    );
  }
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
      <StatusPage status={404} />
    </main>
  );
}

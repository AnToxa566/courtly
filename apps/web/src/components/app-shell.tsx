import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { Nav } from './nav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}

export function ShellOutlet() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

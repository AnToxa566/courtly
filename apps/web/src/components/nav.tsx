import { NavLink } from 'react-router';
import { LogOutIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/auth-context';
import { cn } from '@/lib/utils';

const userLinks = [
  { to: '/courts', label: 'Courts' },
  { to: '/bookings', label: 'My bookings' },
];

const adminLinks = [
  { to: '/admin/courts', label: 'Courts' },
  { to: '/admin/bookings', label: 'Daily bookings' },
];

function NavLinks({
  links,
  className,
}: {
  links: typeof userLinks;
  className: string;
}) {
  return (
    <nav aria-label="Main" className={className}>
      {links.map(({ to, label }) => (
        // NavLink sets aria-current="page" and stays active for nested
        // paths such as /courts/:id.
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'inline-flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Nav() {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const links = isAdmin ? adminLinks : userLinks;

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <div className="flex h-14 items-center gap-6 sm:h-16">
          <NavLink
            to="/"
            className="rounded-sm font-serif text-xl font-medium tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-2xl"
          >
            Courtly<span className="text-primary">.</span>
          </NavLink>
          <NavLinks
            links={links}
            className="hidden items-center gap-1 sm:flex"
          />
          <div className="ml-auto flex items-center gap-3">
            {isAdmin && <Badge variant="secondary">Admin</Badge>}
            <span className="hidden text-sm md:inline">{user?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={signOut}
            >
              <LogOutIcon aria-hidden="true" />
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Sign out"
              onClick={signOut}
            >
              <LogOutIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <NavLinks
          links={links}
          className="-mx-1 flex gap-1 overflow-x-auto pb-3 sm:hidden"
        />
      </div>
    </header>
  );
}

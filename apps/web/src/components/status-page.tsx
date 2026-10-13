import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/auth-context';

const copy = {
  403: {
    title: 'You don’t have access to this page',
    text: 'This area is for club admins. Sign in with an admin account to continue.',
  },
  404: {
    title: 'We couldn’t find that page',
    text: 'The page or court may have been removed. Head back to the list of courts.',
  },
};

export function StatusPage({ status }: { status: 403 | 404 }) {
  const { signOut } = useAuth();
  const { title, text } = copy[status];

  return (
    <div className="mx-auto max-w-md py-12 text-center sm:py-20">
      <p className="font-serif text-6xl font-medium tabular-nums text-muted-foreground">
        {status}
      </p>
      <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        {status === 403 ? (
          <>
            <Button asChild>
              <Link to="/courts">Go to courts</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign in as someone else
            </Button>
          </>
        ) : (
          // "/" sends each role to its own home.
          <Button asChild>
            <Link to="/">Back to courts</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

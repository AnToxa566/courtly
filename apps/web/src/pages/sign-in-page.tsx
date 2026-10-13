import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlertIcon, LoaderCircleIcon } from 'lucide-react';
import { loginRequestSchema, type LoginRequest } from '@courtly/contracts';
import { login } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
      <CircleAlertIcon
        className="mt-0.5 size-3.5 shrink-0"
        aria-hidden="true"
      />
      {message}
    </p>
  );
}

export function SignInPage() {
  const { user, signIn } = useAuth();

  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({ mutationFn: login, onSuccess: signIn });

  const wrongCredentials =
    mutation.error instanceof ApiError &&
    mutation.error.code === 'INVALID_CREDENTIALS';

  // The effect runs after the fields are enabled again; a disabled input
  // cannot take focus.
  useEffect(() => {
    if (wrongCredentials) {
      resetField('password');
      setFocus('password');
    }
  }, [wrongCredentials, resetField, setFocus]);

  // Once signed in, this page is not for you: "/" sends each role home.
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <p className="text-center font-serif text-3xl font-medium tracking-tight">
          Courtly<span className="text-primary">.</span>
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="font-serif text-2xl font-medium">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book padel and tennis courts at the club.
          </p>

          {mutation.isError &&
            (wrongCredentials ? (
              <ErrorBanner
                className="mt-6"
                title="Email or password is incorrect."
                description="Check both and try again."
              />
            ) : (
              <ErrorBanner
                className="mt-6"
                title="We couldn’t reach the server. Try again."
              />
            ))}

          {/* noValidate: the Zod messages below replace the browser's bubbles. */}
          <form
            noValidate
            className="mt-6 grid gap-5"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            <div className="grid content-start gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
                disabled={mutation.isPending}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              <FieldError
                id="email-error"
                message={errors.email && 'Enter a valid email address.'}
              />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={mutation.isPending}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                {...register('password')}
              />
              <FieldError
                id="password-error"
                message={errors.password && 'Enter your password.'}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircleIcon
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

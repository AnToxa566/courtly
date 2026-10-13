import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// DESIGN.md section 4, "Empty state". The action, if any, is passed in so
// the caller decides whether it is the view's one Clay button.
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5 shrink-0" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-serif text-2xl font-medium">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </div>
  );
}

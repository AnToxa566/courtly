import * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// DESIGN.md section 4: rounded-xl, 1px border, p-6, no shadow. `asChild`
// lets a list use <li> or <article> instead of a <div>.
function Card({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';

  return (
    <Comp
      className={cn(
        'rounded-xl border border-border bg-card p-6 text-card-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Card };

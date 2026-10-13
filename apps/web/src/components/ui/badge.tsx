import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn's variant names, mapped to Courtly's statuses (DESIGN.md section 4):
//   default     Upcoming, Active
//   secondary   Completed, Inactive, Admin
//   destructive Cancelled
//   outline     sport
const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground',
        secondary: 'bg-secondary text-foreground',
        destructive: 'bg-brick-tint text-destructive',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

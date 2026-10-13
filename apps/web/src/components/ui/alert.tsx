import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// `destructive` is the error banner of DESIGN.md section 4.
const alertVariants = cva(
  'relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:mt-px *:[svg]:size-5 *:[svg]:text-current',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        destructive: 'border-destructive/25 bg-brick-tint text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('font-medium', className)} {...props} />;
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('text-sm', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

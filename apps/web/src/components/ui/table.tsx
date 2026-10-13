import * as React from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md section 4. The rounded border around the table is drawn by the
// caller, because it also decides at which width the table is shown.
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <table
      className={cn('w-full text-sm tabular-nums', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody className={cn('divide-y divide-line-soft', className)} {...props} />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-11 px-5 text-left font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-5 py-4 align-middle', className)} {...props} />;
}

export { Table, TableBody, TableHead, TableCell };

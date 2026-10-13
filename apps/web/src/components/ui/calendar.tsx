import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker, type ChevronProps } from 'react-day-picker';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// DESIGN.md section 4: days are size-9 rounded-lg; today has a Line border,
// the selected day is Court green, disabled days are Faded. react-day-picker
// ships no stylesheet here, so every class comes from this file. The modifier
// classes (selected, today, disabled) land on the day cell, so they reach the
// button inside it with [&>button].
const navButton = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'disabled:opacity-40',
);

function Chevron({ orientation }: ChevronProps) {
  return orientation === 'left' ? (
    <ChevronLeftIcon className="size-4" aria-hidden="true" />
  ) : (
    <ChevronRightIcon className="size-4" aria-hidden="true" />
  );
}

function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn('w-full', className)}
      classNames={{
        months: 'relative',
        month: 'flex flex-col gap-2',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: navButton,
        button_next: navButton,
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-sm font-medium',
        month_grid: 'w-full border-collapse',
        weekday: 'size-9 text-xs font-normal text-muted-foreground',
        week: 'mt-1',
        day: 'size-9 p-0 text-center',
        day_button:
          'mx-auto flex size-9 cursor-pointer items-center justify-center rounded-lg border border-transparent text-sm tabular-nums text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        today: '[&>button]:border-border [&>button]:font-semibold',
        selected:
          '[&>button]:border-court [&>button]:bg-court [&>button]:font-semibold [&>button]:text-court-foreground [&>button]:hover:bg-court',
        disabled:
          '[&>button]:cursor-not-allowed [&>button]:text-faded [&>button]:hover:bg-transparent',
        ...classNames,
      }}
      components={{ Chevron }}
      {...props}
    />
  );
}

export { Calendar };

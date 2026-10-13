import { InfoIcon } from 'lucide-react';
import type { Slot } from '@courtly/contracts';
import { Button } from '@/components/ui/button';
import { formatHours, formatPrice, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

// DESIGN.md section 4, "Summary bar". The total is only a preview; the API
// computes the price it stores.
export function BookingSummaryBar({
  dayLabel,
  courtName,
  selected,
  canExtend,
  maxHours,
  pricePerHourCents,
  timezone,
  onBook,
}: {
  dayLabel: string;
  courtName: string;
  // The picked slots in time order: none, or up to maxHours.
  selected: readonly Slot[];
  canExtend: boolean;
  maxHours: number;
  pricePerHourCents: number;
  timezone: string;
  onBook: () => void;
}) {
  const hours = selected.length;
  const total = pricePerHourCents * hours;

  return (
    <div
      role="region"
      aria-label="Booking summary"
      className="sticky bottom-4 z-10 mt-8 flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        {hours === 0 ? (
          <>
            <p className="font-medium">No time selected</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pick a start time. You can book up to {formatHours(maxHours)} in a
              row.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {dayLabel} · {courtName}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 tabular-nums">
              <span className="text-lg font-semibold">
                {selected[0].startTime}–
                {formatTime(selected[hours - 1].endsAt, timezone)}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatHours(hours)}
              </span>
            </p>
            {(hours === maxHours || canExtend) && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {hours === maxHours
                  ? `${formatHours(maxHours)} is the maximum. Pick another slot to start over.`
                  : `Pick a slot marked “+1 hour” to book ${formatHours(hours + 1)}.`}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-5 border-t border-line-soft pt-4 sm:justify-end sm:border-0 sm:pt-0">
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p
            className={cn(
              'font-serif text-2xl font-medium tabular-nums',
              hours === 0 && 'text-muted-foreground',
            )}
          >
            {formatPrice(total)}
          </p>
        </div>
        <Button disabled={hours === 0} onClick={onBook}>
          Book court
        </Button>
      </div>
    </div>
  );
}

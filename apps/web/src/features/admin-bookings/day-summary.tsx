import type { AdminDay } from '@courtly/contracts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/format';
import { cancelledNote } from './admin-day';

export function DaySummary({ day }: { day: AdminDay }) {
  const note = cancelledNote(day.cancelledCount, day.cancelledCents);

  return (
    <div className="mt-8 flex flex-wrap items-end gap-x-12 gap-y-4 border-b pb-8">
      <div>
        <p className="text-sm text-muted-foreground">Expected revenue</p>
        <p className="mt-1 font-serif text-5xl font-medium tabular-nums sm:text-6xl">
          {formatPrice(day.totalRevenueCents)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Bookings</p>
        <p className="mt-1 font-serif text-3xl tabular-nums sm:text-4xl">
          {day.bookingCount}
        </p>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

export function DaySummarySkeleton() {
  return (
    <div
      className="mt-8 flex flex-wrap items-end gap-x-12 gap-y-4 border-b pb-8"
      aria-busy="true"
    >
      <div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-14 w-40" />
      </div>
      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-10 w-12" />
      </div>
    </div>
  );
}

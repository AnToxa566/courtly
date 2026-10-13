import { CircleXIcon, LockIcon } from 'lucide-react';
import type { Booking } from '@courtly/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead } from '@/components/ui/table';
import { formatDayLabel, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  bookingAction,
  LOCK_TITLE,
  lockReason,
  STATUS_BADGE,
} from './my-bookings';

type ListProps = {
  bookings: Booking[];
  today: string;
  cancellationWindowHours: number;
  onCancel: (booking: Booking) => void;
};

// A cancelled booking keeps its row with the time and price struck through
// (DESIGN.md section 4, Table).
function struck(booking: Booking) {
  return booking.status === 'cancelled'
    ? 'text-muted-foreground line-through'
    : undefined;
}

function StatusBadge({ booking }: { booking: Booking }) {
  const { label, variant } = STATUS_BADGE[booking.status];
  return <Badge variant={variant}>{label}</Badge>;
}

// The button, the lock with its reason, or nothing (DESIGN.md 4A). The lock
// is shown instead of hiding the action so the player learns why.
function RowAction({
  booking,
  today,
  cancellationWindowHours,
  onCancel,
}: ListProps & { booking: Booking }) {
  const action = bookingAction(booking);

  if (action === 'cancel') {
    return (
      <Button
        variant="destructive-ghost"
        size="sm"
        className="gap-1.5"
        aria-label={`Cancel booking: ${booking.court.name}, ${formatDayLabel(booking.date, today)}, ${booking.startTime}`}
        onClick={() => onCancel(booking)}
      >
        <CircleXIcon aria-hidden="true" />
        Cancel booking
      </Button>
    );
  }

  if (action === 'locked') {
    return (
      <div className="flex max-w-[250px] items-start gap-2 text-left text-xs text-muted-foreground">
        <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          <span className="block text-sm font-medium text-foreground">
            {LOCK_TITLE}
          </span>
          {lockReason(cancellationWindowHours)}
        </p>
      </div>
    );
  }

  return null;
}

// A table from md up, stacked cards below (DESIGN.md section 3). Both are in
// the DOM; CSS hides one, and a hidden element is out of the accessibility
// tree, so a screen reader meets each booking once.
export function BookingsList(props: ListProps) {
  const { bookings, today } = props;

  return (
    <>
      <div className="hidden overflow-clip rounded-xl border border-border bg-card md:block">
        <Table>
          <thead>
            <tr className="border-b border-border text-left">
              <TableHead scope="col">Court</TableHead>
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Time</TableHead>
              <TableHead scope="col">Price</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="w-[1%] whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </TableHead>
            </tr>
          </thead>
          <TableBody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <TableCell>
                  <span className="font-serif text-base font-medium">
                    {booking.court.name}
                  </span>
                </TableCell>
                <TableCell>{formatDayLabel(booking.date, today)}</TableCell>
                <TableCell>
                  <span className={struck(booking)}>
                    {booking.startTime}–{booking.endTime}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={struck(booking)}>
                    {formatPrice(booking.totalPriceCents)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge booking={booking} />
                </TableCell>
                <TableCell className="w-[1%] whitespace-nowrap">
                  <div className="flex justify-end">
                    <RowAction {...props} booking={booking} />
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {bookings.map((booking) => (
          <Card asChild key={booking.id} className="p-5">
            <li>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-lg font-medium">
                    {booking.court.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {formatDayLabel(booking.date, today)} ·{' '}
                    <span className={struck(booking)}>
                      {booking.startTime}–{booking.endTime}
                    </span>
                  </p>
                </div>
                <StatusBadge booking={booking} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <span
                  className={cn('font-medium tabular-nums', struck(booking))}
                >
                  {formatPrice(booking.totalPriceCents)}
                </span>
                <RowAction {...props} booking={booking} />
              </div>
            </li>
          </Card>
        ))}
      </ul>
    </>
  );
}

// Same geometry as the rows above.
export function BookingsListSkeleton() {
  return (
    <div aria-busy="true">
      <div
        className="hidden divide-y divide-line-soft overflow-clip rounded-xl border border-border bg-card md:block"
        aria-hidden="true"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="ml-auto h-9 w-36 rounded-full" />
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <Card asChild key={row} className="p-5">
            <li>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
            </li>
          </Card>
        ))}
      </ul>
      <span className="sr-only">Loading bookings</span>
    </div>
  );
}

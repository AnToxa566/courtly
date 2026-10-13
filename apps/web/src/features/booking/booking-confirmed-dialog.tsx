import type { RefObject } from 'react';
import { Link } from 'react-router';
import { CheckIcon } from 'lucide-react';
import type { Booking } from '@courtly/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDayHeading, formatHours, formatPrice } from '@/lib/format';

// DESIGN.md 3F. The details come from the API's Booking, not from what was
// selected. The parent mounts it only while it is open.
export function BookingConfirmedDialog({
  booking,
  cancellationWindowHours,
  returnFocusTo,
  onClose,
}: {
  booking: Booking;
  cancellationWindowHours: number;
  // The grid under the dialog has just been refetched and its buttons have
  // changed, so focus goes to the day heading instead of the old button.
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ['Court', booking.court.name],
    ['Date', formatDayHeading(booking.date)],
    [
      'Time',
      `${booking.startTime}–${booking.endTime} · ${formatHours(booking.hours)}`,
    ],
    ['Total', formatPrice(booking.totalPriceCents)],
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <CheckIcon className="size-5 shrink-0" aria-hidden="true" />
        </div>
        <DialogTitle className="mt-4">Court booked</DialogTitle>
        <DialogDescription>
          It’s in My bookings. You can cancel up to {cancellationWindowHours}{' '}
          hours before it starts.
        </DialogDescription>
        <dl className="mt-5 divide-y divide-line-soft border-y border-line-soft text-sm tabular-nums">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Book another time
          </Button>
          <Button asChild>
            <Link to="/bookings">View my bookings</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import type { RefObject } from 'react';
import { CircleXIcon, LoaderCircleIcon } from 'lucide-react';
import type { Booking } from '@courtly/contracts';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useReturnFocus } from '@/features/courts/use-return-focus';
import { cn } from '@/lib/utils';
import { describeBooking } from './my-bookings';

// DESIGN.md 4C and 4D. Nothing is sent until "Cancel booking". While the
// request is pending the dialog cannot be closed. After a failure it stays
// open with the reason and only offers "Close". The parent mounts it only
// while it is open, and passes the booking as it was when the player clicked:
// the list behind refetches, and the summary must not change under them.
export function CancelBookingDialog({
  booking,
  today,
  error,
  isPending,
  returnFocusTo,
  onConfirm,
  onClose,
}: {
  booking: Booking;
  today: string;
  error: { title: string; description?: string } | null;
  isPending: boolean;
  // The row's own button may be gone once the list refreshes (the booking
  // moved to Past or became locked), so focus falls back to the panel.
  returnFocusTo: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const returnFocus = useReturnFocus(returnFocusTo);
  const { courtName, details } = describeBooking(booking, today);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <AlertDialogContent
        closeDisabled={isPending}
        onCloseAutoFocus={returnFocus}
      >
        <AlertDialogTitle className="mt-0 pr-8">
          Cancel this booking?
        </AlertDialogTitle>
        {error ? (
          <ErrorBanner
            className="mt-4"
            title={error.title}
            description={error.description}
          />
        ) : (
          <AlertDialogDescription>
            The slot will be released for other players. This can’t be undone.
          </AlertDialogDescription>
        )}
        <div
          className={cn(
            'mt-5 rounded-lg border border-line-soft bg-background px-4 py-3 text-sm tabular-nums',
            error && 'opacity-70',
          )}
        >
          <p className="font-serif text-base font-medium">{courtName}</p>
          <p className="mt-0.5 text-muted-foreground">{details}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {error ? 'Close' : 'Keep booking'}
          </AlertDialogCancel>
          {!error && (
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={onConfirm}
            >
              {isPending ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <CircleXIcon aria-hidden="true" />
              )}
              {isPending ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

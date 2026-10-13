import { LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatHours, formatPrice } from '@/lib/format';

// DESIGN.md 3F. Nothing is sent until "Confirm booking". While the request is
// pending the dialog cannot be closed. The parent mounts it only while it is
// open. The details are the selection, as a preview; the success dialog shows
// what the API stored.
export function ConfirmBookingDialog({
  courtName,
  dayLabel,
  range,
  hours,
  totalCents,
  cancellationWindowHours,
  isPending,
  onConfirm,
  onClose,
}: {
  courtName: string;
  dayLabel: string;
  range: string;
  hours: number;
  totalCents: number;
  cancellationWindowHours: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent closeDisabled={isPending}>
        <AlertDialogTitle className="mt-0 pr-8">
          Book this court?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Check the details. You can cancel up to{' '}
          {formatHours(cancellationWindowHours)} before it starts.
        </AlertDialogDescription>
        <div className="mt-5 rounded-lg border border-line-soft bg-background px-4 py-3 text-sm tabular-nums">
          <p className="font-serif text-base font-medium">{courtName}</p>
          <p className="mt-0.5 text-muted-foreground">
            {dayLabel} · {range} · {formatHours(hours)}
          </p>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-serif text-2xl font-medium tabular-nums">
            {formatPrice(totalCents)}
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Change time
          </AlertDialogCancel>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending && (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            )}
            {isPending ? 'Booking…' : 'Confirm booking'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

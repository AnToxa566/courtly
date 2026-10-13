import { CheckIcon, LoaderCircleIcon, PowerIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useReturnFocus } from './use-return-focus';

// DESIGN.md 5D. The parent mounts it only while it is open. The confirm
// button is a plain Button, not Radix's Action, because Action closes the
// dialog on click and this one stays open until the request ends.
export function DeactivateCourtDialog({
  courtName,
  isPending,
  onConfirm,
  onClose,
}: {
  courtName: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const returnFocus = useReturnFocus();

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <AlertDialogContent onCloseAutoFocus={returnFocus}>
        <div className="flex size-10 items-center justify-center rounded-full bg-brick-tint text-destructive">
          <PowerIcon className="size-5 shrink-0" aria-hidden="true" />
        </div>
        <AlertDialogTitle>Deactivate {courtName}?</AlertDialogTitle>
        <AlertDialogDescription>
          Players won’t see this court or be able to book it.
        </AlertDialogDescription>
        <ul className="mt-4 grid gap-2 rounded-lg border border-line-soft bg-background px-4 py-3 text-sm">
          <li className="flex items-start gap-2">
            <CheckIcon
              className="mt-0.5 size-4 shrink-0 text-court"
              aria-hidden="true"
            />
            Existing bookings and booking history are kept.
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon
              className="mt-0.5 size-4 shrink-0 text-court"
              aria-hidden="true"
            />
            You can reactivate it at any time.
          </li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Keep active
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <PowerIcon aria-hidden="true" />
            )}
            Deactivate court
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

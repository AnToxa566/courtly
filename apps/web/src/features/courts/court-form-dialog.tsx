import { useId, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlertIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  sportTypeSchema,
  type Court,
  type UpdateCourtRequest,
} from '@courtly/contracts';
import { ApiError } from '@/api/client';
import { useCreateCourt, useUpdateCourt } from '@/api/courts';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CLOSES_AT_OPTIONS,
  OPENS_AT_OPTIONS,
  courtFormErrorMap,
  courtFormSchema,
  courtToFormValues,
  mapServerErrors,
  toCreateCourtRequest,
  toUpdateCourtRequest,
  type CourtFormValues,
} from './court-form';
import { DeactivateCourtDialog } from './deactivate-court-dialog';
import { SPORT_LABELS } from './sport';
import { useReturnFocus } from './use-return-focus';

const NEW_COURT_VALUES = {
  name: '',
  price: '',
  opensAt: '08:00',
  closesAt: '22:00',
  isActive: true,
};

// The error replaces the hint while it applies (DESIGN.md section 4).
function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
        <CircleAlertIcon
          className="mt-0.5 size-3.5 shrink-0"
          aria-hidden="true"
        />
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-xs text-muted-foreground">
      {hint}
    </p>
  ) : null;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

// One form for create (no `court`) and edit. The parent mounts it only while
// it is open, so every opening starts from fresh values.
export function CourtFormDialog({
  court,
  onClose,
}: {
  court?: Court;
  onClose: () => void;
}) {
  const id = useId();
  const returnFocus = useReturnFocus();
  const create = useCreateCourt();
  const update = useUpdateCourt();
  const isPending = create.isPending || update.isPending;
  const [bannerMessages, setBannerMessages] = useState<string[]>([]);
  // The edit waiting for the answer to the deactivate confirmation.
  const [confirming, setConfirming] = useState<UpdateCourtRequest | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CourtFormValues>({
    resolver: zodResolver(courtFormSchema, { error: courtFormErrorMap }),
    defaultValues: court ? courtToFormValues(court) : NEW_COURT_VALUES,
    // Validate on submit, then live per field.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // A 400 from the server: put each message next to its field, and keep what
  // cannot be placed for the banner. Other failures were toasted by the hook.
  function showServerErrors(error: Error) {
    if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') {
      return;
    }
    const { fields, unmatched } = mapServerErrors(error.details);
    let placed = 0;
    for (const field of ['name', 'sportType', 'price', 'closesAt'] as const) {
      const message = fields[field];
      if (message) {
        setError(field, { type: 'server', message });
        placed += 1;
      }
    }
    setBannerMessages(
      unmatched.length === 0 && placed === 0 ? [error.message] : unmatched,
    );
  }

  function onSubmit(values: CourtFormValues) {
    setBannerMessages([]);
    if (!court) {
      create.mutate(toCreateCourtRequest(values), {
        onSuccess: (saved) => {
          toast.success('Court saved', { description: saved.name });
          onClose();
        },
        onError: showServerErrors,
      });
      return;
    }
    const patch = toUpdateCourtRequest(court, values);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    // Switching Active to Inactive is a deactivation: confirm it first.
    if (court.isActive && patch.isActive === false) {
      setConfirming(patch);
      return;
    }
    saveEdit(court, patch);
  }

  function saveEdit(current: Court, patch: UpdateCourtRequest) {
    update.mutate(
      { id: current.id, patch },
      {
        onSuccess: (saved) => {
          toast.success('Court saved', {
            description: `${saved.name} is now updated.`,
          });
          onClose();
        },
        onError: (error) => {
          // The form shows what went wrong, so the confirmation gets out of the way.
          setConfirming(null);
          showServerErrors(error);
        },
      },
    );
  }

  const title = court ? 'Edit court' : 'New court';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // A save in flight cannot be taken back, so keep the dialog until it ends.
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent onCloseAutoFocus={returnFocus}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Players book in 1-hour slots between opening and closing time.
        </DialogDescription>

        {bannerMessages.length > 0 && (
          <ErrorBanner
            className="mt-6"
            title="This court couldn’t be saved."
            description={bannerMessages.join(' ')}
          />
        )}

        {/* noValidate: the Zod messages below replace the browser's bubbles. */}
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6">
          <div className="grid gap-5">
            <Field label="Name" htmlFor={`${id}-name`}>
              <Input
                id={`${id}-name`}
                placeholder="e.g. Olive court"
                autoComplete="off"
                autoFocus
                disabled={isPending}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${id}-name-msg` : undefined}
                {...register('name')}
              />
              <FieldMessage
                id={`${id}-name-msg`}
                error={errors.name?.message}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Sport" htmlFor={`${id}-sport`}>
                <Controller
                  control={control}
                  name="sportType"
                  render={({ field }) => (
                    <Select
                      // Nothing is chosen on a new court; '' shows the placeholder.
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id={`${id}-sport`}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={errors.sportType ? true : undefined}
                        aria-describedby={
                          errors.sportType ? `${id}-sport-msg` : undefined
                        }
                      >
                        <SelectValue placeholder="Select a sport" />
                      </SelectTrigger>
                      <SelectContent>
                        {sportTypeSchema.options.map((sport) => (
                          <SelectItem key={sport} value={sport}>
                            {SPORT_LABELS[sport]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldMessage
                  id={`${id}-sport-msg`}
                  error={errors.sportType?.message}
                />
              </Field>

              <Field label="Price per hour" htmlFor={`${id}-price`}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                  <Input
                    id={`${id}-price`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="pl-7 tabular-nums"
                    disabled={isPending}
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={`${id}-price-msg`}
                    {...register('price')}
                  />
                </div>
                <FieldMessage
                  id={`${id}-price-msg`}
                  error={errors.price?.message}
                  hint="Whole euros or cents, e.g. 28 or 28.50"
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Opens at" htmlFor={`${id}-opens`}>
                <Controller
                  control={control}
                  name="opensAt"
                  // The order error sits on closesAt, so check it again here.
                  rules={{ deps: ['closesAt'] }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id={`${id}-opens`}
                        ref={field.ref}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENS_AT_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Closes at" htmlFor={`${id}-closes`}>
                <Controller
                  control={control}
                  name="closesAt"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id={`${id}-closes`}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={errors.closesAt ? true : undefined}
                        aria-describedby={`${id}-closes-msg`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOSES_AT_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldMessage
                  id={`${id}-closes-msg`}
                  error={errors.closesAt?.message}
                  hint="Last slot ends at closing time"
                />
              </Field>
            </div>

            {court && (
              <Field label="Status" htmlFor={`${id}-status`}>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Select
                      value={field.value ? 'active' : 'inactive'}
                      onValueChange={(value) =>
                        field.onChange(value === 'active')
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id={`${id}-status`}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-describedby={`${id}-status-msg`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldMessage
                  id={`${id}-status-msg`}
                  hint="You can also deactivate from the courts list."
                />
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <LoaderCircleIcon
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Saving…
                </>
              ) : (
                'Save court'
              )}
            </Button>
          </DialogFooter>
        </form>

        {court && confirming && (
          <DeactivateCourtDialog
            courtName={court.name}
            isPending={update.isPending}
            onConfirm={() => saveEdit(court, confirming)}
            onClose={() => setConfirming(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

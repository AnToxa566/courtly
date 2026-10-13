import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeftIcon } from 'lucide-react';
import type { Booking } from '@courtly/contracts';
import { ApiError } from '@/api/client';
import { useCreateBooking } from '@/api/bookings';
import { useAvailability, useCourt } from '@/api/courts';
import { useFacility } from '@/api/facility';
import { ErrorBanner } from '@/components/error-banner';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingConfirmedDialog } from '@/features/booking/booking-confirmed-dialog';
import { ConfirmBookingDialog } from '@/features/booking/confirm-booking-dialog';
import { BookingSummaryBar } from '@/features/booking/booking-summary-bar';
import { DateStrip } from '@/features/booking/date-strip';
import { DayUnavailableCard } from '@/features/booking/day-unavailable-card';
import { SlotGrid, SlotGridSkeleton } from '@/features/booking/slot-grid';
import {
  classifyDay,
  extendableSlots,
  reconcileSelection,
  toBookingRequest,
  toggleSlot,
  type Selection,
} from '@/features/booking/slot-selection';
import { SPORT_LABELS } from '@/features/courts/sport';
import {
  formatDayHeading,
  formatDayLabel,
  formatHours,
  formatPrice,
  formatTime,
} from '@/lib/format';
import { addDays } from '@/lib/local-date';

const CONFLICT_TITLE = 'That slot was just booked. Pick another one.';
const NETWORK_TITLE = 'We couldn’t reach the server. Try again.';

type Notice = { title: string; description?: string };

// D-050: a malformed id (400) and an unknown or inactive court (404) are the
// same thing to a player.
function isNotFound(error: Error | null) {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 400)
  );
}

export function CourtPage() {
  const { courtId } = useParams();
  if (!courtId) return <StatusPage status={404} />;
  // The key gives each court its own selection and date.
  return <CourtView key={courtId} courtId={courtId} />;
}

function CourtView({ courtId }: { courtId: string }) {
  const facility = useFacility();
  const court = useCourt(courtId);
  // Until the player picks a day, the facility's today.
  const [pickedDate, setPickedDate] = useState<string>();
  const date = pickedDate ?? facility.data?.today;
  const availability = useAvailability(courtId, date);
  const createBooking = useCreateBooking(courtId);

  const [selection, setSelection] = useState<Selection>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [justBooked, setJustBooked] = useState<readonly string[]>([]);
  // The confirmation step (3F), then the booking the API stored (3G).
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [courtGone, setCourtGone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // After a refetch, a selection resting on a slot that is gone is dropped.
  // Set during render, which React allows for state of this component, so
  // the stale selection is never painted.
  const slots = availability.data?.slots;
  if (slots) {
    const reconciled = reconcileSelection(selection, slots);
    if (reconciled !== selection) setSelection(reconciled);
  }

  if (courtGone || isNotFound(court.error) || isNotFound(availability.error)) {
    return <StatusPage status={404} />;
  }

  if (court.isError || facility.isError) {
    return (
      <div className="grid gap-4">
        <ErrorBanner
          title="We couldn’t load this court."
          description="Check your connection and try again."
        />
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => {
            void court.refetch();
            void facility.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!court.data || !facility.data || !date) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="mt-4 h-20 w-72" />
        <Skeleton className="mt-8 h-16 w-full" />
        <span className="sr-only">Loading court</span>
      </div>
    );
  }

  const { today, timezone, cancellationWindowHours, maxBookingHours } =
    facility.data;
  const kind = slots ? classifyDay(slots) : undefined;
  const freeHours = slots?.filter((s) => s.status === 'available').length ?? 0;
  const summary =
    kind === 'open'
      ? `${formatHours(freeHours)} free · Select up to ${formatHours(maxBookingHours)} in a row`
      : kind
        ? '0 hours free'
        : 'Loading availability…';
  const extendable = slots
    ? extendableSlots(selection, slots, maxBookingHours)
    : new Set<string>();
  const selectedSlots =
    slots?.filter((slot) => selection.includes(slot.startsAt)) ?? [];

  function changeDate(next: string) {
    setPickedDate(next);
    setSelection([]);
    setNotice(null);
    setJustBooked([]);
  }

  const range =
    selectedSlots.length > 0
      ? `${selectedSlots[0].startTime}–${formatTime(selectedSlots[selectedSlots.length - 1].endsAt, timezone)}`
      : undefined;

  // "Book court" only opens the confirmation; this sends the request.
  function book() {
    setNotice(null);
    setJustBooked([]);
    createBooking.mutate(toBookingRequest(courtId, selection), {
      onSuccess: (booking) => {
        setConfirming(false);
        setSelection([]);
        setConfirmed(booking);
      },
      // The API has already asked for the grid to be refetched (D-084).
      onError: (error) => {
        setConfirming(false);
        // Already handled by the API client: back to sign in.
        if (error instanceof ApiError && error.status === 401) return;
        setSelection([]);
        if (!(error instanceof ApiError)) {
          setNotice({ title: NETWORK_TITLE });
        } else if (error.status === 404) {
          setCourtGone(true);
        } else if (error.code === 'SLOT_TAKEN') {
          setJustBooked(selection);
          setNotice({
            title: CONFLICT_TITLE,
            description: `${range} was taken a moment ago. Availability has been refreshed.`,
          });
        } else {
          setNotice({ title: error.message });
        }
      },
    });
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/courts">
          <ArrowLeftIcon aria-hidden="true" />
          All courts
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {SPORT_LABELS[court.data.sportType]}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            {court.data.name}
          </h1>
        </div>
        <dl className="flex gap-8 text-sm tabular-nums">
          <div>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="mt-0.5 font-medium">
              {formatPrice(court.data.pricePerHourCents)} per hour
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Open</dt>
            <dd className="mt-0.5 font-medium">
              {court.data.opensAt}–{court.data.closesAt}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8">
        <DateStrip today={today} selected={date} onSelect={changeDate} />
      </div>

      {kind && kind !== 'open' && (
        <div className="mt-8">
          <DayUnavailableCard
            kind={kind}
            dateHeading={formatDayHeading(date)}
            onNextDay={() => changeDate(addDays(date, 1))}
          />
        </div>
      )}

      <div className="mt-10">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-2xl font-medium outline-none"
        >
          {formatDayHeading(date)}
        </h2>
        {!availability.isError && (
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        )}
      </div>

      <div className="mt-5">
        {notice && (
          <ErrorBanner
            className="mb-5"
            title={notice.title}
            description={notice.description}
          />
        )}
        {availability.isError ? (
          <div className="grid gap-4">
            <ErrorBanner
              title="We couldn’t load availability."
              description="Check your connection and try again."
            />
            <Button
              variant="outline"
              className="w-fit"
              disabled={availability.isFetching}
              onClick={() => void availability.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : slots ? (
          <SlotGrid
            slots={slots}
            selection={selection}
            extendable={extendable}
            justBooked={new Set(justBooked)}
            timezone={timezone}
            onToggle={(startsAt) =>
              setSelection(
                toggleSlot(selection, slots, startsAt, maxBookingHours),
              )
            }
          />
        ) : (
          <SlotGridSkeleton />
        )}
      </div>

      {!availability.isError && (!kind || kind === 'open') && (
        <BookingSummaryBar
          dayLabel={formatDayLabel(date, today)}
          courtName={court.data.name}
          selected={selectedSlots}
          canExtend={extendable.size > 0}
          maxHours={maxBookingHours}
          pricePerHourCents={court.data.pricePerHourCents}
          timezone={timezone}
          onBook={() => setConfirming(true)}
        />
      )}

      {confirming && range && (
        <ConfirmBookingDialog
          courtName={court.data.name}
          dayLabel={formatDayLabel(date, today)}
          range={range}
          hours={selectedSlots.length}
          totalCents={court.data.pricePerHourCents * selectedSlots.length}
          cancellationWindowHours={cancellationWindowHours}
          isPending={createBooking.isPending}
          onConfirm={book}
          onClose={() => setConfirming(false)}
        />
      )}

      {confirmed && (
        <BookingConfirmedDialog
          booking={confirmed}
          cancellationWindowHours={cancellationWindowHours}
          returnFocusTo={headingRef}
          onClose={() => setConfirmed(null)}
        />
      )}
    </>
  );
}

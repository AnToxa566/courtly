import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarIcon, HistoryIcon } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Booking, Facility } from '@courtly/contracts';
import { useCancelBooking, useMyBookings } from '@/api/bookings';
import { useFacility } from '@/api/facility';
import { EmptyState } from '@/components/empty-state';
import { ErrorBanner } from '@/components/error-banner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookingsList,
  BookingsListSkeleton,
} from '@/features/my-bookings/bookings-list';
import { CancelBookingDialog } from '@/features/my-bookings/cancel-booking-dialog';
import {
  cancelFailure,
  NETWORK_MESSAGE,
  tabCount,
} from '@/features/my-bookings/my-bookings';
import { formatHours } from '@/lib/format';

type Failure = { title: string; description?: string };

// One tab's content. The list needs the facility too (today for the date
// labels, the window for the lock reason), so a failure of either shows the
// same inline error, and Retry asks again for whichever failed (D-094).
function BookingsPanel({
  bookings,
  facility,
  empty,
  onCancel,
}: {
  bookings: UseQueryResult<Booking[]>;
  facility: UseQueryResult<Facility>;
  empty: ReactNode;
  onCancel: (booking: Booking) => void;
}) {
  if (bookings.isError || facility.isError) {
    return (
      <div className="grid gap-4">
        <ErrorBanner title={NETWORK_MESSAGE} />
        <Button
          variant="outline"
          className="w-fit"
          disabled={bookings.isFetching || facility.isFetching}
          onClick={() => {
            if (bookings.isError) void bookings.refetch();
            if (facility.isError) void facility.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!bookings.data || !facility.data) return <BookingsListSkeleton />;

  if (bookings.data.length === 0) return empty;

  return (
    <BookingsList
      bookings={bookings.data}
      today={facility.data.today}
      cancellationWindowHours={facility.data.cancellationWindowHours}
      onCancel={onCancel}
    />
  );
}

export function MyBookingsPage() {
  const facility = useFacility();
  // Both are fetched up front: the tab counts need both lists.
  const upcoming = useMyBookings('upcoming');
  const past = useMyBookings('past');
  const cancelBooking = useCancelBooking();

  // The booking as it was when the player clicked Cancel. The list behind the
  // dialog refetches, so the dialog must not read from it.
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openCancel(booking: Booking) {
    cancelBooking.reset();
    setFailure(null);
    setCancelling(booking);
  }

  function closeCancel() {
    setCancelling(null);
    setFailure(null);
  }

  function confirmCancel(booking: Booking) {
    cancelBooking.mutate(booking.id, {
      onSuccess: () => {
        closeCancel();
        toast.success('Booking cancelled');
      },
      onError: (error) => {
        const shown = cancelFailure(error);
        // A 401: the API client is already sending the user to sign-in.
        if (shown) setFailure(shown);
        else closeCancel();
      },
    });
  }

  const upcomingCount = tabCount(upcoming.data);
  const pastCount = tabCount(past.data);

  return (
    <>
      <PageHeader
        title="My bookings"
        description={
          facility.data
            ? `You can cancel a booking up to ${formatHours(facility.data.cancellationWindowHours)} before it starts.`
            : undefined
        }
      />

      {/* The focus fallback for the dialog. It wraps both panels because Radix
          mounts them one after the other on a tab switch, so a ref on each
          panel could end up null. */}
      <Tabs
        defaultValue="upcoming"
        ref={panelRef}
        tabIndex={-1}
        className="mt-8 outline-none"
      >
        <TabsList aria-label="Bookings">
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingCount !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {upcomingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="past">
            Past
            {pastCount !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {pastCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <BookingsPanel
            bookings={upcoming}
            facility={facility}
            onCancel={openCancel}
            empty={
              <EmptyState
                icon={CalendarIcon}
                title="No upcoming bookings"
                description="When you book a court it will show up here."
              >
                <Button asChild>
                  <Link to="/courts">Find a court</Link>
                </Button>
              </EmptyState>
            }
          />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <BookingsPanel
            bookings={past}
            facility={facility}
            onCancel={openCancel}
            empty={
              <EmptyState
                icon={HistoryIcon}
                title="No past bookings yet"
                description="Completed and cancelled bookings will be listed here."
              />
            }
          />
        </TabsContent>
      </Tabs>

      {cancelling && facility.data && (
        <CancelBookingDialog
          booking={cancelling}
          today={facility.data.today}
          error={failure}
          isPending={cancelBooking.isPending}
          returnFocusTo={panelRef}
          onConfirm={() => confirmCancel(cancelling)}
          onClose={closeCancel}
        />
      )}
    </>
  );
}

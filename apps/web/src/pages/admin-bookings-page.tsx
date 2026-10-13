import { useState } from 'react';
import { CalendarXIcon } from 'lucide-react';
import { useAdminDay } from '@/api/admin-bookings';
import { useFacility } from '@/api/facility';
import { EmptyState } from '@/components/empty-state';
import { ErrorBanner } from '@/components/error-banner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  DayBookingsSkeleton,
  DayBookingsTable,
} from '@/features/admin-bookings/day-bookings-table';
import { DayNav } from '@/features/admin-bookings/day-nav';
import {
  DaySummary,
  DaySummarySkeleton,
} from '@/features/admin-bookings/day-summary';
import { NETWORK_MESSAGE } from '@/features/my-bookings/my-bookings';
import { formatDayHeading } from '@/lib/format';

export function AdminBookingsPage() {
  const facility = useFacility();
  // Until the admin picks a day, it is the facility's today (D-098).
  const [picked, setPicked] = useState<string>();
  const date = picked ?? facility.data?.today;
  const day = useAdminDay(date);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Daily bookings"
          description="All courts, one day. Cancelled bookings don’t count towards revenue."
        />
        {date && facility.data && (
          <DayNav
            date={date}
            today={facility.data.today}
            onChange={setPicked}
          />
        )}
      </div>

      {facility.isError || day.isError ? (
        // Retry asks again for whichever query failed (D-094).
        <div className="mt-8 grid gap-4">
          <ErrorBanner title={NETWORK_MESSAGE} />
          <Button
            variant="outline"
            className="w-fit"
            disabled={facility.isFetching || day.isFetching}
            onClick={() => {
              if (facility.isError) void facility.refetch();
              if (day.isError) void day.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : !day.data || !date ? (
        <>
          <DaySummarySkeleton />
          <div className="mt-8">
            <DayBookingsSkeleton />
          </div>
        </>
      ) : (
        <>
          <DaySummary day={day.data} />
          <div className="mt-8">
            {day.data.bookings.length === 0 ? (
              <EmptyState
                icon={CalendarXIcon}
                title={`No bookings on ${formatDayHeading(date)}`}
                description="Nobody has booked a court for this day yet."
              />
            ) : (
              <DayBookingsTable day={day.data} />
            )}
          </div>
        </>
      )}
    </>
  );
}

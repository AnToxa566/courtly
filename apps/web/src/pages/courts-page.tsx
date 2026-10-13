import { CalendarXIcon } from 'lucide-react';
import { useCourts } from '@/api/courts';
import { EmptyState } from '@/components/empty-state';
import { ErrorBanner } from '@/components/error-banner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { CourtCard } from '@/features/courts/court-card';
import { CourtCardSkeleton } from '@/features/courts/court-card-skeleton';

const GRID = 'mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

export function CourtsPage() {
  const courts = useCourts();

  return (
    <>
      <PageHeader
        title="Courts"
        description="Pick a court to see free times. Book 1 or 2 hours at a time."
      />

      {courts.isPending && (
        <div className={GRID} aria-busy="true">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <CourtCardSkeleton />
          <span className="sr-only">Loading courts</span>
        </div>
      )}

      {courts.isError && (
        <div className="mt-8 grid gap-4">
          <ErrorBanner
            title="We couldn’t load the courts."
            description="Check your connection and try again."
          />
          <Button
            variant="outline"
            className="w-fit"
            disabled={courts.isFetching}
            onClick={() => void courts.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {courts.isSuccess &&
        (courts.data.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={CalendarXIcon}
              title="No courts open for booking"
              description="There are no active courts right now. Check back later."
            />
          </div>
        ) : (
          <div className={GRID}>
            {courts.data.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        ))}
    </>
  );
}

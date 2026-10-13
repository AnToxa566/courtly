import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DayKind } from './slot-selection';

// D-081 and D-083. "Next day" moves the date by one and says nothing about
// whether the next day has free hours.
export function DayUnavailableCard({
  kind,
  dateHeading,
  onNextDay,
}: {
  kind: Exclude<DayKind, 'open'>;
  dateHeading: string;
  onNextDay: () => void;
}) {
  const fullyBooked = kind === 'fully-booked';

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
      <div>
        <p className="font-serif text-xl font-medium">
          {fullyBooked ? 'Fully booked on' : 'No free hours on'} {dateHeading}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fullyBooked
            ? 'Every hour on this court is taken.'
            : 'No hour on this court can be booked on this day.'}
        </p>
      </div>
      <Button variant="outline" onClick={onNextDay}>
        Next day
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

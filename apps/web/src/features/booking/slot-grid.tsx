import { CheckIcon } from 'lucide-react';
import type { Slot } from '@courtly/contracts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { slotView, type Selection, type SlotView } from './slot-selection';

// DESIGN.md section 4, "Slots". The status is always a word as well as a
// colour, and booked and past slots are struck through and disabled.
const SLOT_STYLES: Record<
  SlotView,
  { box: string; time: string; word: string; spoken: string }
> = {
  available: {
    box: 'border-border bg-card text-foreground hover:border-court hover:bg-accent/40',
    time: '',
    word: 'Available',
    spoken: 'available',
  },
  selected: {
    box: 'border-court bg-court text-court-foreground',
    time: '',
    word: 'Selected',
    spoken: 'selected',
  },
  extendable: {
    box: 'border-dashed border-court bg-card text-foreground hover:bg-accent',
    time: '',
    word: '+1 hour',
    spoken: 'available, adds a second hour',
  },
  booked: {
    box: 'cursor-not-allowed border-transparent text-faded',
    time: 'line-through',
    word: 'Booked',
    spoken: 'booked',
  },
  'just-booked': {
    box: 'cursor-not-allowed border-transparent text-faded',
    time: 'line-through',
    word: 'Just booked',
    spoken: 'booked, just taken',
  },
  past: {
    box: 'cursor-not-allowed border-dashed border-line-soft text-faded',
    time: 'line-through',
    word: 'Past',
    spoken: 'in the past',
  },
};

export function SlotGrid({
  slots,
  selection,
  extendable,
  justBooked,
  timezone,
  onToggle,
}: {
  slots: readonly Slot[];
  selection: Selection;
  extendable: ReadonlySet<string>;
  justBooked: ReadonlySet<string>;
  timezone: string;
  onToggle: (startsAt: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Time slots"
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
    >
      {slots.map((slot) => {
        const view = slotView(slot, selection, extendable, justBooked);
        const style = SLOT_STYLES[view];
        const interactive =
          view === 'available' || view === 'selected' || view === 'extendable';
        const end = formatTime(slot.endsAt, timezone);

        return (
          // Not the label: two slots can both read 01:00 (D-080).
          <button
            key={slot.startsAt}
            type="button"
            disabled={!interactive}
            aria-pressed={interactive ? view === 'selected' : undefined}
            aria-label={`${slot.startTime} to ${end}, ${style.spoken}`}
            onClick={() => onToggle(slot.startsAt)}
            className={cn(
              'flex h-16 w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-lg border px-3 text-left tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              style.box,
            )}
          >
            <span
              className={cn(
                'text-[15px] leading-tight font-medium',
                style.time,
              )}
            >
              {slot.startTime}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                view === 'available' && 'text-muted-foreground',
                view === 'extendable' && 'font-medium text-court',
              )}
            >
              {view === 'selected' && (
                <CheckIcon className="size-3 shrink-0" aria-hidden="true" />
              )}
              {style.word}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// 15 matches an 08:00 to 23:00 court, the usual case; the real count is
// unknown until the response arrives.
export function SlotGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-busy="true">
      {Array.from({ length: 15 }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
      <span className="sr-only">Loading availability</span>
    </div>
  );
}

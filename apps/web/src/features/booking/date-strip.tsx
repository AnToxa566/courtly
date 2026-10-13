import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDayLabel, formatDayTile } from '@/lib/format';
import { addDays, fromCalendarDate, toCalendarDate } from '@/lib/local-date';
import { cn } from '@/lib/utils';

// Today and the six days after it, then a Calendar for anything later. Past
// days cannot be picked. `today` is the facility's, from GET /facility.
const STRIP_DAYS = 7;

export function DateStrip({
  today,
  selected,
  onSelect,
}: {
  today: string;
  selected: string;
  onSelect: (localDate: string) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));
  const pickedOutsideStrip = !days.includes(selected);

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 gap-2 overflow-x-auto">
        {days.map((day) => {
          const { weekday, day: dayNumber } = formatDayTile(day);
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-label={formatDayLabel(day, today)}
              onClick={() => onSelect(day)}
              className={cn(
                'flex h-16 min-w-[60px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isSelected
                  ? 'border-court bg-court text-court-foreground'
                  : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  !isSelected && 'text-muted-foreground',
                )}
              >
                {day === today ? 'Today' : weekday}
              </span>
              <span className="mt-1 font-serif text-xl leading-none font-medium tabular-nums">
                {dayNumber}
              </span>
            </button>
          );
        })}
      </div>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-16 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:border-court data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
              pickedOutsideStrip
                ? 'border-court bg-accent text-accent-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary',
            )}
          >
            <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Pick a date</span>
            <span className="sr-only sm:hidden">Pick a date</span>
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label="Choose a date">
          {/* timeZone="UTC" with dates built at UTC midnight keeps the
              browser's zone out of it (see lib/local-date.ts). */}
          <Calendar
            mode="single"
            required
            timeZone="UTC"
            weekStartsOn={1}
            today={toCalendarDate(today)}
            selected={toCalendarDate(selected)}
            defaultMonth={toCalendarDate(selected)}
            startMonth={toCalendarDate(today)}
            disabled={{ before: toCalendarDate(today) }}
            onSelect={(date) => {
              onSelect(fromCalendarDate(date));
              setCalendarOpen(false);
            }}
          />
          <p className="mt-3 border-t border-line-soft pt-3 text-xs text-muted-foreground">
            Past dates can’t be selected.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

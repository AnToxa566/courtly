import { useState } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDayWithYear } from '@/lib/format';
import { addDays, fromCalendarDate, toCalendarDate } from '@/lib/local-date';

// Step a day at a time or pick any date, past ones included: an admin looks
// back as well as ahead. `today` is the facility's, from GET /facility.
export function DayNav({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (localDate: string) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-10"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 px-4">
            <CalendarIcon aria-hidden="true" />
            {formatDayWithYear(date)}
          </Button>
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
            selected={toCalendarDate(date)}
            defaultMonth={toCalendarDate(date)}
            onSelect={(picked) => {
              onChange(fromCalendarDate(picked));
              setCalendarOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        className="size-10"
        aria-label="Next day"
        onClick={() => onChange(addDays(date, 1))}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

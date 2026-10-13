// The API sends dates as "YYYY-MM-DD" in the facility's zone. These helpers
// only name that calendar day; they never convert it between zones, so the
// day is built as a UTC instant and printed in UTC. Reading it back in the
// browser's zone would shift it by a day for anyone west of Greenwich.

export function formatPrice(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  if (rest === 0) {
    return `€${euros}`;
  }
  return `€${euros}.${String(rest).padStart(2, '0')}`;
}

function dayParts(
  localDate: string,
  weekday: 'short' | 'long',
  month: 'short' | 'long',
): string {
  const [year, monthNumber, day] = localDate.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday,
    day: 'numeric',
    month,
  }).formatToParts(Date.UTC(year, monthNumber - 1, day));
  // Composed from parts so the output does not depend on the locale's
  // punctuation (en-GB may print "Fri 9 Oct" or "Fri, 9 Oct").
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

// "Fri 9 Oct", or "Today, Fri 9 Oct" when it is the facility's today.
export function formatDayLabel(localDate: string, today: string): string {
  const label = dayParts(localDate, 'short', 'short');
  return localDate === today ? `Today, ${label}` : label;
}

// "Friday 9 October"
export function formatDayHeading(localDate: string): string {
  return dayParts(localDate, 'long', 'long');
}

// "Fri 9 Oct 2026", the label of the admin day's date button.
export function formatDayWithYear(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(Date.UTC(year, month - 1, day));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
}

// "Sat" and 10, for a date-strip tile.
export function formatDayTile(localDate: string): {
  weekday: string;
  day: number;
} {
  const [year, month, day] = localDate.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(Date.UTC(year, month - 1, day));
  return { weekday, day };
}

// "15:00" in the facility's zone, never the browser's. h23 so midnight is
// "00:00", not "24:00". Two instants can print the same time on the night
// the clocks go back; callers tell slots apart by the instant, not by this.
export function formatTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(Date.parse(instant));
}

// "1 hour", "2 hours"
export function formatHours(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

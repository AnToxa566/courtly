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

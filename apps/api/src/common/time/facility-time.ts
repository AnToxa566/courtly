import type { DateTime } from 'luxon';

// Pure helpers: they take an instant as an argument and never read the clock.

// The facility's calendar date (YYYY-MM-DD) at an instant.
export function facilityToday(instant: DateTime, zone: string): string {
  const date = instant.setZone(zone).toISODate();
  if (date === null) {
    throw new Error(`Cannot compute the date in zone "${zone}"`);
  }
  return date;
}

// 1440 gives "24:00", which Luxon cannot represent, so this is plain
// arithmetic.
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

// The input has already matched the contracts' "HH:00" pattern.
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

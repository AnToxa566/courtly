// Calendar-date stepping on "YYYY-MM-DD" strings (D-082). A date is built as
// UTC midnight and read back with UTC getters, so the browser's zone never
// enters. Nothing here reads the clock: "today" comes from GET /facility.

// The Date the Calendar component is given: UTC midnight of that day.
export function toCalendarDate(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// The Calendar hands back a Date in the zone it was configured with
// (timeZone="UTC"), so the UTC getters name the day the user clicked.
export function fromCalendarDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(localDate: string, days: number): string {
  const date = toCalendarDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromCalendarDate(date);
}

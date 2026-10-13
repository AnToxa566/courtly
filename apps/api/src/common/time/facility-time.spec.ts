import { DateTime } from 'luxon';
import { facilityToday, minutesToTime, timeToMinutes } from './facility-time';

const ZONE = 'Europe/Lisbon';
const at = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' });

describe('facilityToday', () => {
  it.each([
    // Lisbon is on UTC+1 until 25 October 2026, 01:00 UTC.
    ['2026-10-12T22:30:00Z', '2026-10-12'],
    ['2026-10-12T23:30:00Z', '2026-10-13'],
    // Before the clocks change (UTC+1): 01:30 local, still the 25th.
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    // After the change (UTC+0): 23:30 local, still the 25th.
    ['2026-10-25T23:30:00Z', '2026-10-25'],
  ])('%s is %s in the facility', (instant, date) => {
    expect(facilityToday(at(instant), ZONE)).toBe(date);
  });
});

describe('minutes and time of day', () => {
  it.each([
    [0, '00:00'],
    [480, '08:00'],
    [1380, '23:00'],
    [1440, '24:00'],
  ])('%i minutes is %s and back', (minutes, time) => {
    expect(minutesToTime(minutes)).toBe(time);
    expect(timeToMinutes(time)).toBe(minutes);
  });
});

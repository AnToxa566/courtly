import { DateTime } from 'luxon';
import {
  facilityDayBounds,
  facilityToday,
  minutesToTime,
  openingHoursOn,
  timeToMinutes,
} from './facility-time';

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

describe('openingHoursOn', () => {
  const instants = (date: string, opens: number, closes: number) => {
    const hours = openingHoursOn(date, opens, closes, ZONE);
    return [hours.opens.toUTC().toISO(), hours.closes.toUTC().toISO()];
  };

  it.each([
    // UTC+1 all day.
    [
      '2026-10-24',
      480,
      1380,
      '2026-10-24T07:00:00.000Z',
      '2026-10-24T22:00:00.000Z',
    ],
    // The clocks go back at 02:00 local, so 08:00 is already UTC+0.
    [
      '2026-10-25',
      480,
      1380,
      '2026-10-25T08:00:00.000Z',
      '2026-10-25T23:00:00.000Z',
    ],
    // A 00:00-24:00 court on the 25-hour day.
    [
      '2026-10-25',
      0,
      1440,
      '2026-10-24T23:00:00.000Z',
      '2026-10-26T00:00:00.000Z',
    ],
    // The 23-hour day: clocks go forward on 28 March 2027.
    [
      '2027-03-28',
      0,
      1440,
      '2027-03-28T00:00:00.000Z',
      '2027-03-28T23:00:00.000Z',
    ],
  ])(
    '%s from %i to %i minutes is %s to %s',
    (date, opens, closes, from, to) => {
      expect(instants(date, opens, closes)).toEqual([from, to]);
    },
  );

  it('is 25 hours long on 25 October 2026 and 23 on 28 March 2027', () => {
    const long = openingHoursOn('2026-10-25', 0, 1440, ZONE);
    const short = openingHoursOn('2027-03-28', 0, 1440, ZONE);
    expect(long.closes.diff(long.opens, 'hours').hours).toBe(25);
    expect(short.closes.diff(short.opens, 'hours').hours).toBe(23);
  });
});

describe('facilityDayBounds', () => {
  const bounds = (date: string) => {
    const { start, end } = facilityDayBounds(date, ZONE);
    return {
      from: start.toUTC().toISO(),
      to: end.toUTC().toISO(),
      hours: end.diff(start, 'hours').hours,
    };
  };

  it('runs from local midnight to the next local midnight', () => {
    expect(bounds('2026-10-12')).toEqual({
      from: '2026-10-11T23:00:00.000Z',
      to: '2026-10-12T23:00:00.000Z',
      hours: 24,
    });
  });

  it('is 25 hours long on 25 October 2026', () => {
    expect(bounds('2026-10-25')).toEqual({
      from: '2026-10-24T23:00:00.000Z',
      to: '2026-10-26T00:00:00.000Z',
      hours: 25,
    });
  });

  it('is 23 hours long on 28 March 2027', () => {
    expect(bounds('2027-03-28')).toEqual({
      from: '2027-03-28T00:00:00.000Z',
      to: '2027-03-28T23:00:00.000Z',
      hours: 23,
    });
  });
});

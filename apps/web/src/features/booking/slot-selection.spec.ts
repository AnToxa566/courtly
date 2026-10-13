import { describe, expect, it } from 'vitest';
import type { Slot, SlotStatus } from '@courtly/contracts';
import {
  classifyDay,
  extendableSlots,
  reconcileSelection,
  slotView,
  toBookingRequest,
  toggleSlot,
} from './slot-selection';

const COURT_ID = '5d9f6a52-8d6c-4a0e-9f5a-1f1d3b6a7c10';

// One-hour slots starting on the hour. In October the facility is on UTC+1,
// so the labels are not needed here: the logic only uses startsAt and status.
function slot(hour: number, status: SlotStatus = 'available'): Slot {
  const start = String(hour).padStart(2, '0');
  const end = String(hour + 1).padStart(2, '0');
  return {
    startsAt: `2026-10-09T${start}:00:00.000Z`,
    endsAt: `2026-10-09T${end}:00:00.000Z`,
    startTime: `${start}:00`,
    status,
  };
}

const at = (hour: number) => slot(hour).startsAt;

// 08 past, 09 available, 10 available, 11 available, 12 booked, 13 available
const day: Slot[] = [
  slot(8, 'past'),
  slot(9),
  slot(10),
  slot(11),
  slot(12, 'booked'),
  slot(13),
];

describe('toggleSlot', () => {
  it('starts a one-hour selection', () => {
    expect(toggleSlot([], day, at(10))).toEqual([at(10)]);
  });

  it('grows to two hours on the later side', () => {
    expect(toggleSlot([at(10)], day, at(11))).toEqual([at(10), at(11)]);
  });

  it('grows to two hours on the earlier side, in slot order', () => {
    expect(toggleSlot([at(10)], day, at(9))).toEqual([at(9), at(10)]);
  });

  it('clears when the only selected slot is clicked', () => {
    expect(toggleSlot([at(10)], day, at(10))).toEqual([]);
  });

  it('shrinks to the other slot when one end of two is clicked', () => {
    expect(toggleSlot([at(10), at(11)], day, at(10))).toEqual([at(11)]);
    expect(toggleSlot([at(10), at(11)], day, at(11))).toEqual([at(10)]);
  });

  it('replaces the selection with a slot that is not a neighbour', () => {
    expect(toggleSlot([at(9)], day, at(11))).toEqual([at(11)]);
  });

  it('starts a new selection on a third click, never a third slot', () => {
    expect(toggleSlot([at(10), at(11)], day, at(9))).toEqual([at(9)]);
    expect(toggleSlot([at(9), at(10)], day, at(11))).toEqual([at(11)]);
    expect(toggleSlot([at(9), at(10)], day, at(13))).toEqual([at(13)]);
  });

  it('ignores a booked slot', () => {
    expect(toggleSlot([], day, at(12))).toEqual([]);
    expect(toggleSlot([at(11)], day, at(12))).toEqual([at(11)]);
  });

  it('ignores a past slot', () => {
    expect(toggleSlot([at(9)], day, at(8))).toEqual([at(9)]);
  });

  it('ignores a slot that is not in the day', () => {
    expect(toggleSlot([at(9)], day, at(20))).toEqual([at(9)]);
  });

  it('does not grow across a booked slot', () => {
    expect(toggleSlot([at(11)], day, at(13))).toEqual([at(13)]);
  });
});

describe('extendableSlots', () => {
  it('offers the free neighbours of a one-hour selection', () => {
    expect(extendableSlots([at(10)], day)).toEqual(new Set([at(9), at(11)]));
  });

  it('leaves out a booked neighbour', () => {
    expect(extendableSlots([at(11)], day)).toEqual(new Set([at(10)]));
  });

  it('leaves out a past neighbour', () => {
    expect(extendableSlots([at(9)], day)).toEqual(new Set([at(10)]));
  });

  it('offers nothing at the edges of the day', () => {
    expect(extendableSlots([at(13)], day)).toEqual(new Set());
  });

  it('offers nothing with no selection, two slots, or an unknown slot', () => {
    expect(extendableSlots([], day)).toEqual(new Set());
    expect(extendableSlots([at(10), at(11)], day)).toEqual(new Set());
    expect(extendableSlots([at(20)], day)).toEqual(new Set());
  });
});

describe('reconcileSelection', () => {
  it('keeps a selection that is still free, as the same array', () => {
    const selection = [at(10), at(11)];
    expect(reconcileSelection(selection, day)).toBe(selection);
  });

  it('drops the whole selection when one slot was taken', () => {
    const refreshed = day.map((s) =>
      s.startsAt === at(11) ? { ...s, status: 'booked' as const } : s,
    );
    expect(reconcileSelection([at(10), at(11)], refreshed)).toEqual([]);
  });

  it('drops a selection whose slot is no longer in the day', () => {
    expect(reconcileSelection([at(20)], day)).toEqual([]);
  });

  it('keeps an empty selection', () => {
    expect(reconcileSelection([], day)).toEqual([]);
  });
});

describe('slotView', () => {
  const none = new Set<string>();

  it('shows each state', () => {
    expect(slotView(slot(9), [], none, none)).toBe('available');
    expect(slotView(slot(9), [at(9)], none, none)).toBe('selected');
    expect(slotView(slot(9), [at(10)], new Set([at(9)]), none)).toBe(
      'extendable',
    );
    expect(slotView(slot(12, 'booked'), [], none, none)).toBe('booked');
    expect(slotView(slot(8, 'past'), [], none, none)).toBe('past');
  });

  it('shows a slot that was lost in a race as just booked', () => {
    expect(slotView(slot(12, 'booked'), [], none, new Set([at(12)]))).toBe(
      'just-booked',
    );
  });

  it('shows a lost slot as available again if it was freed meanwhile', () => {
    expect(slotView(slot(12), [], none, new Set([at(12)]))).toBe('available');
  });
});

describe('classifyDay', () => {
  it('is open when anything is available', () => {
    expect(classifyDay(day)).toBe('open');
  });

  it('is fully booked when every slot is booked', () => {
    expect(classifyDay([slot(9, 'booked'), slot(10, 'booked')])).toBe(
      'fully-booked',
    );
  });

  it('has no free hours when every slot is past', () => {
    expect(classifyDay([slot(9, 'past'), slot(10, 'past')])).toBe(
      'no-free-hours',
    );
  });

  it('has no free hours when past and booked are mixed', () => {
    expect(classifyDay([slot(9, 'past'), slot(10, 'booked')])).toBe(
      'no-free-hours',
    );
  });

  it('has no free hours when there are no slots', () => {
    expect(classifyDay([])).toBe('no-free-hours');
  });
});

describe('toBookingRequest', () => {
  it('sends the first startsAt and the number of hours', () => {
    expect(toBookingRequest(COURT_ID, [at(10)])).toEqual({
      courtId: COURT_ID,
      startsAt: at(10),
      hours: 1,
    });
    expect(toBookingRequest(COURT_ID, [at(10), at(11)])).toEqual({
      courtId: COURT_ID,
      startsAt: at(10),
      hours: 2,
    });
  });
});

// Lisbon, 25 October 2026: 01:00 happens twice. Both slots carry the label
// "01:00"; only startsAt tells them apart.
describe('the two 01:00 slots', () => {
  const first = '2026-10-25T00:00:00.000Z';
  const second = '2026-10-25T01:00:00.000Z';
  const dstDay: Slot[] = [
    {
      startsAt: '2026-10-24T23:00:00.000Z',
      endsAt: first,
      startTime: '00:00',
      status: 'available',
    },
    {
      startsAt: first,
      endsAt: second,
      startTime: '01:00',
      status: 'available',
    },
    {
      startsAt: second,
      endsAt: '2026-10-25T02:00:00.000Z',
      startTime: '01:00',
      status: 'available',
    },
    {
      startsAt: '2026-10-25T02:00:00.000Z',
      endsAt: '2026-10-25T03:00:00.000Z',
      startTime: '02:00',
      status: 'available',
    },
  ];

  it('selects only the one that was clicked', () => {
    const selection = toggleSlot([], dstDay, second);
    expect(selection).toEqual([second]);
    expect(slotView(dstDay[1], selection, new Set(), new Set())).toBe(
      'available',
    );
    expect(slotView(dstDay[2], selection, new Set(), new Set())).toBe(
      'selected',
    );
  });

  it('can book both as a two-hour booking, starting at the first', () => {
    const selection = toggleSlot([first], dstDay, second);
    expect(selection).toEqual([first, second]);
    expect(toBookingRequest(COURT_ID, selection).startsAt).toBe(first);
  });

  it('extends from the second 01:00 to 02:00 and back to the first', () => {
    expect(extendableSlots([second], dstDay)).toEqual(
      new Set([first, '2026-10-25T02:00:00.000Z']),
    );
  });
});

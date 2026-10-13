import type { CreateBookingRequest, Slot } from '@courtly/contracts';

// The slots the player has picked, as `startsAt` values in slot order: none,
// one, or two neighbours. Keyed by `startsAt` because two slots can print the
// same time on the night the clocks go back (D-080).
export type Selection = readonly string[];

export type SlotView =
  | 'available'
  | 'selected'
  | 'extendable'
  | 'booked'
  | 'just-booked'
  | 'past';

export type DayKind = 'open' | 'fully-booked' | 'no-free-hours';

function indexOfSlot(slots: readonly Slot[], startsAt: string): number {
  return slots.findIndex((slot) => slot.startsAt === startsAt);
}

// Click rules from DESIGN.md section 4.
export function toggleSlot(
  selection: Selection,
  slots: readonly Slot[],
  startsAt: string,
): Selection {
  const clicked = indexOfSlot(slots, startsAt);
  if (clicked === -1) return selection;

  if (selection.includes(startsAt)) {
    // Clicking the only slot clears; clicking one end of two keeps the other.
    return selection.filter((selected) => selected !== startsAt);
  }

  if (slots[clicked].status !== 'available') return selection;

  if (selection.length === 1) {
    const first = indexOfSlot(slots, selection[0]);
    if (clicked === first - 1) return [startsAt, selection[0]];
    if (clicked === first + 1) return [selection[0], startsAt];
  }

  // Not a neighbour of a one-slot selection, or a third click.
  return [startsAt];
}

// The free slots on either side of a one-hour selection.
export function extendableSlots(
  selection: Selection,
  slots: readonly Slot[],
): ReadonlySet<string> {
  if (selection.length !== 1) return new Set();
  const first = indexOfSlot(slots, selection[0]);
  if (first === -1) return new Set();
  return new Set(
    [slots[first - 1], slots[first + 1]]
      .filter((slot) => slot?.status === 'available')
      .map((slot) => slot.startsAt),
  );
}

// After a refetch: a selection that rests on a slot which is no longer
// available is dropped whole. The same array is returned when nothing
// changed, so the caller does not re-render for nothing.
export function reconcileSelection(
  selection: Selection,
  slots: readonly Slot[],
): Selection {
  const stillFree = selection.every(
    (startsAt) =>
      slots.find((slot) => slot.startsAt === startsAt)?.status === 'available',
  );
  return stillFree ? selection : [];
}

export function slotView(
  slot: Slot,
  selection: Selection,
  extendable: ReadonlySet<string>,
  justBooked: ReadonlySet<string>,
): SlotView {
  if (slot.status === 'past') return 'past';
  if (slot.status === 'booked') {
    return justBooked.has(slot.startsAt) ? 'just-booked' : 'booked';
  }
  if (selection.includes(slot.startsAt)) return 'selected';
  return extendable.has(slot.startsAt) ? 'extendable' : 'available';
}

// D-081 and D-083. "Fully booked" is only true when nothing is past.
export function classifyDay(slots: readonly Slot[]): DayKind {
  if (slots.some((slot) => slot.status === 'available')) return 'open';
  if (slots.length > 0 && slots.every((slot) => slot.status === 'booked')) {
    return 'fully-booked';
  }
  return 'no-free-hours';
}

// The selection must not be empty: the Book court button is disabled then.
export function toBookingRequest(
  courtId: string,
  selection: Selection,
): CreateBookingRequest {
  return {
    courtId,
    startsAt: selection[0],
    hours: selection.length === 2 ? 2 : 1,
  };
}

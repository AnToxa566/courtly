import { describe, expect, it } from 'vitest';
import { cancelledNote } from './admin-day';

describe('cancelledNote', () => {
  it('is null when nothing was cancelled', () => {
    expect(cancelledNote(0, 0)).toBeNull();
  });

  it('uses the singular for one booking', () => {
    expect(cancelledNote(1, 2800)).toBe('1 cancelled booking (€28) excluded');
  });

  it('uses the plural for several bookings', () => {
    expect(cancelledNote(2, 5600)).toBe('2 cancelled bookings (€56) excluded');
  });

  it('prints cents when there are some', () => {
    expect(cancelledNote(1, 2850)).toBe(
      '1 cancelled booking (€28.50) excluded',
    );
  });
});

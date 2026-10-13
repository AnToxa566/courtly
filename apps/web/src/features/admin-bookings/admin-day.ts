import { formatPrice } from '@/lib/format';

// The note under the day's revenue. Null when nothing was cancelled, so a day
// without cancellations shows no note (D-095).
export function cancelledNote(count: number, cents: number): string | null {
  if (count === 0) return null;
  const noun = count === 1 ? 'booking' : 'bookings';
  return `${count} cancelled ${noun} (${formatPrice(cents)}) excluded`;
}

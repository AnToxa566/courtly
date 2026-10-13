import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingSchema, type CreateBookingRequest } from '@courtly/contracts';
import { availabilityKey } from './courts';
import { apiRequest } from './client';

// No toast: the page shows the confirmation dialog or the banner itself. No
// retry either (the query client sets mutations.retry to false): a second
// POST after a timeout could book twice.
export function useCreateBooking(courtId: string) {
  const queryClient = useQueryClient();
  const refreshAvailability = () =>
    queryClient.invalidateQueries({ queryKey: availabilityKey(courtId) });

  return useMutation({
    mutationFn: (body: CreateBookingRequest) =>
      apiRequest('/bookings', { method: 'POST', body, schema: bookingSchema }),
    // Returned, so the dialog opens onto a grid that already shows the
    // new booking.
    onSuccess: refreshAvailability,
    // Not awaited: the banner must not wait for a refetch that may be as
    // slow as the failure that caused it.
    onError: () => {
      void refreshAvailability();
    },
  });
}

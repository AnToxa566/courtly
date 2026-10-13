import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  bookingSchema,
  type BookingScope,
  type CreateBookingRequest,
} from '@courtly/contracts';
import { availabilityKey } from './courts';
import { apiRequest } from './client';

// GET /bookings/mine returns a bare array (D-091), so the list schema is
// built here instead of in contracts.
const bookingListSchema = z.array(bookingSchema);

// A prefix of the per-scope key, so one call refreshes Upcoming and Past.
const MY_BOOKINGS_KEY = ['bookings', 'mine'] as const;

// The list is rendered in the order the API sends it (D-008, D-088).
export function useMyBookings(scope: BookingScope) {
  return useQuery({
    queryKey: [...MY_BOOKINGS_KEY, scope],
    queryFn: () =>
      apiRequest(`/bookings/mine?scope=${scope}`, {
        schema: bookingListSchema,
      }),
  });
}

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
    // new booking. My bookings is marked stale too: it may be cached from
    // an earlier visit and would not show the new row until a refetch.
    onSuccess: () =>
      Promise.all([
        refreshAvailability(),
        queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY }),
      ]),
    // Not awaited: the banner must not wait for a refetch that may be as
    // slow as the failure that caused it.
    onError: () => {
      void refreshAvailability();
    },
  });
}

// No toast and no retry, for the same reasons as useCreateBooking. The
// page decides what to show: the toast on success, the dialog banner on
// failure (DESIGN.md 4D).
export function useCancelBooking() {
  const queryClient = useQueryClient();
  const refreshMine = () =>
    queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });

  return useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        schema: bookingSchema,
      }),
    // Returned, so the dialog closes onto a list that already shows the
    // result. The freed slot is in that court's cached availability.
    onSuccess: (booking) =>
      Promise.all([
        refreshMine(),
        queryClient.invalidateQueries({
          queryKey: availabilityKey(booking.court.id),
        }),
      ]),
    // Not awaited: the dialog banner must not wait for a refetch that may
    // be as slow as the failure. After a 4xx the list is stale, and it
    // refreshes behind the dialog (D-089).
    onError: () => {
      void refreshMine();
    },
  });
}

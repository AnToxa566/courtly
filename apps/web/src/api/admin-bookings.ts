import { skipToken, useQuery } from '@tanstack/react-query';
import { adminDaySchema } from '@courtly/contracts';
import { apiRequest } from './client';

// One facility day for the admin. The date is undefined until GET /facility
// has told the page what today is, and skipToken keeps the query idle until
// then. No placeholderData on purpose: the previous day's numbers must never
// show under a new date while it loads.
export function useAdminDay(date: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'bookings', date],
    queryFn:
      date === undefined
        ? skipToken
        : () =>
            apiRequest(`/admin/bookings?date=${encodeURIComponent(date)}`, {
              schema: adminDaySchema,
            }),
  });
}

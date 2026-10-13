import { useQuery } from '@tanstack/react-query';
import { facilitySchema } from '@courtly/contracts';
import { apiRequest } from './client';

// The facility's "today" and time zone. The browser's own date is never used.
export function useFacility() {
  return useQuery({
    queryKey: ['facility'],
    queryFn: () => apiRequest('/facility', { schema: facilitySchema }),
  });
}

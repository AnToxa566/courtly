import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  availabilitySchema,
  courtSchema,
  type Court,
  type CreateCourtRequest,
  type UpdateCourtRequest,
} from '@courtly/contracts';
import { ApiError, apiRequest } from './client';

const courtListSchema = z.array(courtSchema);

// Players and admins read different endpoints, so they cache separately.
// `['courts']` is a prefix: a single court cached under `['courts', id]`
// later is invalidated with it.
const COURTS_KEY = ['courts'] as const;
const ADMIN_COURTS_KEY = ['admin', 'courts'] as const;

export function useCourts() {
  return useQuery({
    queryKey: COURTS_KEY,
    queryFn: () => apiRequest('/courts', { schema: courtListSchema }),
  });
}

export function useCourt(id: string) {
  return useQuery({
    queryKey: [...COURTS_KEY, id],
    queryFn: () => apiRequest(`/courts/${id}`, { schema: courtSchema }),
  });
}

// A prefix of the key below, so one call refreshes every cached day.
export function availabilityKey(courtId: string) {
  return [...COURTS_KEY, courtId, 'availability'] as const;
}

// `date` is undefined until the facility's today is known. There is no
// placeholder data: the previous day's slots must never show under the new
// date's heading.
export function useAvailability(courtId: string, date: string | undefined) {
  return useQuery({
    queryKey: [...availabilityKey(courtId), date],
    queryFn: () =>
      apiRequest(`/courts/${courtId}/availability?date=${date}`, {
        schema: availabilitySchema,
      }),
    enabled: date !== undefined,
  });
}

export function useAdminCourts() {
  return useQuery({
    queryKey: ADMIN_COURTS_KEY,
    queryFn: () => apiRequest('/admin/courts', { schema: courtListSchema }),
  });
}

// What a failed mutation says. Callers show their own success toast.
// - 401: the auth provider already toasts "Session expired".
// - 400 VALIDATION_FAILED: the form shows it next to the field.
// - 403 and 404: the server's message says what is wrong.
// - network failure or 5xx: nothing useful to add (DESIGN.md, 07E).
function toastFailure(error: Error) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'VALIDATION_FAILED') return;
    if (error.status === 403 || error.status === 404) {
      toast.error('Something went wrong', {
        description: error.message,
        duration: Infinity,
      });
      return;
    }
  }
  toast.error('Something went wrong', {
    description: 'We couldn’t reach the server. Try again.',
    duration: Infinity,
  });
}

function useRefreshCourts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: COURTS_KEY }),
      queryClient.invalidateQueries({ queryKey: ADMIN_COURTS_KEY }),
    ]);
}

export function useCreateCourt() {
  const refresh = useRefreshCourts();
  return useMutation({
    mutationFn: (body: CreateCourtRequest): Promise<Court> =>
      apiRequest('/admin/courts', {
        method: 'POST',
        body,
        schema: courtSchema,
      }),
    onError: (error) => {
      toastFailure(error);
      // Not awaited: after a failure the refetch may take as long as the
      // server is down, and the form must not stay locked meanwhile.
      void refresh();
    },
    // Returned, so the mutation stays pending until the lists are fresh and
    // the dialog closes onto up-to-date data.
    onSuccess: refresh,
  });
}

export function useUpdateCourt() {
  const refresh = useRefreshCourts();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateCourtRequest;
    }): Promise<Court> =>
      apiRequest(`/admin/courts/${id}`, {
        method: 'PATCH',
        body: patch,
        schema: courtSchema,
      }),
    onError: (error) => {
      toastFailure(error);
      // Not awaited: after a failure the refetch may take as long as the
      // server is down, and the form must not stay locked meanwhile.
      void refresh();
    },
    // Returned, so the mutation stays pending until the lists are fresh and
    // the dialog closes onto up-to-date data.
    onSuccess: refresh,
  });
}

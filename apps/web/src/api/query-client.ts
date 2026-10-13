import { QueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { ApiError } from './client';

// 4xx will not change on a retry, and a ZodError means the API and the
// contracts disagree. A 5xx or a network failure gets one more try.
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ZodError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

import { errorResponseSchema, type ErrorResponse } from '@courtly/contracts';
import type { z } from 'zod';
import { getToken } from './token-storage';

export class ApiError extends Error {
  // Declared here because erasableSyntaxOnly forbids constructor parameter
  // properties.
  status: number;
  code: ErrorResponse['code'];
  details: ErrorResponse['details'];

  constructor(
    status: number,
    code: ErrorResponse['code'],
    message: string,
    details?: ErrorResponse['details'],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Set by the auth provider. Keeps this file free of React.
let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  schema: z.ZodType<T>;
  // false for login: no token to send, and a 401 there means wrong password,
  // not an expired session.
  auth?: boolean;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, schema, auth = true }: RequestOptions<T>,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = auth ? getToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.ok) {
    // A response that no longer matches the contract throws a ZodError.
    return schema.parse(await res.json());
  }

  if (res.status === 401 && auth) {
    onUnauthorized?.();
  }
  throw await toApiError(res);
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const parsed = errorResponseSchema.safeParse(await res.json());
    if (parsed.success) {
      const { statusCode, code, message, details } = parsed.data;
      return new ApiError(statusCode, code, message, details);
    }
  } catch {
    // Not JSON, for example an HTML error page from a proxy.
  }
  return new ApiError(
    res.status,
    'INTERNAL_ERROR',
    'Something went wrong. Try again.',
  );
}

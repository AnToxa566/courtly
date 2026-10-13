import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { loginResponseSchema, userSchema } from '@courtly/contracts';
import { ApiError, apiRequest, setUnauthorizedHandler } from './client';
import { getToken } from './token-storage';

vi.mock('./token-storage', () => ({ getToken: vi.fn() }));

const user = {
  id: '6f1f4d52-6a0e-4b9a-9d52-1c3d2f6b7a10',
  name: 'Maria',
  email: 'maria@courtly.test',
  role: 'USER',
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getToken).mockReturnValue(null);
});

afterEach(() => {
  fetchMock.mockReset();
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns a body that matches the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(user));
    await expect(
      apiRequest('/auth/me', { schema: userSchema }),
    ).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws a ZodError when the body does not match the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...user, role: 'OWNER' }));
    await expect(
      apiRequest('/auth/me', { schema: userSchema }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('turns an error envelope into an ApiError', async () => {
    const details = [{ path: 'email', message: 'Invalid email' }];
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 422,
          code: 'OUTSIDE_OPENING_HOURS',
          message: 'Closed then',
          details,
        },
        422,
      ),
    );
    const error = await apiRequest('/bookings', {
      method: 'POST',
      body: {},
      schema: userSchema,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'OUTSIDE_OPENING_HOURS',
      message: 'Closed then',
      details,
    });
  });

  it('maps a non-JSON error to INTERNAL_ERROR', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502 }),
    );
    const error = await apiRequest('/auth/me', { schema: userSchema }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('lets a network failure through as the original error', async () => {
    const failure = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(failure);
    await expect(apiRequest('/auth/me', { schema: userSchema })).rejects.toBe(
      failure,
    );
  });

  it('calls the unauthorized handler once on a 401, and still throws', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Expired' },
        401,
      ),
    );
    await expect(
      apiRequest('/auth/me', { schema: userSchema }),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call the handler or send a token when auth is false', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.mocked(getToken).mockReturnValue('stale-token');
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Wrong email or password',
        },
        401,
      ),
    );
    await expect(
      apiRequest('/auth/login', {
        method: 'POST',
        body: { email: 'maria@courtly.test', password: 'nope' },
        schema: loginResponseSchema,
        auth: false,
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(handler).not.toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends the bearer token and a JSON body', async () => {
    vi.mocked(getToken).mockReturnValue('abc.def.ghi');
    fetchMock.mockResolvedValue(jsonResponse(user));
    await apiRequest('/auth/me', {
      method: 'POST',
      body: { a: 1 },
      schema: userSchema,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer abc.def.ghi',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe('{"a":1}');
  });
});

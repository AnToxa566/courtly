const KEY = 'courtly.token';

// localStorage throws when it is blocked (private mode, storage disabled).
// Without it the user simply has to sign in again after a reload.

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Not persisted; the session lasts until the page is closed.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}

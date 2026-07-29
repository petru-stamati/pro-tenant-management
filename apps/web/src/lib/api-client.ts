const API_URL = process.env.NEXT_PUBLIC_API_URL!;

/**
 * The access token is deliberately kept in memory only (module-level
 * variable), never localStorage — matches the "never persisted, XSS-safe"
 * design from the backend's Phase 4 auth doc. It's restored on page load via
 * a silent refresh against the httpOnly refresh-token cookie (see
 * AuthProvider), not read from any client-visible storage.
 */
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        accessToken = data.accessToken;
        return accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface ApiFetchOptions extends RequestInit {
  /** Skip the automatic refresh-and-retry on 401 (used by the refresh/login calls themselves). */
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const doFetch = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && !options.skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
      body?.error,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export { refreshAccessToken };

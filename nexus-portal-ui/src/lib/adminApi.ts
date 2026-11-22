import { API_BASE } from '@/config';

/** Sends admin requests with the httpOnly session cookie. A 401 means the session ended: go to login. */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
    window.location.href = '/admin/login';
  }
  return res;
}

/** Admin API call with JSON in/out. Throws the server's message on failure. */
export async function adminApi<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await adminFetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || `Request failed (${res.status})`);
  return data.data as T;
}

export const inputCls = `
  w-full rounded-lg border border-nx-line bg-nx-surface-muted py-2.5 px-3.5
  text-[13px] text-nx-ink placeholder:text-nx-text-subtle
  focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20
  dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white
  dark:focus:border-nx-accent-light dark:focus:ring-nx-accent-light/20
  transition-all
`;

export const cardCls = 'rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark';

/** Readable message from anything thrown. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Something went wrong';
}

/** Random secret (64 hex chars) for webhook signing. Uses the Web Crypto API. */
export function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

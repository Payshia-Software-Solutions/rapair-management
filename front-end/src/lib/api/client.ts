import { clearUserSession } from "@/lib/session";
import { tenantHeaders } from "@/lib/tenant";
import { getTerminalId } from '../pos-terminal';
/**
 * Core API fetch wrapper
 */
const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
/**
 * When the API is configured as "localhost" but the app is opened from another device on the
 * LAN (phone/tablet via http://192.168.x.x:9003), point the API at that same host instead.
 */
export const BASE_URL =
  typeof window !== 'undefined' && /\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/.test(RAW_BASE_URL) &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? RAW_BASE_URL.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${window.location.hostname}`)
    : RAW_BASE_URL;

export const api = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const baseUrl = BASE_URL;
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const locationId =
    typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : null;
  const terminalId = getTerminalId(locationId);
  const defaults: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(locationId ? { 'X-Location-Id': String(locationId) } : {}),
      ...(terminalId ? { 'X-Terminal-Id': terminalId } : {}),
      ...tenantHeaders(),
    },
    credentials: 'omit',
  };
  // Merge headers safely (caller can override).
  const merged: RequestInit = {
    ...defaults,
    ...options,
    headers: {
      ...(defaults.headers as Record<string, string>),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  };

  // If body is FormData, remove Content-Type to let browser set it with boundary
  if (options.body instanceof FormData) {
    const headers = merged.headers as Record<string, string>;
    delete headers['Content-Type'];
  }
  const response = await fetch(`${baseUrl}${path}`, merged);
  // Global 401 interceptor - token expired or invalid, force logout immediately.
  if (response.status === 401 && typeof window !== 'undefined') {
    clearUserSession();
    window.localStorage.removeItem('location_id');
    window.location.href = '/login';
  }
  // Trial ended: the server refuses writes with 402. Tell the layout so it can lock the UI.
  if (response.status === 402 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('trial:ended'));
  }
  return response;
};

export interface SystemCheckItem {
  name: string;
  available: boolean;
  message: string;
}

export interface SystemCheckResponse {
  status: 'success' | 'error';
  message: string;
  checks: SystemCheckItem[];
  missingTables: string[];
}

export interface ApiSuccess<T> {
  status: 'success';
  message: string;
  data: T;
}

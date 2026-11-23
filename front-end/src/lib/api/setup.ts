import { api } from './client';

/** First-time setup (Setup wizard). Server works "done" out from the real data. */
export type SetupStep = { done: boolean; required: boolean; skipped?: boolean };
export type SetupStatus = {
  completed: boolean;
  required_done: boolean;
  steps: { company: SetupStep; location: SetupStep; taxes: SetupStep; mail: SetupStep; sms: SetupStep };
  next: { users: boolean; items: boolean; tables: boolean; printers: boolean };
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await api(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Request failed');
  return data.data as T;
}

export const fetchSetupStatus = () => call<SetupStatus>('/api/setup/status');
export const markSetupStep = (key: 'setup_taxes_done' | 'setup_mail_skipped' | 'setup_sms_skipped' | 'setup_location_done', value = true) =>
  call<null>('/api/setup/mark', { key, value });
export const sendTestMail = (to: string) => call<null>('/api/setup/test-mail', { to });
export const completeSetup = () => call<null>('/api/setup/complete', {});
export const reopenSetup = () => call<null>('/api/setup/reopen', {});

/** Getting-started guide (until the first POS sale). Admins only. */
export type TourStatus = {
  steps: { key: 'setup' | 'units' | 'brands' | 'collections' | 'item' | 'customer' | 'pos'; done: boolean }[];
  finished: boolean;
  dismissed: boolean;
};
export const fetchTour = () => call<TourStatus>('/api/setup/tour');
export const setTourDismissed = (dismissed: boolean) => call<null>('/api/setup/tour', { dismissed });

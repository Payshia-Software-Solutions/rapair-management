import { api } from './client';

/** POS lock-screen PIN for the signed-in user. */

const parse = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    const err: any = new Error(data.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data.data;
};

export const fetchPinStatus = async (): Promise<{ has_pin: boolean }> =>
  parse(await api('/api/auth/pin_status'));

/** Needs the account password so a PIN can't be changed from an unattended terminal. */
export const savePin = async (pin: string, currentPassword: string) =>
  parse(await api('/api/auth/set_pin', { method: 'POST', body: JSON.stringify({ pin, current_password: currentPassword }) }));

/** Throws with .status 401 (wrong, tries left in message) or 423 (temporarily blocked). */
export const verifyPin = async (pin: string) =>
  parse(await api('/api/auth/verify_pin', { method: 'POST', body: JSON.stringify({ pin }) }));

/** A manager/supervisor approves an action with their own PIN. Throws 401 (wrong) / 423 (blocked). */
export const verifySupervisorPin = async (pin: string, action: string): Promise<{ approved: boolean; approver_id: number; approver_name: string }> =>
  parse(await api('/api/auth/supervisor_pin', { method: 'POST', body: JSON.stringify({ pin, action }) }));

/** Admin: remove a user's PIN (forgotten PIN). */
export const clearUserPin = async (userId: number | string) =>
  parse(await api(`/api/admin/clear_user_pin/${userId}`, { method: 'POST', body: '{}' }));

/** Admin: set a new password for a user (forgotten password). */
export const resetUserPassword = async (userId: number | string, newPassword: string) =>
  parse(await api(`/api/admin/reset_user_password/${userId}`, { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }));

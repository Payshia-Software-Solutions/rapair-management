import { api } from './client';

export type GiftVoucher = {
  id: number;
  code: string;
  initial_value: number | string;
  balance: number | string;
  status: 'Active' | 'Redeemed' | 'Void';
  display_status?: 'Active' | 'Redeemed' | 'Void' | 'Expired';
  source: 'Sold' | 'Issued';
  customer_id?: number | null;
  customer_name?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  message?: string | null;
  expires_at?: string | null;
  payment_method?: string | null;
  created_at?: string;
  created_by_name?: string | null;
  void_reason?: string | null;
  transactions?: any[];
};

export type VoucherLookup = {
  id: number;
  code: string;
  balance: number;
  initial_value: number;
  status: string;
  expires_at: string | null;
  recipient_name: string | null;
  usable: boolean;
  message: string | null;
};

export type VoucherInput = {
  value: number;
  expires_at?: string;
  customer_id?: number | string | null;
  recipient_name?: string;
  recipient_phone?: string;
  message?: string;
  code?: string;
  notes?: string;
  payment_method?: 'Cash' | 'Card' | 'Bank Transfer';
  location_id?: number | string | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Request failed');
  return data.data as T;
}

export const giftVoucherApi = {
  list: (q = '', status = '') =>
    call<GiftVoucher[]>(`/api/gift-voucher/list?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  stats: () => call<{ outstanding: number; expired_balance: number; issued_value: number; redeemed_value: number; active_count: number; total_count: number }>('/api/gift-voucher/stats'),
  details: (id: number | string) => call<GiftVoucher>(`/api/gift-voucher/details/${id}`),
  lookup: (code: string) => call<VoucherLookup>(`/api/gift-voucher/lookup?code=${encodeURIComponent(code.trim())}`),
  issue: (input: VoucherInput) => call<GiftVoucher>('/api/gift-voucher/issue', { method: 'POST', body: JSON.stringify(input) }),
  sell: (input: VoucherInput) => call<GiftVoucher>('/api/gift-voucher/sell', { method: 'POST', body: JSON.stringify(input) }),
  void: (id: number | string, reason: string) => call<{ balance_reversed: number }>(`/api/gift-voucher/void/${id}`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

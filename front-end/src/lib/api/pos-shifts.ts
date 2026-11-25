import { api } from './client';

export type ShiftSummary = {
  opening_float: number;
  cash_sales: number;
  voucher_cash: number;
  pay_in: number;
  pay_out: number;
  cash_refunds: number;
  expected_cash: number;
  methods: Record<string, { total: number; count: number }>;
  invoice_count: number;
  sales_total: number;
  moves: { type: 'PayIn' | 'PayOut'; amount: number | string; reason: string; created_at: string }[];
};

export type PosShift = {
  id: number;
  shift_no: string;
  location_id: number;
  location_name?: string;
  terminal_id?: number | null;
  terminal_name?: string | null;
  user_id: number;
  user_name?: string;
  opened_at: string;
  closed_at?: string | null;
  opening_float: number | string;
  expected_cash?: number | string | null;
  counted_cash?: number | string | null;
  variance?: number | string | null;
  close_notes?: string | null;
  status: 'Open' | 'Closed';
  summary_live?: ShiftSummary;
  summary?: ShiftSummary;
  denominations?: Record<string, number> | null;
};

export type PosTerminal = {
  id: number; location_id: number; location_name?: string | null; name: string; open_shift_no?: string | null;
  /** Back-office listing only */
  today?: { count: number; total: number };
  shift?: { id: number; shift_no: string; opened_at: string; opened_by?: string | null; summary: ShiftSummary } | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Request failed');
  return data.data as T;
}
const post = (body: any): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const posShiftApi = {
  current: () => call<PosShift | null>('/api/pos-shift/current'),
  open: (openingFloat: number) => call<PosShift>('/api/pos-shift/open', post({ opening_float: openingFloat })),
  cashMove: (type: 'PayIn' | 'PayOut', amount: number, reason: string) => call<PosShift>('/api/pos-shift/cash_move', post({ type, amount, reason })),
  close: (countedCash: number, denominations: Record<string, number> | null, notes: string) =>
    call<PosShift>('/api/pos-shift/close', post({ counted_cash: countedCash, denominations, notes })),
  /** No argument: this POS location. 'all' or an id: back-office listing. */
  terminals: (locationId?: string) =>
    call<PosTerminal[]>(`/api/pos-shift/terminals${locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''}`),
  saveTerminal: (name: string, locationId: number, id?: number) =>
    call<PosTerminal>('/api/pos-shift/terminal_save', post({ id, name, location_id: locationId })),
  deleteTerminal: (id: number) => call<null>('/api/pos-shift/terminal_delete', post({ id })),
  details: (id: number | string) => call<PosShift>(`/api/pos-shift/details/${id}`),
  list: (from: string, to: string, locationId = 'all') =>
    call<PosShift[]>(`/api/pos-shift/list?from=${from}&to=${to}&location_id=${encodeURIComponent(locationId)}`),
};

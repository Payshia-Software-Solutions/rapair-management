import { api } from './client';

export const DEBIT_NOTE_REASONS = ['Price difference', 'Short supply', 'Damaged goods', 'Rebate or discount', 'Billing error', 'Other'] as const;

export type DebitNote = {
  id: number;
  dn_no: string;
  supplier_id: number;
  supplier_name?: string | null;
  grn_id?: number | null;
  grn_number?: string | null;
  supplier_ref?: string | null;
  dn_date: string;
  reason: string;
  notes?: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  total: number | string;
  applied_amount: number | string;
  refunded_amount: number | string;
  remaining: number | string;
  status: 'Open' | 'Used' | 'Cancelled';
  cancel_reason?: string | null;
  items?: { description: string; amount: number | string }[];
  allocations?: { id: number; type: 'Apply' | 'Refund'; grn_number?: string | null; amount: number | string; payment_method?: string | null; reference_no?: string | null; alloc_date: string }[];
};

export type DebitNoteInput = {
  supplier_id: number | string;
  grn_id?: number | string | null;
  supplier_ref?: string;
  dn_date?: string;
  reason: string;
  notes?: string;
  tax_amount?: number;
  items: { description: string; amount: number }[];
  apply_to_grn?: boolean;
};

export type SupplierGrn = { id: number; grn_number: string; received_at: string; total_amount: number | string; outstanding: number | string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Request failed');
  return data.data as T;
}
const post = (body: any): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const debitNoteApi = {
  list: (q = '', status = '') =>
    call<DebitNote[]>(`/api/debit-note/list?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  details: (id: number | string) => call<DebitNote>(`/api/debit-note/details/${id}`),
  grns: (supplierId: number | string, all = false) => call<SupplierGrn[]>(`/api/debit-note/grns?supplier_id=${supplierId}${all ? '&all=1' : ''}`),
  create: (input: DebitNoteInput) => call<{ id: number; dn_no: string }>('/api/debit-note/create', post(input)),
  apply: (id: number | string, grnId: number | string, amount: number) => call<DebitNote>(`/api/debit-note/apply/${id}`, post({ grn_id: grnId, amount })),
  refund: (id: number | string, amount: number, paymentMethod: string, referenceNo = '') =>
    call<DebitNote>(`/api/debit-note/refund/${id}`, post({ amount, payment_method: paymentMethod, reference_no: referenceNo })),
  cancel: (id: number | string, reason: string) => call<DebitNote>(`/api/debit-note/cancel/${id}`, post({ reason })),
};

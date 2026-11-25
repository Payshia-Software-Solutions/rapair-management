import { api } from './client';

export const CREDIT_NOTE_REASONS = ['Price correction', 'Discount after sale', 'Billing error', 'Goodwill', 'Service issue', 'Other'] as const;

export type CreditNote = {
  id: number;
  cn_no: string;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_id?: number | null;
  invoice_no?: string | null;
  cn_date: string;
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
  created_at?: string;
  items?: { description: string; amount: number | string }[];
  allocations?: { id: number; type: 'Apply' | 'Refund'; invoice_no?: string | null; amount: number | string; payment_method?: string | null; reference_no?: string | null; alloc_date: string }[];
};

export type CreditNoteInput = {
  customer_id: number | string;
  invoice_id?: number | string | null;
  cn_date?: string;
  reason: string;
  notes?: string;
  tax_amount?: number;
  items: { description: string; amount: number }[];
  apply_to_invoice?: boolean;
  location_id?: number | string | null;
};

export type OpenInvoice = { id: number; invoice_no: string; issue_date: string; grand_total: number | string; paid_amount: number | string; due: number | string; status?: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Request failed');
  return data.data as T;
}
const post = (body: any): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const creditNoteApi = {
  list: (q = '', status = '') =>
    call<CreditNote[]>(`/api/credit-note/list?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  details: (id: number | string) => call<CreditNote>(`/api/credit-note/details/${id}`),
  openInvoices: (customerId: number | string, all = false) => call<OpenInvoice[]>(`/api/credit-note/open_invoices?customer_id=${customerId}${all ? '&all=1' : ''}`),
  create: (input: CreditNoteInput) => call<{ id: number; cn_no: string }>('/api/credit-note/create', post(input)),
  apply: (id: number | string, invoiceId: number | string, amount: number) => call<CreditNote>(`/api/credit-note/apply/${id}`, post({ invoice_id: invoiceId, amount })),
  refund: (id: number | string, amount: number, paymentMethod: string, referenceNo = '') =>
    call<CreditNote>(`/api/credit-note/refund/${id}`, post({ amount, payment_method: paymentMethod, reference_no: referenceNo })),
  cancel: (id: number | string, reason: string) => call<CreditNote>(`/api/credit-note/cancel/${id}`, post({ reason })),
};

import { api, ApiSuccess } from './client';

export interface ExpenseRow {
  id: number;
  voucher_no: string;
  expense_account_id: number;
  payment_account_id: number;
  expense_account_name?: string;
  payment_account_name?: string;
  amount: number;
  payment_date: string;
  payee_name: string;
  payment_method: 'Cash' | 'Cheque' | 'TT' | 'Bank Transfer';
  cheque_no?: string;
  tt_ref_no?: string;
  reference_no: string | null;
  notes: string | null;
  status: 'Paid' | 'Pending' | 'Cancelled';
  created_at: string;
}

export const fetchExpenses = async (filters: any = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.append(key, String(value));
    }
  });
  const res = await api(`/api/expense/list?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load expenses');
  const data = await res.json();
  return data.status === 'success' ? (data.data as ExpenseRow[]) : [];
};

export const createExpense = async (payload: any) => {
  const res = await api('/api/expense/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to record expense');
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const fetchExpenseSummary = async () => {
  const res = await api('/api/expense/summary');
  if (!res.ok) throw new Error('Failed to load expense summary');
  const data = await res.json();
  return data.status === 'success' ? data.data : null;
};
export const cancelExpense = async (id: number, reason: string) => {
  const res = await api(`/api/expense/cancel/${id}`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to cancel expense');
  }
  return res.json();
};

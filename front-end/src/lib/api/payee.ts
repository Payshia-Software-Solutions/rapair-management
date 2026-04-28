import { api, ApiSuccess } from './client';

export interface PayeeRow {
  id: number;
  name: string;
  contact_no: string | null;
  address: string | null;
  type: 'Utility' | 'Service' | 'Other';
}

export const fetchPayees = async () => {
  const res = await api('/api/payee/list');
  if (!res.ok) throw new Error('Failed to load payees');
  const data = await res.json();
  return data.status === 'success' ? (data.data as PayeeRow[]) : [];
};

export const createPayee = async (payload: { name: string; contact_no?: string; address?: string; type?: string }) => {
  const res = await api('/api/payee/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to save payee');
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const updatePayee = async (id: number, payload: any) => {
  const res = await api(`/api/payee/update/${id}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update payee');
  return res.json();
};

export const deletePayee = async (id: number) => {
  const res = await api(`/api/payee/delete/${id}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to delete payee');
  return res.json();
};

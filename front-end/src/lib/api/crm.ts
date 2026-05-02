import { api } from './client';

export interface Inquiry {
  id: number;
  inquiry_number: string;
  customer_id: number | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  inquiry_type: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  assigned_to: number | null;
  requirements: string | null;
  notes: string | null;
  converted_to_type?: string;
  converted_to_id?: number;
  items?: any[];
  logs?: InquiryLog[];
  created_at: string;
  updated_at: string;
}

export interface InquiryLog {
  id: number;
  inquiry_id: number;
  action: string;
  notes?: string;
  user_name?: string;
  created_at: string;
}

export const fetchInquiries = async (filters: any = {}) => {
  const query = new URLSearchParams(filters).toString();
  const res = await api(`/api/inquiry?${query}`);
  return res.json();
};

export const fetchInquiry = async (id: number) => {
  const res = await api(`/api/inquiry/details/${id}`);
  return res.json();
};

export const createInquiry = async (data: Partial<Inquiry>) => {
  const res = await api('/api/inquiry/create', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateInquiry = async (id: number, data: Partial<Inquiry>) => {
  const res = await api(`/api/inquiry/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteInquiry = async (id: number) => {
  const res = await api(`/api/inquiry/delete/${id}`, {
    method: 'DELETE'
  });
  return res.json();
};

export const unlinkInquiry = async (id: number) => {
  const res = await api(`/api/inquiry/unlink/${id}`, {
    method: 'POST'
  });
  return res.json();
};

export const fetchInquirySources = async () => {
  const res = await api('/api/inquiry/sources');
  if (!res.ok) throw new Error(`Sources API error: ${res.status}`);
  const data = await res.json();
  return data.status === 'success' ? data.data : [];
};

export const fetchInquiryTypes = async () => {
  const res = await api('/api/inquiry/types');
  if (!res.ok) throw new Error(`Types API error: ${res.status}`);
  const data = await res.json();
  return data.status === 'success' ? data.data : [];
};

export const addInquiryLog = async (id: number | string, payload: { action: string, notes?: string }) => {
  const res = await api(`/api/inquiry/add_log/${id}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
};

export const convertInquiry = async (id: number | string, targetType: string, targetId?: number) => {
  const res = await api(`/api/inquiry/convert/${id}`, {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId })
  });
  return res.json();
};

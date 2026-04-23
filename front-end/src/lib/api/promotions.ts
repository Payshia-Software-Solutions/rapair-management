import { api, ApiSuccess } from './client';

export type PromotionRow = {
  id: number;
  name: string;
  description: string | null;
  type: string;
  is_active: number;
  start_date?: string | null;
  end_date?: string | null;
};

export const fetchPromotions = async (locationId?: number | string) => {
  const qs = locationId ? `?location_id=${locationId}` : '';
  const res = await api(`/api/promotion/active${qs}`);
  if (!res.ok) throw new Error('Failed to load promotions');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchPromotion = async (id: number | string) => {
  const res = await api(`/api/promotion/get?id=${id}`);
  if (!res.ok) throw new Error('Failed to load promotion');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const savePromotion = async (payload: any) => {
  const res = await api('/api/promotion/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to save promotion');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const togglePromotion = async (id: number, status: number) => {
  const res = await api('/api/promotion/toggle', {
    method: 'POST',
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error('Failed to toggle promotion');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deletePromotion = async (id: number) => {
  const res = await api('/api/promotion/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to delete promotion');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const validatePromotions = async (payload: { items: any[]; subtotal: number; bank_id?: number; card_category?: string; location_id?: number }) => {
  const res = await api('/api/promotion/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to validate promotions');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

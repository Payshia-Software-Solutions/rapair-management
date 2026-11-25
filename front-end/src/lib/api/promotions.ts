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

/** Every promotion, including paused, scheduled and expired ones (admin list). */
export const fetchAllPromotions = async () => {
  const res = await api('/api/promotion/list');
  if (!res.ok) throw new Error('Failed to load promotions');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type PromoCartPayload = {
  items: any[];
  location_id?: number | string | null;
  order_type?: string | null;
  bank_id?: number | string | null;
  card_category?: string | null;
  promo_code?: string | null;
};

/** Checks a promo code against the cart. Throws with the reason when it can't be used. */
export const checkPromoCode = async (code: string, payload: PromoCartPayload) => {
  const res = await api('/api/promotion/check_code', {
    method: 'POST',
    body: JSON.stringify({ ...payload, code }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Promo code could not be applied');
  return data.data;
};

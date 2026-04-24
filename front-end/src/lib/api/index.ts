/**
 * API Module Barrel Export
 */
import { api } from './client';
export * from './client';
export * from './orders';
export * from './inventory';
export * from './finance';
export * from './admin';
export * from './hrm';
export * from './reports';
export * from './dashboard';
export * from './master-data';
export * from './promotions';
export * from './production';

// Helper for content URLs (preserving legacy function)
export const CONTENT_BASE_URL =
  (process.env.NEXT_PUBLIC_CONTENT_BASE_URL ?? 'https://content-provider.payshia.com/service-center-system/').replace(/\/+$/, '') + '/';

export const contentUrl = (folder: 'vehicles' | 'orders' | 'items' | 'company' | 'brands' | 'employees' | 'documents', filename?: string | null) => {
  if (!filename) return '';
  // If it's already a full URL, return it
  if (filename.startsWith('http')) return filename;
  // If it's a local blob URL, return it
  if (filename.startsWith('blob:')) return filename;
  
  // Strip any leading slashes and take only the basename to be safe against legacy path data
  const safe = filename.split(/[/\\]/).pop() || '';
  return `${CONTENT_BASE_URL}${folder}/${encodeURIComponent(safe)}`;
};

// --- Shipping Zones ---

export interface ShippingZone {
  id: number;
  name: string;
  base_fee: number;
  free_threshold: number | null;
  is_active: number;
}

export const fetchShippingZones = async () => {
  const res = await api('/api/shippingzone/index');
  return res.json();
};

export const createShippingZone = async (data: any) => {
  const res = await api('/api/shippingzone/store', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateShippingZone = async (id: number, data: any) => {
  const res = await api(`/api/shippingzone/update/${id}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteShippingZone = async (id: number) => {
  const res = await api(`/api/shippingzone/delete/${id}`, {
    method: 'POST'
  });
  return res.json();
};

// --- Districts ---
export interface District {
  id: number;
  name: string;
  shipping_zone_id: number | null;
  zone_name?: string;
}

export const fetchDistricts = async () => {
  const res = await api('/api/district/index');
  return res.json();
};

export const createDistrict = async (data: any) => {
  const res = await api('/api/district/store', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateDistrict = async (id: number, data: any) => {
  const res = await api(`/api/district/update/${id}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteDistrict = async (id: number) => {
  const res = await api(`/api/district/delete/${id}`, {
    method: 'POST'
  });
  return res.json();
};

// --- Cities ---
export interface City {
  id: number;
  name: string;
  district_id: number;
  district_name?: string;
}

export const fetchCities = async (districtId?: number) => {
  const url = districtId ? `/api/city/index?district_id=${districtId}` : '/api/city/index';
  const res = await api(url);
  return res.json();
};

export const createCity = async (data: any) => {
  const res = await api('/api/city/store', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateCity = async (id: number, data: any) => {
  const res = await api(`/api/city/update/${id}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteCity = async (id: number) => {
  const res = await api(`/api/city/delete/${id}`, {
    method: 'POST'
  });
  return res.json();
};

import { api } from './client';

async function call(path: string, body?: any) {
  const res = await api(path, body === undefined ? { cache: "no-store" } : { method: 'POST', body: JSON.stringify(body) });
  const j = await res.json();
  if (j.status !== 'success') throw new Error(j.message || 'Request failed');
  return j.data;
}

export const marketApi = {
  markets: () => call('/api/marketadmin/markets'),
  locations: () => call('/api/marketadmin/locations'),
  save: (id: number | null, data: any) => call(`/api/marketadmin/save/${id || 0}`, data),
  remove: (id: number) => call(`/api/marketadmin/delete/${id}`, {}),
  currencies: () => call('/api/marketadmin/currencies'),
  saveCurrency: (data: any) => call('/api/marketadmin/saveCurrency', data),
  prices: (marketId: number) => call(`/api/marketadmin/prices/${marketId}`),
  savePrices: (marketId: number, items: any[]) => call(`/api/marketadmin/savePrices/${marketId}`, { items }),
  bestSellers: (marketId: number): Promise<{ ids: number[]; custom: boolean; location_id: number }> => call(`/api/marketadmin/bestSellers/${marketId}`),
  saveBestSellers: (marketId: number, ids: number[]) => call(`/api/marketadmin/saveBestSellers/${marketId}`, { ids }),
};

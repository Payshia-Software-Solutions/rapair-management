import { api } from './client';

/** Selling price lists (Standard = item master price; lists inherit from a parent with +/-% and rounding). */
const parse = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') throw new Error(data.message || 'Request failed');
  return data.data;
};

export type PriceList = {
  id: number; name: string; parent_id: number | null; parent_name: string | null;
  adjust_percent: string | number; round_to: string | number; is_active: number;
  item_count: number; locations: string | null;
};
export type PriceListItem = {
  id: number; part_name: string; sku: string | null;
  standard_price: number; inherited_price: number; own_price: number | null; price: number;
};

export const fetchPriceLists = async (): Promise<PriceList[]> => parse(await api('/api/pricelist/list'));
export const savePriceList = async (l: Partial<PriceList>): Promise<{ id: number }> =>
  parse(await api('/api/pricelist/save', { method: 'POST', body: JSON.stringify(l) }));
export const deletePriceList = async (id: number) =>
  parse(await api(`/api/pricelist/delete/${id}`, { method: 'POST', body: '{}' }));
export const fetchPriceListItems = async (f: { list_id: number; q: string; category?: string; collection?: string; only_set?: boolean }, page: number):
  Promise<{ items: PriceListItem[]; total: number; page: number; per_page: number }> => {
  const p = new URLSearchParams({ list_id: String(f.list_id), q: f.q, page: String(page) });
  if (f.category) p.set('category', f.category);
  if (f.collection) p.set('collection', f.collection);
  if (f.only_set) p.set('only_set', '1');
  return parse(await api(`/api/pricelist/items?${p.toString()}`));
};
export const setPriceListItems = async (listId: number, items: Array<{ part_id: number; price: number | null }>) =>
  parse(await api('/api/pricelist/set_items', { method: 'POST', body: JSON.stringify({ list_id: listId, items }) }));

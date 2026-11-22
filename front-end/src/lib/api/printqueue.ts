import { api } from './client';

/**
 * Server print queue: tablets/terminals send kitchen tickets to the server, and the
 * BizzFlow Printer app on the kitchen PC prints them.
 */

const parse = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    const err: any = new Error(data.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data.data;
};

// ---- Where this terminal sends kitchen tickets (saved per terminal)
export type KotRoute = 'local' | 'queue';
const ROUTE_KEY = 'pos_kot_route';
export const getKotRoute = (): KotRoute => {
  try { return window.localStorage.getItem(ROUTE_KEY) === 'queue' ? 'queue' : 'local'; } catch { return 'local'; }
};
export const setKotRoute = (r: KotRoute) => {
  try { window.localStorage.setItem(ROUTE_KEY, r); } catch {}
};

// ---- POS
export const enqueueKot = async (heldOrderId: number, full = false): Promise<{ queued: boolean; job_id?: number; reason?: string }> =>
  parse(await api('/api/printqueue/enqueue_kot', { method: 'POST', body: JSON.stringify({ held_order_id: heldOrderId, full }) }));

export const fetchJobStatus = async (ids: number[]): Promise<Array<{ id: number; status: string; attempts: number; error: string | null }>> =>
  parse(await api(`/api/printqueue/job_status?ids=${ids.join(',')}`));

export const fetchQueueLocationStatus = async (): Promise<{ waiting: number; failed: number; devices_online: number }> =>
  parse(await api('/api/printqueue/location_status'));

export const fetchFailedJobs = async (): Promise<Array<{ id: number; title: string; attempts: number; error: string | null; created_at: string }>> =>
  parse(await api('/api/printqueue/failed'));

export const retryPrintJob = async (id: number) =>
  parse(await api(`/api/printqueue/retry/${id}`, { method: 'POST', body: '{}' }));

// ---- Admin: kitchen print devices
export type PrintDevice = {
  id: number; name: string; location_id: number; location_name: string | null;
  key_hint: string; is_active: number; last_seen_at: string | null; created_at: string; online: number;
  printers_json?: string | null;
};
export const fetchPrintDevices = async (): Promise<PrintDevice[]> => parse(await api('/api/printqueue/devices'));
export const createPrintDevice = async (name: string, locationId: number): Promise<{ id: number; key: string }> =>
  parse(await api('/api/printqueue/create_device', { method: 'POST', body: JSON.stringify({ name, location_id: locationId }) }));
export const revokePrintDevice = async (id: number) =>
  parse(await api(`/api/printqueue/revoke_device/${id}`, { method: 'POST', body: '{}' }));

// ---- Admin: print stations (Kitchen / Bar / ...). Item -> station -> printer.
export type PrintStation = {
  id: number; location_id: number; name: string; ticket_label: string;
  device_id: number | null; device_name: string | null; printer_name: string | null;
  paper_width: '58mm' | '80mm'; is_default: number; is_active: number; item_count: number;
};
export const fetchPrintStations = async (locationId?: number): Promise<PrintStation[]> =>
  parse(await api(`/api/printqueue/stations${locationId ? `?location_id=${locationId}` : ''}`));
export const savePrintStation = async (s: Partial<PrintStation>): Promise<{ id: number }> =>
  parse(await api('/api/printqueue/save_station', { method: 'POST', body: JSON.stringify(s) }));
export const deletePrintStation = async (id: number) =>
  parse(await api(`/api/printqueue/delete_station/${id}`, { method: 'POST', body: '{}' }));
export type StationItem = { id: number; part_name: string; sku: string | null; item_type: string; print_station_id: number | null };
export type StationItemFilters = { q: string; station: string; category?: string; collection?: string };
export const fetchStationItems = async (f: StationItemFilters, page: number): Promise<{ items: StationItem[]; total: number; page: number; per_page: number }> => {
  const p = new URLSearchParams({ q: f.q, station: f.station, page: String(page) });
  if (f.category) p.set('category', f.category);
  if (f.collection) p.set('collection', f.collection);
  return parse(await api(`/api/printqueue/station_items?${p.toString()}`));
};
export const fetchStationItemIds = async (f: StationItemFilters): Promise<number[]> => {
  const p = new URLSearchParams({ q: f.q, station: f.station, ids_only: '1' });
  if (f.category) p.set('category', f.category);
  if (f.collection) p.set('collection', f.collection);
  return (await parse(await api(`/api/printqueue/station_items?${p.toString()}`))).ids || [];
};
export const fetchStationItemFilters = async (): Promise<{ categories: Array<{ id: number; name: string }>; collections: Array<{ id: number; name: string }> }> =>
  parse(await api('/api/printqueue/item_filters'));
export const assignItemsToStation = async (stationId: number | null, itemIds: number[]) =>
  parse(await api('/api/printqueue/assign_items', { method: 'POST', body: JSON.stringify({ station_id: stationId, item_ids: itemIds }) }));

// ---- POS print queue panel
export type QueueJob = {
  id: number; station_id: number | null; title: string; status: 'pending' | 'printing' | 'done' | 'failed' | 'cancelled'; attempts: number; error: string | null;
  created_at: string; claimed_at: string | null; done_at: string | null; ref_id: number | null;
  station_name: string | null; ticket_label: string | null; device_name: string | null; created_by_name: string | null;
};
export const fetchQueueJobs = async (status: 'all' | 'open' | 'failed' | 'done' = 'all', station: string = ''): Promise<QueueJob[]> =>
  parse(await api(`/api/printqueue/jobs?status=${status}${station ? `&station=${encodeURIComponent(station)}` : ''}`));
export const cancelPrintJob = async (id: number) =>
  parse(await api(`/api/printqueue/cancel/${id}`, { method: 'POST', body: '{}' }));

/** Recent jobs of the BizzFlow Printer app on THIS PC (null when the app isn't running or is too old). */
export type LocalPrintJob = { id: string; title: string; printer: string; width: string; source: string; status: 'queued' | 'printing' | 'done' | 'failed'; createdAt: number; durationMs: number | null; error: string | null };
export const fetchLocalPrintJobs = async (): Promise<{ jobs: LocalPrintJob[]; running: boolean; supported: boolean }> => {
  for (const base of ['http://127.0.0.1:5001', 'http://localhost:5001']) {
    // /health answers on every version; /jobs only on newer ones (an old app's 404 has no CORS header)
    try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) }); } catch { continue; }
    try {
      const d = await (await fetch(`${base}/jobs`, { signal: AbortSignal.timeout(3000) })).json();
      if (d?.success) return { jobs: d.data || [], running: true, supported: true };
    } catch { /* older app */ }
    return { jobs: [], running: true, supported: false };
  }
  return { jobs: [], running: false, supported: false };
};

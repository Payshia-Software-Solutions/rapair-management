import { api } from './client';

/** Restaurant floor plan (server: FloorController). Sizes and positions are in canvas pixels. */
export type TableShape = 'square' | 'round' | 'rect';
export type FloorObjectKind = 'wall' | 'bar' | 'door' | 'kitchen' | 'plant' | 'label' | 'pool';

export interface FloorArea { id?: number; key: string; name: string; width: number; height: number }
export interface FloorTable {
  id?: number;
  key: string;
  name: string;
  status?: string;
  area_id?: number | null;
  areaKey?: string | null;      // designer only: which area it sits on (null = not placed)
  pos_x: number; pos_y: number; width: number; height: number; rotation: number;
  shape: TableShape; seats: number;
  /** Merged group: id of the main table this one is joined to */
  joined_to?: number | null;
}
export interface FloorObject {
  id?: number;
  key: string;
  area_id?: number;
  areaKey?: string;
  kind: FloorObjectKind;
  label?: string | null;
  pos_x: number; pos_y: number; width: number; height: number; rotation: number;
}

export interface FloorLayout { location_id: number; areas: FloorArea[]; tables: FloorTable[]; objects: FloorObject[] }

const n = (v: any, d: number) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));

/** Loads the plan and gives every row a stable client key. */
export async function fetchFloorLayout(locationId?: string | number): Promise<FloorLayout> {
  const res = await api(`/api/floor/layout${locationId ? `?location_id=${locationId}` : ''}`);
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Could not load the floor plan');
  const d = j.data;
  const areas: FloorArea[] = (d.areas || []).map((a: any) => ({ id: Number(a.id), key: `a${a.id}`, name: a.name, width: n(a.width, 1200), height: n(a.height, 800) }));
  const tables: FloorTable[] = (d.tables || []).map((t: any) => ({
    id: Number(t.id), key: `t${t.id}`, name: t.name, status: t.status,
    area_id: t.area_id ? Number(t.area_id) : null,
    areaKey: t.area_id && t.pos_x !== null ? `a${t.area_id}` : null,
    pos_x: n(t.pos_x, 0), pos_y: n(t.pos_y, 0), width: n(t.width, 90), height: n(t.height, 90),
    rotation: n(t.rotation, 0), shape: (t.shape || 'square') as TableShape, seats: n(t.seats, 4),
    joined_to: t.joined_to ? Number(t.joined_to) : null,
  }));
  const objects: FloorObject[] = (d.objects || []).map((o: any) => ({
    id: Number(o.id), key: `o${o.id}`, area_id: Number(o.area_id), areaKey: `a${o.area_id}`,
    kind: o.kind, label: o.label, pos_x: n(o.pos_x, 0), pos_y: n(o.pos_y, 0), width: n(o.width, 120), height: n(o.height, 12), rotation: n(o.rotation, 0),
  }));
  return { location_id: Number(d.location_id), areas, tables, objects };
}

export async function saveFloorLayout(body: {
  location_id: number;
  areas: (Omit<FloorArea, 'key'> & { tables: Partial<FloorTable>[]; objects: Partial<FloorObject>[] })[];
  deleted_area_ids: number[];
  deleted_table_ids: number[];
}) {
  const res = await api('/api/floor/save', { method: 'POST', body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Could not save the floor plan');
}

async function post(path: string, body: unknown) {
  const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Request failed');
  return j;
}

/** Seat a group across tables. Open bills on the other tables move onto the main table's bill. */
export const mergeTables = (primaryTableId: number, tableIds: number[]) =>
  post('/api/floor/merge', { primary_table_id: primaryTableId, table_ids: tableIds });

/** Split a merged group again (pass any table of the group). */
export const unmergeTables = (tableId: number) => post('/api/floor/unmerge', { table_id: tableId });
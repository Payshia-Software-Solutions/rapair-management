import { api } from './client';

export interface UnpostedRow { id: number; doc_no: string; doc_date: string | null; amount: string | number }
export interface UnpostedGroup { type: string; label: string; count: number; amount: number; rows: UnpostedRow[] }

const parse = async (res: Response) => {
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status === 'error') throw new Error(d.message || 'Request failed');
    return d;
};

export const fetchUnposted = async (): Promise<{ groups: UnpostedGroup[]; total: number; balanced: boolean }> =>
    (await parse(await api('/api/posting/unposted'))).data;

export const postUnposted = async (type: string, ids?: number[]): Promise<{ message: string; data: { posted: number; failed: number[] } }> =>
    parse(await api('/api/posting/post', { method: 'POST', body: JSON.stringify({ type, ids }) }));

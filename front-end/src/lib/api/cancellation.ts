import { api, ApiSuccess } from './client';

export interface CancelLookupResult {
    id: number;
    number: string;
    name: string;
    date: string;
    amount: string | number;
    status: string;
    items?: any[];
    impact?: CancelImpact;
}

/** What an invoice cancellation reverses (returned by lookup for invoices). */
export interface CancelImpact {
    payments: { id: number; receipt_no: string; payment_method: string; amount: string; payment_date: string; status: string | null }[];
    stock: { id: number; qty_change: string; movement_type: string; unit_cost: string | null; part_name: string | null; unit: string | null; location_name: string | null; batch_number: string | null }[];
    journals: { id: number; entry_date: string; description: string; ref_type: string; lines: { account_code: string; account_name: string; debit: string; credit: string }[] }[];
    blocker: string | null;
}

export const lookupDocument = async (type: string, number: string) => {
    const res = await api(`/api/cancellation/lookup?type=${type}&number=${number}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Document not found');
    }
    const data = await res.json();
    return data.data as CancelLookupResult;
};

export const getCancellationHistory = async (page = 1, limit = 20) => {
    const res = await api(`/api/cancellation/history?page=${page}&limit=${limit}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to fetch history');
    }
    return res.json();
};

export const processCancellation = async (type: string, id: number, reason: string) => {
    const res = await api(`/api/cancellation/process`, {
        method: 'POST',
        body: JSON.stringify({ type, id, reason })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Cancellation failed');
    }
    return res.json() as Promise<ApiSuccess<null>>;
};

// ---- Cancellation requests: someone asks, a different user (cancellations.approve / Admin) approves
export interface CancelRequest {
    id: number; doc_type: string; doc_id: number; doc_no: string | null; amount: string | number | null;
    location_name: string | null; reason: string; status: 'pending' | 'approved' | 'rejected';
    requested_by: number; requested_by_name: string | null; requested_at: string;
    decided_by: number | null; decided_by_name: string | null; decided_at: string | null; decision_note: string | null;
    can_decide: boolean;
}
const parseCr = async (res: Response) => {
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status === 'error') throw new Error(d.message || 'Request failed');
    return d;
};
export const fetchCancelRequests = async (status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending', mine = false):
    Promise<{ requests: CancelRequest[]; pending: number; can_approve: boolean; me: number; is_admin?: boolean; admin_self_approve?: boolean }> =>
    (await parseCr(await api(`/api/cancellation/requests?status=${status}${mine ? '&mine=1' : ''}`))).data;
export const approveCancelRequest = async (id: number, note = '') =>
    parseCr(await api(`/api/cancellation/approve/${id}`, { method: 'POST', body: JSON.stringify({ note }) }));
export const rejectCancelRequest = async (id: number, note = '') =>
    parseCr(await api(`/api/cancellation/reject/${id}`, { method: 'POST', body: JSON.stringify({ note }) }));
export const withdrawCancelRequest = async (id: number) =>
    parseCr(await api(`/api/cancellation/withdraw/${id}`, { method: 'POST', body: '{}' }));
/** Admin only: let admins approve their own cancellation requests. */
export const setCancelSelfApprove = async (enabled: boolean) =>
    parseCr(await api(`/api/cancellation/self_approve`, { method: 'POST', body: JSON.stringify({ enabled }) }));

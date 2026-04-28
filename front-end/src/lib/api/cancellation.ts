import { api, ApiSuccess } from './client';

export interface CancelLookupResult {
    id: number;
    number: string;
    name: string;
    date: string;
    amount: string | number;
    status: string;
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

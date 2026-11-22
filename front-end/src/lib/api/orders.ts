import { api, ApiSuccess } from './client';

export const fetchOrders = async () => {
  const res = await api('/api/order/list');
  if (!res.ok) {
    let msg = `Failed to load orders (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j && typeof j.message === 'string' && j.message) msg = j.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const rows = data.status === 'success' ? data.data : [];

  if (Array.isArray(rows) && rows.length > 0 && ('vehicle_model' in rows[0] || 'problem_description' in rows[0])) {
    return rows.map((r: any) => {
      const createdAt = typeof r.created_at === 'string' ? r.created_at.replace(' ', 'T') : new Date().toISOString();
      const expectedAtRaw =
        typeof r.expected_time === 'string'
          ? r.expected_time
          : (typeof r.expectedTime === 'string' ? r.expectedTime : null);
      const expectedTime = expectedAtRaw ? expectedAtRaw.replace(' ', 'T') : createdAt;
      const status = (r.status === 'Cancelled' ? 'Cancelled' : (r.status || 'Pending'));

      const parseJsonArray = (value: any) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      return {
        ...r,
        id: String(r.id),
        vehicleId: r.vehicle_model ?? '',
        vehicleNumber: r.vehicle_identifier || r.vehicle_vin || '',
        mileage: typeof r.mileage === 'number' ? r.mileage : (r.mileage ? Number(r.mileage) : 0),
        priority: r.priority || r.priority_level || 'Low',
        expectedTime,
        releaseTime: r.release_time ?? r.releaseTime ?? '',
        problemDescription: r.problem_description ?? '',
        checklist: parseJsonArray(r.checklist_json),
        categories: parseJsonArray(r.categories_json),
        attachments: parseJsonArray(r.attachments_json),
        comments: r.comments ?? '',
        status,
        createdAt,
        location: r.location ?? '',
        technician: r.technician ?? '',
      };
    });
  }

  return rows;
};

export const fetchOrder = async (id: string) => {
  const res = await api(`/api/order/get/${id}`);
  if (!res.ok) throw new Error('Failed to load order');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createOrder = async (order: any) => {
  const res = await api('/api/order/create', { method: 'POST', body: JSON.stringify(order) });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
};

export const deleteOrder = async (id: string) => {
  const res = await api(`/api/order/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete order');
  return res.json();
};

export const updateOrder = async (id: string, data: any) => {
  const res = await api(`/api/order/update_status/${id}`, { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update order');
  return res.json();
};

export const completeOrder = async (id: string, payload: any) => {
  const res = await api(`/api/order/complete/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to complete order');
  }
  return res.json();
};

export const updateOrderRelease = async (id: string, releaseTime: string | null) => {
  const res = await api(`/api/order/update_release/${id}`, {
    method: 'POST',
    body: JSON.stringify({ release_time: releaseTime }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to update release time');
  }
  return res.json();
};

export const rescheduleOrder = async (id: string | number, booking_date: string) => {
  const res = await api(`/api/order/reschedule/${id}`, {
    method: 'POST',
    body: JSON.stringify({ booking_date }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to reschedule order');
  }
  return res.json();
};

export const assignOrder = async (id: string, payload: { bay_name?: string; bay_id?: number; technician?: string; status?: string; release_time?: string | null }) => {
  const res = await api(`/api/order/assign/${encodeURIComponent(String(id))}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to assign order');
  }
  return res.json();
};

export const updateOrderDetails = async (id: string, payload: { categories?: string[]; checklist?: string[]; attachments?: string[] }) => {
  const res = await api(`/api/order/update_details/${encodeURIComponent(String(id))}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to update order details');
  }
  return res.json();
};

export interface OrderPartRow {
  id: number;
  order_id: number;
  part_id: number;
  quantity: number;
  price: number;
  part_name: string;
  sku: string | null;
  part_number: string | null;
  subtotal: number;
  discount_amount?: number;
  net_total?: number;
  line_total?: number;
  unit?: string;
  unit_price?: number;
  is_free_issue?: number;
  created_at?: string;
  updated_at?: string;
}

export const fetchOrderParts = async (orderId: string) => {
  const res = await api(`/api/order/parts/${orderId}`);
  if (!res.ok) throw new Error('Failed to load order parts');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const addOrderPart = async (orderId: string, payload: { part_id: number; quantity: number }) => {
  const res = await api(`/api/order/add_part/${orderId}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to add part');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const updateOrderPart = async (lineId: string, quantity: number) => {
  const res = await api(`/api/order/update_part/${lineId}`, { method: 'POST', body: JSON.stringify({ quantity }) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to update part');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteOrderPart = async (lineId: string) => {
  const res = await api(`/api/order/delete_part/${lineId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete part');
  return res.json() as Promise<ApiSuccess<null>>;
};


export const fetchChecklist = async (orderId: string) => {
  const res = await api(`/api/checklist/list/${orderId}`);
  if (!res.ok) throw new Error('Failed to load checklist');
  return res.json();
};

export const uploadOrderAttachment = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api('/api/upload/order_attachment', {
    method: 'POST',
    body: formData,
    // Note: Do NOT set Content-Type header when sending FormData,
    // the browser will set it with the correct boundary.
  });

  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Upload failed');
  }
  return res.json() as Promise<ApiSuccess<{ filename: string; url: string }>>;
};

// POS / Return Specific Operations
export const fetchPosDayLedger = async (locationId: number) => {
  const res = await api(`/api/pos/day-ledger?location_id=${locationId}`);
  if (!res.ok) throw new Error('Failed to load POS day ledger');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const holdPOSOrder = async (payload: any) => {
  const res = await api('/api/pos/hold_order', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to hold POS order');
  return res.json();
};

export const loadHeldOrder = async (id: number | string) => {
  const res = await api(`/api/pos/load-held-order/${id}`);
  if (!res.ok) throw new Error('Failed to load held order');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchHeldOrders = async (locationId?: number) => {
  const qs = locationId ? `?location_id=${locationId}` : '';
  const res = await api(`/api/pos/held-orders${qs}`);
  if (!res.ok) throw new Error('Failed to load held orders');
  const data = await res.json();
  return data.status === 'success' ? (data.data || []) : [];
};


export const fetchStewards = async (locationId?: number) => {
  const qs = locationId ? `?location_id=${locationId}` : '';
  const res = await api(`/api/pos/stewards${qs}`);
  if (!res.ok) throw new Error('Failed to load stewards');
  const data = await res.json();
  return data.status === 'success' ? (data.data || []) : [];
};

export const markKOTPrinted = async (orderId: number) => {
  const res = await api(`/api/pos/mark-kot-printed/${orderId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark KOT');
  return res.json();
};

/** People who can approve removing sent items (Admin or pos.void permission, with a PIN). */
export const fetchVoidApprovers = async (): Promise<Array<{ id: number; name: string; role: string }>> => {
  const res = await api('/api/pos/void_approvers');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load approvers');
  return data.data || [];
};

/** Remove/reduce an item already sent to the kitchen, approved with the approver's PIN. */
export const voidHeldItem = async (payload: { held_item_id: number; quantity: number; reason: string; approver_id: number; approver_pin: string }) => {
  const res = await api('/api/pos/void_held_item', { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') {
    const err: any = new Error(data.message || 'Could not remove the item');
    err.status = res.status;
    throw err;
  }
  return data.data;
};

export type CompApprover = { id: number; name: string; role: string; comp_limit: number | string | null };

/** People who can approve complimentary items (Admin or pos.comp permission, with a PIN). comp_limit null = no limit. */
export const fetchCompApprovers = async (): Promise<CompApprover[]> => {
  const res = await api('/api/pos/comp_approvers');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load approvers');
  return data.data || [];
};

/** Manager approves comping items worth `amount`. Returns a one-time token the invoice presents. */
export const approveComp = async (payload: { approver_id: number; approver_pin: string; reason: string; amount: number; held_order_id?: number | null }) => {
  const res = await api('/api/pos/approve_comp', { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') {
    const err: any = new Error(data.message || 'Could not approve');
    err.status = res.status;
    throw err;
  }
  return data.data as { token: string; approver_id: number; approver_name: string; reason: string; amount: number };
};

/** Comps (settled bills) and voids (items removed after KOT) for a period. */
export const fetchCompVoidReport = async (params: { from: string; to: string; location_id?: string | number | null }) => {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.location_id) qs.set('location_id', String(params.location_id));
  const res = await api(`/api/pos/comp_report?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load report');
  return data.data as { from: string; to: string; comps: any[]; voids: any[] };
};

/** station: only that print station's part (Kitchen / Bar ...); the response always lists `stations`. */
export const fetchKOTDetails = async (id: string | number, full: boolean = false, station?: string | number | null) => {
  const qs = new URLSearchParams();
  if (full) qs.set('full', '1');
  if (station !== undefined && station !== null && station !== '') qs.set('station', String(station));
  const res = await api(`/api/pos/kot-details/${id}${qs.toString() ? `?${qs.toString()}` : ''}`);
  if (!res.ok) throw new Error('Failed to load KOT details');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};


// Sales Returns & Refunds
export const fetchInvoiceForReturn = async (invoiceId: string | number) => {
  const res = await api(`/api/return/invoice_details/${invoiceId}`);
  if (!res.ok) throw new Error('Failed to load invoice for return');
  const data = await res.json();
  return data.data;
};

export const fetchReturnDetails = async (returnId: string | number) => {
  const res = await api(`/api/return/details/${returnId}`);
  if (!res.ok) throw new Error('Failed to load return details');
  const data = await res.json();
  return data.data;
};

export const fetchRefundPrintData = async (refundId: string | number) => {
  const res = await api(`/api/return/refund_print/${refundId}`);
  if (!res.ok) throw new Error('Failed to load refund print data');
  const data = await res.json();
  return data.data;
};

export const fetchRefunds = async (filters: any = {}) => {
  const qs = new URLSearchParams(filters).toString();
  const res = await api(`/api/return/refunds?${qs}`);
  if (!res.ok) throw new Error('Failed to load refunds');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchReturnPrintData = async (returnId: string | number) => {
  const res = await api(`/api/return/print/${returnId}`);
  if (!res.ok) throw new Error('Failed to load return print data');
  const data = await res.json();
  return data.data;
};

// Online Orders
export const fetchOnlineOrders = async () => {
  const res = await api('/api/online-order/index');
  if (!res.ok) throw new Error('Failed to load online orders');
  return res.json();
};

export const fetchOnlineOrder = async (id: string | number) => {
  const res = await api(`/api/online-order/show/${id}`);
  if (!res.ok) throw new Error('Failed to load online order');
  const data = await res.json();
  return data;
};

export const fetchPaymentLogs = async () => {
  const res = await api('/api/payment/index');
  if (!res.ok) throw new Error('Failed to load payment logs');
  return res.json();
};

/** Staff add the shipping cost to a quote-request order; the customer is emailed the new total. */
export const confirmOnlineOrderQuote = async (id: string | number, shippingFee: number, note: string) => {
  const res = await api('/api/online-order/quoteConfirm', {
    method: 'POST',
    body: JSON.stringify({ id, shipping_fee: shippingFee, note }),
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Failed to confirm quote');
  return json.data as { total_amount: number; emailed: boolean };
};

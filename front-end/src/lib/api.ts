export const api = (path: string, options: RequestInit = {}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const locationId =
    typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : null;
  const defaults: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(locationId ? { 'X-Location-Id': String(locationId) } : {}),
    },
    // JWT auth uses the Authorization header, not cookies.
    credentials: 'omit',
  };
  // Merge headers safely (caller can override).
  const merged: RequestInit = {
    ...defaults,
    ...options,
    headers: {
      ...(defaults.headers as Record<string, string>),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  };
  return fetch(`${baseUrl}${path}`, merged);
};

export interface SystemCheckItem {
  name: string;
  available: boolean;
  message: string;
}

export interface SystemCheckResponse {
  status: 'success' | 'error';
  message: string;
  checks: SystemCheckItem[];
  missingTables: string[];
}

export interface ApiSuccess<T> {
  status: 'success';
  message: string;
  data: T;
}

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

  // Backend currently returns DB-shaped orders; the UI expects RepairOrder-shaped objects.
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
        id: String(r.id),
        vehicleId: r.vehicle_model ?? '',
        mileage: typeof r.mileage === 'number' ? r.mileage : (r.mileage ? Number(r.mileage) : 0),
        priority: r.priority ?? 'Low',
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
  // Allow UI-friendly payloads (camelCase) while backend also accepts snake_case.
  const res = await api('/api/order/create', { method: 'POST', body: JSON.stringify(order) });
  if (!res.ok) throw new Error('Failed to create order');
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

export type StockTransferRow = {
  id: number;
  transfer_number: string;
  from_location_id: number;
  to_location_id: number;
  from_location_name?: string;
  to_location_name?: string;
  status: string;
  requested_at?: string | null;
  notes?: string | null;
  line_count?: number;
  total_qty?: number;
};

export const fetchTransfers = async () => {
  const res = await api('/api/stocktransfer/list');
  if (!res.ok) throw new Error('Failed to load transfers');
  const data = await res.json();
  return data.status === 'success' ? (data.data as StockTransferRow[]) : data;
};

export const createTransfer = async (payload: any) => {
  const res = await api('/api/stocktransfer/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create transfer');
  }
  return res.json();
};

export const receiveTransfer = async (id: string) => {
  const res = await api(`/api/stocktransfer/receive/${id}`, { method: 'POST' });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to receive transfer');
  }
  return res.json();
};

export const fetchTransfer = async (id: string) => {
  const res = await api(`/api/stocktransfer/get/${id}`);
  if (!res.ok) throw new Error('Failed to load transfer');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type StockRequisitionRow = {
  id: number;
  requisition_number: string;
  from_location_id?: number | null;
  from_location_name?: string | null;
  to_location_id: number;
  to_location_name?: string;
  status: string;
  requested_at?: string | null;
  notes?: string | null;
  line_count?: number;
  total_qty_requested?: number;
  total_qty_fulfilled?: number;
};

export const fetchRequisitions = async () => {
  const res = await api('/api/stockrequisition/list');
  if (!res.ok) throw new Error('Failed to load requisitions');
  const data = await res.json();
  return data.status === 'success' ? (data.data as StockRequisitionRow[]) : data;
};

export const fetchRequisition = async (id: string) => {
  const res = await api(`/api/stockrequisition/get/${id}`);
  if (!res.ok) throw new Error('Failed to load requisition');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createRequisition = async (payload: any) => {
  const res = await api('/api/stockrequisition/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create requisition');
  }
  return res.json();
};

export const approveRequisition = async (id: string) => {
  const res = await api(`/api/stockrequisition/approve/${id}`, { method: 'POST' });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to approve requisition');
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

export const fetchCategories = async () => {
  const res = await api('/api/category/list');
  if (!res.ok) throw new Error('Failed to load categories');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createCategory = async (payload: { name: string }) => {
  const res = await api('/api/category/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create category');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateCategory = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/category/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update category');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteCategory = async (id: string) => {
  const res = await api(`/api/category/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete category');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchChecklistTemplates = async () => {
  const res = await api('/api/checklistrepo/list');
  if (!res.ok) throw new Error('Failed to load checklist templates');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createChecklistTemplate = async (payload: { description: string }) => {
  const res = await api('/api/checklistrepo/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create checklist template');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateChecklistTemplate = async (id: string, payload: { description: string }) => {
  const res = await api(`/api/checklistrepo/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update checklist template');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteChecklistTemplate = async (id: string) => {
  const res = await api(`/api/checklistrepo/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete checklist template');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchReportOverview = async () => {
  const res = await api('/api/report/overview');
  if (!res.ok) throw new Error('Failed to load reports');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchReportStockBalance = async (opts: { locationId?: number | "all"; group?: "item" | "location"; q?: string; asOf?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.locationId !== undefined) qs.set("location_id", String(opts.locationId));
  if (opts.group) qs.set("group", opts.group);
  if (opts.q) qs.set("q", opts.q);
  if (opts.asOf) qs.set("as_of", opts.asOf);
  const res = await api(`/api/report/stock_balance?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load stock balance report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportLowStock = async (opts: { locationId?: number | "all"; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.locationId !== undefined) qs.set("location_id", String(opts.locationId));
  if (opts.q) qs.set("q", opts.q);
  const res = await api(`/api/report/low_stock?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load low stock report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportItemMovements = async (opts: {
  partId: number;
  locationId?: number | "all";
  from?: string;
  to?: string;
  movementType?: string;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  qs.set("part_id", String(opts.partId));
  if (opts.locationId !== undefined) qs.set("location_id", String(opts.locationId));
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  if (opts.movementType) qs.set("movement_type", opts.movementType);
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  if (opts.offset !== undefined) qs.set("offset", String(opts.offset));
  const res = await api(`/api/report/item_movements?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load item movement report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportStockTransfers = async (opts: { locationId?: number | "all"; from?: string; to?: string; status?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.locationId !== undefined) qs.set("location_id", String(opts.locationId));
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  if (opts.status) qs.set("status", opts.status);
  const res = await api(`/api/report/stock_transfers?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load stock transfer report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportVehicles = async (opts: { q?: string; departmentId?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.q) qs.set("q", opts.q);
  if (opts.departmentId) qs.set("department_id", String(opts.departmentId));
  const res = await api(`/api/report/vehicles?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load vehicle report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportVehicleHistory = async (opts: { vehicleId: number; from?: string; to?: string }) => {
  const qs = new URLSearchParams();
  qs.set("vehicle_id", String(opts.vehicleId));
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  const res = await api(`/api/report/vehicle_history?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load vehicle history report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export const fetchReportItems = async (opts: { q?: string; brandId?: number; supplierId?: number; active?: 0 | 1 | -1 } = {}) => {
  const qs = new URLSearchParams();
  if (opts.q) qs.set("q", opts.q);
  if (opts.brandId) qs.set("brand_id", String(opts.brandId));
  if (opts.supplierId) qs.set("supplier_id", String(opts.supplierId));
  if (opts.active === 0 || opts.active === 1) qs.set("active", String(opts.active));
  const res = await api(`/api/report/items?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load item report");
  const data = await res.json();
  return data.status === "success" ? (data.data as any[]) : data;
};

export type DashboardOverview = {
  ordersByStatus: Record<string, number>;
  completedToday: number;
  avgRepairHours: number;
  throughputLast7Days: Array<{ date: string; received: number; completed: number }>;
  urgentAttention: Array<{
    id: number;
    vehicle_model: string;
    priority: string;
    status: string;
    expected_time: string | null;
    created_at: string;
  }>;
  recentCompletions: Array<{ id: number; vehicle_model: string; completed_at: string }>;
  serviceBaysByStatus: Record<string, number>;
  serviceBaysTotal: number;
};

export const fetchDashboardOverview = async () => {
  const res = await api('/api/dashboard/overview');
  if (!res.ok) throw new Error('Failed to load dashboard overview');
  const data = await res.json();
  return data.status === 'success' ? (data.data as DashboardOverview) : data;
};

export const fetchTechnicians = async () => {
  const res = await api('/api/technician/list');
  if (!res.ok) throw new Error('Failed to load technicians');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createTechnician = async (payload: { name: string; role: string }) => {
  const res = await api('/api/technician/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create technician');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateTechnician = async (id: string, payload: { name: string; role: string }) => {
  const res = await api(`/api/technician/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update technician');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteTechnician = async (id: string) => {
  const res = await api(`/api/technician/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete technician');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchBays = async () => {
  const res = await api('/api/bay/list');
  if (!res.ok) throw new Error('Failed to load bays');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type BayListAllRow = {
  id: number;
  location_id: number;
  location_name: string;
  name: string;
  status: string;
  created_at?: string;
};

export const fetchBaysAll = async () => {
  const res = await api('/api/bay/list_all');
  if (!res.ok) throw new Error('Failed to load bays');
  const data = await res.json();
  if (data.status !== 'success') return data;
  return data.data as {
    location_ids: number[];
    locations: Array<{ id: number; name: string; location_type?: string }>;
    bays: BayListAllRow[];
  };
};

export const createBay = async (payload: { name: string; location_id?: number }) => {
  const res = await api('/api/bay/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create bay');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateBay = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/bay/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update bay');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteBay = async (id: string) => {
  const res = await api(`/api/bay/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete bay');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateBayStatus = async (id: string, status: string) => {
  const res = await api(`/api/bay/update_status/${id}`, { method: 'POST', body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error('Failed to update bay status');
  return res.json() as Promise<ApiSuccess<{ id: string; status: string }>>;
};

export const rbacFetchRoles = async () => {
  const res = await api('/api/rbac/roles');
  if (!res.ok) throw new Error('Failed to load roles');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const rbacCreateRole = async (payload: { name: string }) => {
  const res = await api('/api/rbac/roles_create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create role');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const rbacDeleteRole = async (id: string) => {
  const res = await api(`/api/rbac/roles_delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete role');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const rbacFetchPermissions = async () => {
  const res = await api('/api/rbac/permissions');
  if (!res.ok) throw new Error('Failed to load permissions');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const rbacFetchRolePermissions = async (roleId: string) => {
  const res = await api(`/api/rbac/role_permissions/${roleId}`);
  if (!res.ok) throw new Error('Failed to load role permissions');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const rbacSetRolePermissions = async (roleId: string, permissionKeys: string[]) => {
  const res = await api(`/api/rbac/role_permissions_set/${roleId}`, {
    method: 'POST',
    body: JSON.stringify({ permission_keys: permissionKeys }),
  });
  if (!res.ok) throw new Error('Failed to save role permissions');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const adminFetchUsers = async () => {
  const res = await api('/api/admin/users');
  if (!res.ok) throw new Error('Failed to load users');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const adminSetUserRole = async (userId: string, roleId: number) => {
  const res = await api(`/api/admin/set_user_role/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ role_id: roleId }),
  });
  if (!res.ok) throw new Error('Failed to update user role');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const adminSetUserLocation = async (userId: string, locationId: number) => {
  const res = await api(`/api/admin/set_user_location/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ location_id: locationId }),
  });
  if (!res.ok) throw new Error('Failed to update user location');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const adminFetchUserLocations = async (userId: string) => {
  const res = await api(`/api/admin/user_locations/${userId}`);
  if (!res.ok) throw new Error('Failed to load user locations');
  const data = await res.json();
  return data.status === 'success' ? (data.data as number[]) : data;
};

export const adminSetUserLocations = async (userId: string, locationIds: number[]) => {
  const res = await api(`/api/admin/set_user_locations/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ location_ids: locationIds }),
  });
  if (!res.ok) throw new Error('Failed to update user locations');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const adminSetUserActive = async (userId: string, isActive: boolean) => {
  const res = await api(`/api/admin/set_user_active/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ is_active: isActive ? 1 : 0 }),
  });
  if (!res.ok) throw new Error('Failed to update user status');
  return res.json() as Promise<ApiSuccess<null>>;
};

export type ServiceLocationRow = {
  id: number;
  name: string;
  location_type?: 'service' | 'warehouse';
  address?: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const fetchLocations = async () => {
  const res = await api('/api/location/list');
  if (!res.ok) throw new Error('Failed to load locations');
  const data = await res.json();
  return data.status === 'success' ? (data.data as ServiceLocationRow[]) : data;
};

export const createLocation = async (payload: { name: string; location_type?: string; address?: string; phone?: string }) => {
  const res = await api('/api/location/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create location');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateLocation = async (id: string, payload: { name: string; location_type?: string; address?: string; phone?: string }) => {
  const res = await api(`/api/location/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update location');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteLocation = async (id: string) => {
  const res = await api(`/api/location/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete location');
  return res.json() as Promise<ApiSuccess<null>>;
};

export type DepartmentRow = { id: number; location_id: number; name: string; created_at?: string; updated_at?: string };

export const fetchDepartments = async () => {
  const res = await api('/api/department/list');
  if (!res.ok) throw new Error('Failed to load departments');
  const data = await res.json();
  return data.status === 'success' ? (data.data as DepartmentRow[]) : data;
};

export const createDepartment = async (payload: { name: string }) => {
  const res = await api('/api/department/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create department');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateDepartment = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/department/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update department');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteDepartment = async (id: string) => {
  const res = await api(`/api/department/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete department');
  return res.json() as Promise<ApiSuccess<null>>;
};

export type CompanyRow = { id: number; name: string; address?: string | null; phone?: string | null; email?: string | null; logo_filename?: string | null };

export const fetchCompany = async () => {
  const res = await api('/api/company/get');
  if (!res.ok) throw new Error('Failed to load company');
  const data = await res.json();
  return data.status === 'success' ? (data.data as CompanyRow) : data;
};

export const updateCompany = async (payload: Partial<CompanyRow>) => {
  const res = await api('/api/company/update', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update company');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchChecklist = async (orderId: string) => {
  const res = await api(`/api/checklist/list/${orderId}`);
  if (!res.ok) throw new Error('Failed to load checklist');
  return res.json();
};

export const fetchVehicles = async () => {
  const res = await api('/api/vehicle/list');
  if (!res.ok) throw new Error('Failed to load vehicles');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type VehicleRow = {
  id: number;
  department_id: number | null;
  department_name?: string | null;
  make: string;
  model: string;
  year: number;
  vin: string;
  image_filename?: string | null;
  created_at?: string;
};

export const fetchVehicle = async (id: string) => {
  const res = await api(`/api/vehicle/get/${id}`);
  if (!res.ok) throw new Error('Failed to load vehicle');
  const data = await res.json();
  return data.status === 'success' ? (data.data as VehicleRow) : data;
};

export const fetchMakes = async () => {
  const res = await api('/api/make/list');
  if (!res.ok) throw new Error('Failed to load makes');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createMake = async (payload: { name: string }) => {
  const res = await api('/api/make/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create make');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateMake = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/make/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update make');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteMake = async (id: string) => {
  const res = await api(`/api/make/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete make');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchModels = async (makeId?: number) => {
  const qs = makeId ? `?make_id=${encodeURIComponent(String(makeId))}` : '';
  const res = await api(`/api/model/list${qs}`);
  if (!res.ok) throw new Error('Failed to load models');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createModel = async (payload: { make_id: number; name: string }) => {
  const res = await api('/api/model/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create model');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateModel = async (id: string, payload: { make_id: number; name: string }) => {
  const res = await api(`/api/model/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update model');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteModel = async (id: string) => {
  const res = await api(`/api/model/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete model');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const createVehicle = async (vehicle: any) => {
  const res = await api('/api/vehicle/create', { method: 'POST', body: JSON.stringify(vehicle) });
  if (!res.ok) throw new Error('Failed to create vehicle');
  return res.json();
};

export const updateVehicle = async (id: string, vehicle: any) => {
  const res = await api(`/api/vehicle/update/${id}`, { method: 'POST', body: JSON.stringify(vehicle) });
  if (!res.ok) throw new Error('Failed to update vehicle');
  return res.json();
};

export const deleteVehicle = async (id: string) => {
  const res = await api(`/api/vehicle/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete vehicle');
  return res.json();
};

// Inventory - Items (Parts)
export type PartRow = {
  id: number;
  sku: string | null;
  part_number?: string | null;
  barcode_number?: string | null;
  part_name: string;
  unit: string | null;
  brand_id?: number | null;
  brand_name?: string | null;
  supplier_ids?: number[];
  suppliers?: Array<{ id: number; name: string }>;
  stock_quantity: number;
  cost_price: number | null;
  price: number;
  reorder_level: number | null;
  is_active: number;
  image_filename?: string | null;
};

export const fetchParts = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/part/list${qs}`);
  if (!res.ok) throw new Error('Failed to load parts');
  const data = await res.json();
  return data.status === 'success' ? (data.data as PartRow[]) : data;
};

export const fetchPartsForSupplier = async (supplierId: number, q: string = '') => {
  const qs = `?supplier_id=${encodeURIComponent(String(supplierId))}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const res = await api(`/api/part/list${qs}`);
  if (!res.ok) throw new Error('Failed to load parts');
  const data = await res.json();
  return data.status === 'success' ? (data.data as PartRow[]) : data;
};

export const createPart = async (payload: Partial<PartRow> & { supplier_ids?: number[] }) => {
  const res = await api('/api/part/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create part');
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const updatePart = async (id: string, payload: Partial<PartRow> & { supplier_ids?: number[] }) => {
  const res = await api(`/api/part/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update part');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deletePart = async (id: string) => {
  const res = await api(`/api/part/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete part');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const adjustPartStock = async (payload: { part_id: number; qty_change: number; notes?: string }) => {
  const res = await api('/api/part/adjust_stock', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to adjust stock');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchPartMovements = async (
  id: string,
  limit: number = 200,
  locationId?: number | string,
  fromDate?: string,
  toDate?: string
) => {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (locationId !== undefined && locationId !== null && String(locationId) !== '') qs.set('location_id', String(locationId));
  if (fromDate) qs.set('from', fromDate);
  if (toDate) qs.set('to', toDate);
  const res = await api(`/api/part/movements/${id}?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load stock movements');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type LocationStockBalanceRow = PartRow & {
  system_stock_quantity?: number;
  location_stock_quantity?: number;
};

export const fetchLocationStockBalances = async (locationId: number, q: string = '') => {
  const qs = new URLSearchParams();
  qs.set('location_id', String(locationId));
  if (q) qs.set('q', q);
  const res = await api(`/api/part/location_balances?${qs.toString()}`);
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to load location stock');
  }
  const data = await res.json();
  return data.status === 'success' ? (data.data as LocationStockBalanceRow[]) : data;
};

export type StockAdjustmentRow = {
  id: number;
  part_id: number;
  part_name: string;
  sku: string | null;
  qty_change: number;
  notes: string | null;
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
};

export const fetchStockAdjustments = async (opts: { partId?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.partId) qs.set('part_id', String(opts.partId));
  qs.set('limit', String(opts.limit ?? 200));
  const res = await api(`/api/part/adjustments?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load stock adjustments');
  const data = await res.json();
  return data.status === 'success' ? (data.data as StockAdjustmentRow[]) : data;
};

// Stock Adjustment Batches (header + lines)
export type StockAdjustmentBatchRow = {
  id: number;
  location_id?: number;
  location_name?: string | null;
  adjustment_number: string;
  adjusted_at: string;
  reason: string | null;
  notes: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  line_count: number;
  total_qty_change: number | null;
};

export type StockAdjustmentBatchItem = {
  id: number;
  stock_adjustment_id: number;
  part_id: number;
  part_name: string;
  sku: string | null;
  unit: string | null;
  system_stock?: number;
  physical_stock?: number;
  qty_change: number;
  notes: string | null;
  created_at: string;
};

export const fetchStockAdjustmentBatches = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/stockadjustment/list${qs}`);
  if (!res.ok) throw new Error('Failed to load stock adjustments');
  const data = await res.json();
  return data.status === 'success' ? (data.data as StockAdjustmentBatchRow[]) : data;
};

export const fetchStockAdjustmentBatchesForLocation = async (q: string = '', locationId?: number) => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/stockadjustment/list${qs}`, {
    headers: locationId ? { 'X-Location-Id': String(locationId) } : {},
  });
  if (!res.ok) throw new Error('Failed to load stock adjustments');
  const data = await res.json();
  return data.status === 'success' ? (data.data as StockAdjustmentBatchRow[]) : data;
};

export const fetchStockAdjustmentBatch = async (id: string) => {
  const res = await api(`/api/stockadjustment/get/${id}`);
  if (!res.ok) throw new Error('Failed to load stock adjustment');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchStockAdjustmentBatchForLocation = async (id: string, locationId?: number) => {
  const res = await api(`/api/stockadjustment/get/${id}`, {
    headers: locationId ? { 'X-Location-Id': String(locationId) } : {},
  });
  if (!res.ok) throw new Error('Failed to load stock adjustment');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createStockAdjustmentBatch = async (payload: {
  adjusted_at?: string;
  reason?: string;
  notes?: string;
  items: Array<{ part_id: number; qty_change: number; notes?: string }>;
}) => {
  const res = await api('/api/stockadjustment/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create stock adjustment');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const createStockAdjustmentBatchForLocation = async (
  payload: {
    adjusted_at?: string;
    reason?: string;
    notes?: string;
    items: Array<{ part_id: number; physical_stock: number; notes?: string; include_when_zero?: boolean }>;
  },
  locationId?: number
) => {
  const res = await api('/api/stockadjustment/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: locationId ? { 'X-Location-Id': String(locationId) } : {},
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create stock adjustment');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

// Inventory - Suppliers
export type SupplierRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_reg_no?: string | null;
  is_active: number;
  tax_ids?: number[];
  taxes?: TaxRow[];
};

export const fetchSuppliers = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/supplier/list${qs}`);
  if (!res.ok) throw new Error('Failed to load suppliers');
  const data = await res.json();
  return data.status === 'success' ? (data.data as SupplierRow[]) : data;
};

export const fetchSupplier = async (id: string) => {
  const res = await api(`/api/supplier/get/${id}`);
  if (!res.ok) throw new Error('Failed to load supplier');
  const data = await res.json();
  return data.status === 'success' ? (data.data as SupplierRow) : data;
};

export const createSupplier = async (payload: Partial<SupplierRow>) => {
  const res = await api('/api/supplier/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create supplier');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateSupplier = async (id: string, payload: Partial<SupplierRow>) => {
  const res = await api(`/api/supplier/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update supplier');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteSupplier = async (id: string) => {
  const res = await api(`/api/supplier/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete supplier');
  return res.json() as Promise<ApiSuccess<null>>;
};

// Inventory - Purchase Orders
export type PurchaseOrderRow = {
  id: number;
  location_id: number;
  location_name?: string | null;
  supplier_id: number;
  supplier_name?: string;
  po_number: string;
  status: string;
  notes: string | null;
  ordered_at: string | null;
  expected_at: string | null;
  last_grn_number?: string | null;
  created_at: string;
};
export type PurchaseOrderItemRow = {
  id?: number;
  purchase_order_id?: number;
  part_id: number;
  part_name?: string;
  sku?: string | null;
  qty_ordered: number;
  unit_cost: number;
  received_qty?: number;
  line_total?: number;
};

export const fetchPurchaseOrders = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/purchase/list${qs}`);
  if (!res.ok) throw new Error('Failed to load purchase orders');
  const data = await res.json();
  return data.status === 'success' ? (data.data as PurchaseOrderRow[]) : data;
};

export const fetchPurchaseOrder = async (id: string) => {
  const res = await api(`/api/purchase/get/${id}`);
  if (!res.ok) throw new Error('Failed to load purchase order');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createPurchaseOrder = async (payload: { supplier_id: number; notes?: string; ordered_at?: string | null; expected_at?: string | null; items: PurchaseOrderItemRow[] }) => {
  const res = await api('/api/purchase/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create purchase order');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const updatePurchaseOrder = async (id: string, payload: { supplier_id: number; notes?: string; ordered_at?: string | null; expected_at?: string | null; items: PurchaseOrderItemRow[] }) => {
  const res = await api(`/api/purchase/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to update purchase order');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const setPurchaseOrderStatus = async (id: string, status: string) => {
  const res = await api(`/api/purchase/set_status/${id}`, { method: 'POST', body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error('Failed to update PO status');
  return res.json() as Promise<ApiSuccess<null>>;
};

// Inventory - GRN
export type GrnRow = {
  id: number;
  grn_number: string;
  purchase_order_id: number | null;
  location_id?: number;
  location_name?: string | null;
  supplier_id: number;
  supplier_name?: string;
  po_number?: string | null;
  received_at: string;
  notes: string | null;
  created_at: string;
};
export type GrnItemRow = {
  id?: number;
  grn_id?: number;
  part_id: number;
  part_name?: string;
  sku?: string | null;
  qty_received: number;
  unit_cost: number;
  line_total?: number;
};

export const fetchGrns = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/grn/list${qs}`);
  if (!res.ok) throw new Error('Failed to load GRNs');
  const data = await res.json();
  return data.status === 'success' ? (data.data as GrnRow[]) : data;
};

export const fetchGrn = async (id: string) => {
  const res = await api(`/api/grn/get/${id}`);
  if (!res.ok) throw new Error('Failed to load GRN');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const createGrn = async (
  payload: { supplier_id: number; purchase_order_id?: number | null; received_at: string; notes?: string; items: GrnItemRow[] },
  locationIdOverride?: number | null
) => {
  const headers: Record<string, string> = {};
  if (locationIdOverride && Number.isFinite(locationIdOverride)) {
    headers["X-Location-Id"] = String(locationIdOverride);
  }

  const res = await api('/api/grn/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...(Object.keys(headers).length ? { headers } : {}),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create GRN');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

// Orders - Parts used
export type OrderPartRow = {
  id: number;
  order_id: number;
  part_id: number;
  part_name?: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  line_total: number | null;
};

// Units
export type UnitRow = { id: number; name: string; created_at?: string; updated_at?: string };

export const fetchUnits = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/unit/list${qs}`);
  if (!res.ok) throw new Error('Failed to load units');
  const data = await res.json();
  return data.status === 'success' ? (data.data as UnitRow[]) : data;
};

export const createUnit = async (payload: { name: string }) => {
  const res = await api('/api/unit/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create unit');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateUnit = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/unit/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update unit');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteUnit = async (id: string) => {
  const res = await api(`/api/unit/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete unit');
  return res.json() as Promise<ApiSuccess<null>>;
};

// Brands
export type BrandRow = { id: number; name: string; created_at?: string; updated_at?: string };

export const fetchBrands = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/brand/list${qs}`);
  if (!res.ok) throw new Error('Failed to load brands');
  const data = await res.json();
  return data.status === 'success' ? (data.data as BrandRow[]) : data;
};

export const createBrand = async (payload: { name: string }) => {
  const res = await api('/api/brand/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create brand');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateBrand = async (id: string, payload: { name: string }) => {
  const res = await api(`/api/brand/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update brand');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteBrand = async (id: string) => {
  const res = await api(`/api/brand/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete brand');
  return res.json() as Promise<ApiSuccess<null>>;
};

// Taxes
export type TaxRow = {
  id: number;
  code: string;
  name: string;
  rate_percent: number;
  apply_on: 'base' | 'base_plus_previous';
  sort_order: number;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

export const fetchTaxes = async (q: string = '', opts?: { all?: boolean }) => {
  const params: string[] = [];
  if (q) params.push(`q=${encodeURIComponent(q)}`);
  if (opts?.all) params.push(`all=1`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await api(`/api/tax/list${qs}`);
  if (!res.ok) throw new Error('Failed to load taxes');
  const data = await res.json();
  return data.status === 'success' ? (data.data as TaxRow[]) : data;
};

export const createTax = async (payload: {
  code: string;
  name: string;
  rate_percent: number;
  apply_on: 'base' | 'base_plus_previous';
  sort_order: number;
  is_active: 0 | 1;
}) => {
  const res = await api('/api/tax/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create tax');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateTax = async (
  id: string,
  payload: {
    code: string;
    name: string;
    rate_percent: number;
    apply_on: 'base' | 'base_plus_previous';
    sort_order: number;
    is_active: 0 | 1;
  }
) => {
  const res = await api(`/api/tax/update/${id}`, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update tax');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteTax = async (id: string) => {
  const res = await api(`/api/tax/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete tax');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const fetchOrderParts = async (orderId: string) => {
  const res = await api(`/api/order/parts/${orderId}`);
  if (!res.ok) throw new Error('Failed to load order parts');
  const data = await res.json();
  return data.status === 'success' ? (data.data as OrderPartRow[]) : data;
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
export const checkTables = async () => {
  const res = await api('/api/check/check');
  if (!res.ok) throw new Error('Failed to check database tables');
  return res.json() as Promise<SystemCheckResponse>;
};

export const CONTENT_BASE_URL =
  (process.env.NEXT_PUBLIC_CONTENT_BASE_URL ?? 'https://content-provider.payshia.com/service-center-system/').replace(/\/+$/, '') + '/';

export const contentUrl = (folder: 'vehicles' | 'orders' | 'items', filename: string) => {
  const safe = filename.replace(/^\/+/, '');
  return `${CONTENT_BASE_URL}${folder}/${encodeURIComponent(safe)}`;
};

export const uploadVehicleImage = async (file: File) => {
  const fd = new FormData();
  fd.append('image', file);
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const locationId =
    typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/upload/vehicle_image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(locationId ? { 'X-Location-Id': String(locationId) } : {}),
    },
    body: fd,
    credentials: 'omit',
  });
  if (!res.ok) throw new Error('Failed to upload image');
  return res.json() as Promise<ApiSuccess<{ filename: string; url: string }>>;
};

export const uploadOrderAttachment = async (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const locationId =
    typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/upload/order_attachment`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(locationId ? { 'X-Location-Id': String(locationId) } : {}),
    },
    body: fd,
    credentials: 'omit',
  });
  if (!res.ok) throw new Error('Failed to upload attachment');
  return res.json() as Promise<ApiSuccess<{ filename: string; url: string }>>;
};

export const uploadPartImage = async (file: File) => {
  const fd = new FormData();
  fd.append('image', file);
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const locationId =
    typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/upload/part_image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(locationId ? { 'X-Location-Id': String(locationId) } : {}),
    },
    body: fd,
    credentials: 'omit',
  });
  if (!res.ok) throw new Error('Failed to upload image');
  return res.json() as Promise<ApiSuccess<{ filename: string; url: string }>>;
};

export const fetchPart = async (id: string) => {
  const res = await api(`/api/part/get/${id}`);
  if (!res.ok) throw new Error('Failed to load part');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export type LocationStock = {
  part_id: number;
  location_id: number;
  on_hand: number;
  reserved: number;
  available: number;
};

export const fetchPartLocationStock = async (partId: string | number, locationId: string | number) => {
  const pid = encodeURIComponent(String(partId));
  const lid = encodeURIComponent(String(locationId));
  const res = await api(`/api/part/location_stock/${pid}?location_id=${lid}`);
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to load location stock');
  }
  const data = await res.json();
  return data.status === 'success' ? (data.data as LocationStock) : (data as LocationStock);
};

export const setPartImage = async (id: string, filename: string) => {
  const res = await api(`/api/part/set_image/${id}`, { method: 'POST', body: JSON.stringify({ image_filename: filename }) });
  if (!res.ok) throw new Error('Failed to set image');
  return res.json() as Promise<ApiSuccess<null>>;
};

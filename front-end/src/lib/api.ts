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
        problemDescription: r.problem_description ?? '',
        checklist: parseJsonArray(r.checklist_json),
        categories: parseJsonArray(r.categories_json),
        attachments: parseJsonArray(r.attachments_json),
        comments: r.comments ?? '',
        status,
        createdAt,
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

export const createBay = async (payload: { name: string }) => {
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

export type ServiceLocationRow = {
  id: number;
  name: string;
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

export const createLocation = async (payload: { name: string; address?: string; phone?: string }) => {
  const res = await api('/api/location/create', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to create location');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateLocation = async (id: string, payload: { name: string; address?: string; phone?: string }) => {
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
export const checkTables = async () => {
  const res = await api('/api/check/check');
  if (!res.ok) throw new Error('Failed to check database tables');
  return res.json() as Promise<SystemCheckResponse>;
};

export const CONTENT_BASE_URL =
  (process.env.NEXT_PUBLIC_CONTENT_BASE_URL ?? 'https://content-provider.payshia.com/service-center-system/').replace(/\/+$/, '') + '/';

export const contentUrl = (folder: 'vehicles' | 'orders', filename: string) => {
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

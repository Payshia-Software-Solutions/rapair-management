export const api = (path: string, options: RequestInit = {}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
  const defaults: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  if (!res.ok) throw new Error('Failed to load orders');
  const data = await res.json();
  const rows = data.status === 'success' ? data.data : [];

  // Backend currently returns DB-shaped orders; the UI expects RepairOrder-shaped objects.
  if (Array.isArray(rows) && rows.length > 0 && ('vehicle_model' in rows[0] || 'problem_description' in rows[0])) {
    return rows.map((r: any) => {
      const createdAt = typeof r.created_at === 'string' ? r.created_at.replace(' ', 'T') : new Date().toISOString();
      const status = (r.status === 'Cancelled' ? 'Cancelled' : (r.status || 'Pending'));
      return {
        id: String(r.id),
        vehicleId: r.vehicle_model ?? '',
        mileage: 0,
        priority: 'Low',
        expectedTime: createdAt,
        problemDescription: r.problem_description ?? '',
        checklist: [],
        categories: [],
        comments: '',
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

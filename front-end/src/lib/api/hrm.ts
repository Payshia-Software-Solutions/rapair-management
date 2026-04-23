export { api } from './client';
import { api, ApiSuccess } from './client';

export type EmployeeRow = {
  id: number;
  employee_code: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  nic?: string | null;
  dob?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;

  // Advanced Fields
  nationality?: string | null;
  religion?: string | null;
  marital_status?: 'Single' | 'Married' | 'Divorced' | 'Widowed' | null;
  blood_group?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  passport_no?: string | null;
  epf_no?: string | null;
  etf_no?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;

  category_id?: number | null;
  category_name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  designation?: string | null;
  joined_date?: string | null;
  basic_salary: number;
  status: 'Active' | 'Inactive' | 'Terminated' | 'Resigned';
  avatar_url?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const fetchEmployees = async (q: string = '') => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api(`/api/employee/list${qs}`);
  if (!res.ok) throw new Error('Failed to load employees');
  const data = await res.json();
  return data.status === 'success' ? (data.data as EmployeeRow[]) : [];
};

export const fetchEmployee = async (id: string | number) => {
  const res = await api(`/api/employee/get/${id}`);
  if (!res.ok) throw new Error('Failed to load employee');
  const data = await res.json();
  return data.status === 'success' ? (data.data as EmployeeRow) : null;
};

export const createEmployee = async (payload: Partial<EmployeeRow> | FormData) => {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  const res = await api('/api/employee/create', { method: 'POST', body });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to create employee');
  }
  return res.json() as Promise<ApiSuccess<{ id: number }>>;
};

export const updateEmployee = async (id: string | number, payload: Partial<EmployeeRow> | FormData) => {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  const res = await api(`/api/employee/update/${id}`, { method: 'POST', body });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to update employee');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const deleteEmployee = async (id: string | number) => {
  const res = await api(`/api/employee/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete employee');
  return res.json() as Promise<ApiSuccess<null>>;
};

export const generateEmployeeCode = async (deptId: number, catId: number) => {
  const res = await api(`/api/employee/generate_code?department_id=${deptId}&category_id=${catId}`);
  if (!res.ok) throw new Error('Failed to generate code');
  const data = await res.json();
  return data.status === 'success' ? (data.data.code as string) : '';
};

// HR Meta Data
export type HRDepartmentRow = {
  id: number;
  name: string;
  prefix: string;
};

export type HRCategoryRow = {
  id: number;
  name: string;
  prefix: string;
};

export const fetchHRDepartments = async () => {
  const res = await api('/api/hrsettings/departments');
  if (!res.ok) throw new Error('Failed to load HR departments');
  const data = await res.json();
  return data.status === 'success' ? (data.data as HRDepartmentRow[]) : [];
};

export const fetchHRCategories = async () => {
  const res = await api('/api/hrsettings/categories');
  if (!res.ok) throw new Error('Failed to load employee categories');
  const data = await res.json();
  return data.status === 'success' ? (data.data as HRCategoryRow[]) : [];
};

// Salary Templates (Recurring Per Employee)
export type SalaryItemRow = {
  id: number;
  employee_id: number;
  name: string;
  amount: number;
  type: 'Allowance' | 'Deduction';
  is_recurring: number;
};

export const fetchSalaryItems = async (employeeId: number) => {
  const res = await api(`/api/hrsettings/salary_items?employee_id=${employeeId}`);
  if (!res.ok) throw new Error('Failed to load salary items');
  const data = await res.json();
  return data.status === 'success' ? (data.data as SalaryItemRow[]) : [];
};

export const saveSalaryItem = async (payload: Partial<SalaryItemRow>) => {
  const res = await api('/api/hrsettings/salary_items', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to save salary item');
  return res.json();
};

export const deleteSalaryItem = async (id: number) => {
  const res = await api(`/api/hrsettings/salary_items?id=${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove salary item');
  return res.json();
};

// Global Salary Schemes (Templates)
export type SalaryTemplateRow = {
  id: number;
  name: string;
  items?: {
    id: number;
    template_id: number;
    name: string;
    amount: number;
    type: 'Allowance' | 'Deduction';
  }[];
};

export const fetchSalaryTemplates = async (id?: number) => {
  const qs = id ? `?id=${id}` : '';
  const res = await api(`/api/hrsettings/salary_templates${qs}`);
  if (!res.ok) throw new Error('Failed to load salary schemes');
  const data = await res.json();
  return data.status === 'success' ? (data.data as SalaryTemplateRow[] | SalaryTemplateRow) : [];
};

export const saveSalaryTemplate = async (payload: any) => {
  const res = await api('/api/hrsettings/salary_templates', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update salary scheme');
  return res.json();
};

export const deleteSalaryTemplate = async (id: number, type: 'scheme' | 'item' = 'scheme') => {
  const res = await api(`/api/hrsettings/salary_templates?id=${id}&type=${type}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete salary scheme');
  return res.json();
};

export const applySalaryTemplateToEmployee = async (employeeId: number, templateId: number) => {
  const res = await api('/api/hrsettings/apply_template', { 
    method: 'POST', 
    body: JSON.stringify({ employee_id: employeeId, template_id: templateId }) 
  });
  if (!res.ok) throw new Error('Failed to apply salary scheme');
  return res.json();
};

// Documents
export type EmployeeDocumentRow = {
  id: number;
  employee_id: number;
  title: string;
  file_path: string;
  file_name?: string;
  file_type?: string;
  created_at: string;
};

export const fetchEmployeeDocuments = async (employeeId: number | string) => {
  const res = await api(`/api/hrdocument/list/${employeeId}`);
  if (!res.ok) throw new Error('Failed to load employee documents');
  const data = await res.json();
  return data.status === 'success' ? (data.data as EmployeeDocumentRow[]) : [];
};

export const deleteEmployeeDocument = async (id: number | string) => {
  const res = await api(`/api/hrdocument/delete/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
};

// HR Settings
export const fetchHRSettings = async () => {
    const res = await api('/api/hrsettings/settings');
    if (!res.ok) throw new Error('Failed to load HR settings');
    const data = await res.json();
    return data.status === 'success' ? (data.data as Record<string, string>) : {};
};

export const updateHRSettings = async (payload: Record<string, string>) => {
    const res = await api('/api/hrsettings/settings', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to update HR settings');
    return res.json();
};

// Attendance
export type AttendanceRow = {
  id: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  status: 'Present' | 'Absent' | 'Late' | 'Half-Day';
  notes?: string | null;
};

export const fetchAttendance = async (date?: string, employeeId?: number | string) => {
  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  if (employeeId) qs.set('employee_id', String(employeeId));
  const res = await api(`/api/attendance/list?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load attendance');
  const data = await res.json();
  return data.status === 'success' ? (data.data as AttendanceRow[]) : [];
};

export const logAttendance = async (payload: Partial<AttendanceRow>) => {
  const res = await api('/api/attendance/log', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to record attendance');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

// Leave Types
export type LeaveTypeRow = {
  id: number;
  name: string;
  allocation_per_year: number;
};

export const fetchLeaveTypes = async () => {
  const res = await api('/api/leave/types');
  if (!res.ok) throw new Error('Failed to load leave types');
  const data = await res.json();
  return data.status === 'success' ? (data.data as LeaveTypeRow[]) : [];
};

// Leave Requests
export type LeaveRequestRow = {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  approved_by?: number | null;
  approved_at?: string | null;
  created_at: string;
};

export const fetchLeaveRequests = async (status?: string, employeeId?: number | string) => {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (employeeId) qs.set('employee_id', String(employeeId));
  const res = await api(`/api/leave/requests?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load leave requests');
  const data = await res.json();
  return data.status === 'success' ? (data.data as LeaveRequestRow[]) : [];
};

export const createLeaveRequest = async (payload: any) => {
  const res = await api('/api/leave/create_request', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to submit leave request');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updateLeaveStatus = async (id: number | string, status: string) => {
  const res = await api('/api/leave/update_status', { 
    method: 'POST', 
    body: JSON.stringify({ id, status }) 
  });
  if (!res.ok) throw new Error('Failed to update leave status');
  return res.json() as Promise<ApiSuccess<null>>;
};

// Payroll
export type PayrollRow = {
  id: number;
  employee_id: number;
  employee_name?: string;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  breakdown?: string | null;
  status: 'Draft' | 'Approved' | 'Paid';
  paid_at?: string | null;
  created_at: string;
};

export const fetchPayroll = async (month?: number, year?: number) => {
  const qs = new URLSearchParams();
  if (month) qs.set('month', String(month));
  if (year) qs.set('year', String(year));
  const res = await api(`/api/payroll/list?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load payroll');
  const data = await res.json();
  return data.status === 'success' ? (data.data as PayrollRow[]) : [];
};

export const generatePayroll = async (payload: { month: number; year: number; employee_id?: number }) => {
  const res = await api('/api/payroll/generate', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || 'Failed to generate payroll');
  }
  return res.json() as Promise<ApiSuccess<null>>;
};

export const updatePayrollStatus = async (id: number | string, status: string) => {
  const res = await api('/api/payroll/update_status', { 
    method: 'POST', 
    body: JSON.stringify({ id, status }) 
  });
  if (!res.ok) throw new Error('Failed to update payroll status');
  return res.json() as Promise<ApiSuccess<null>>;
};

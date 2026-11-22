import { api } from './client';

/** Approval workflow (server: ApprovalController / helpers/Approval.php). */

export type ApprovalLevel = {
  level_no?: number;
  label: string | null;
  approver_type: 'role' | 'user';
  role_id: number | null;
  user_id: number | null;
  min_amount: number | null;
  location_id: number | null;
};

export type ApprovalTypeRule = {
  doc_type: string;
  label: string;
  enabled: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  levels: ApprovalLevel[];
};

export type ApprovalItem = {
  id: number;
  doc_type: string;
  doc_type_label: string;
  doc_id: number;
  doc_no: string | null;
  summary: string | null;
  amount: number | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';
  current_level: number | null;
  level_label: string | null;
  level_count: number | null;
  requested_by: string | null;
  created_at: string;
  href: string;
};

const parse = async (res: Response) => {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.status === 'error') throw new Error(d.message || `Request failed (HTTP ${res.status})`);
  return d;
};

export const fetchApprovalRules = async (): Promise<{
  types: ApprovalTypeRule[];
  roles: { id: number; name: string }[];
  users: { id: number; name: string; email: string; phone: string | null; role: string | null }[];
  locations: { id: number; name: string }[];
}> => (await parse(await api('/api/approval/rules'))).data;

export const saveApprovalRule = async (rule: Omit<ApprovalTypeRule, 'label'>) =>
  parse(await api('/api/approval/save_rules', { method: 'POST', body: JSON.stringify(rule) }));

export const fetchApprovalInbox = async (): Promise<ApprovalItem[]> => (await parse(await api('/api/approval/inbox'))).data || [];
export const fetchMyApprovalRequests = async (): Promise<ApprovalItem[]> => (await parse(await api('/api/approval/mine'))).data || [];
export const fetchApprovalCount = async (): Promise<number> => Number((await parse(await api('/api/approval/count'))).data?.count || 0);

export const fetchApprovalHistory = async (id: number): Promise<{ request: any; actions: { id: number; level_no: number | null; user_name: string | null; action: string; comment: string | null; created_at: string }[] }> =>
  (await parse(await api(`/api/approval/history/${id}`))).data;

export const actOnApproval = async (id: number, decision: 'approve' | 'reject', comment?: string) =>
  parse(await api(`/api/approval/act/${id}`, { method: 'POST', body: JSON.stringify({ decision, comment }) }));

export const withdrawApproval = async (id: number) =>
  parse(await api(`/api/approval/withdraw/${id}`, { method: 'POST' }));

export const submitPurchaseOrderForApproval = async (poId: number) =>
  parse(await api(`/api/purchase/submit_approval/${poId}`, { method: 'POST' }));

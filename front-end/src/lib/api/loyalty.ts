import { api } from './client';

/** Loyalty & Rewards module (server: LoyaltyController, SaaS module "loyalty"). */

export interface LoyaltySettings {
  enabled: string; program_name: string; sms_on_earn?: string; sms_on_tier_up?: string;
  earn_amount: string; earn_points: string; earn_basis: 'pre_tax' | 'total'; min_bill: string;
  point_value: string; min_redeem: string; max_redeem_pct: string; expiry_months: string;
  tier_basis: 'spend_12m' | 'lifetime_points'; auto_enroll: string;
}

export interface LoyaltyTier {
  id?: number; name: string; color: string; threshold: number | string; multiplier: number | string;
  discount_pct: number | string; birthday_points: number | string; is_active?: number | string;
}

export interface LoyaltyMemberRow {
  id: number; customer_id: number; member_no: string; points_balance: number; lifetime_points: number;
  is_active: number; joined_at: string; tier_locked: number;
  name: string; phone?: string; email?: string; tier_name?: string; tier_color?: string;
}

export interface LoyaltyLedgerLine {
  id: number; type: 'earn' | 'redeem' | 'expire' | 'adjust' | 'reverse' | 'bonus'; points: number; amount: number;
  invoice_id?: number; invoice_no?: string; note?: string; expires_at?: string; created_at: string; user_name?: string;
}

export interface LoyaltyProfile {
  member: any;
  customer: { name: string; phone?: string; email?: string };
  tier_basis: 'spend_12m' | 'lifetime_points';
  tier_metric: number;
  next_tier: { name: string; color: string; threshold: number; remaining: number } | null;
  point_value: number;
  program: string;
  expiring_30d: number;
  ledger?: LoyaltyLedgerLine[];
}

export interface LoyaltyLookup {
  enabled: boolean; program?: string; walk_in?: boolean; auto_enroll?: boolean;
  rules?: { point_value: number; min_redeem: number; max_redeem_pct: number };
  member?: { member_no: string; points: number; tier: string; tier_color: string; multiplier: number; active: boolean; discount_pct: number } | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Request failed');
  return j.data as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const fetchLoyaltySettings = () => call<{ settings: LoyaltySettings; tiers: LoyaltyTier[] }>('/api/loyalty/settings');
export const saveLoyaltySettings = (settings: Partial<LoyaltySettings>) => call<null>('/api/loyalty/settings', post({ settings }));
export const saveLoyaltyTiers = (tiers: LoyaltyTier[], deleted_ids: number[]) => call<LoyaltyTier[]>('/api/loyalty/tiers', post({ tiers, deleted_ids }));

export const fetchLoyaltyMembers = (q = '', tier = 0) =>
  call<LoyaltyMemberRow[]>(`/api/loyalty/members?q=${encodeURIComponent(q)}${tier ? `&tier=${tier}` : ''}`);
export const fetchLoyaltyMember = (customerId: number) => call<LoyaltyProfile>(`/api/loyalty/member?customer_id=${customerId}`);
export const enrollLoyaltyMember = (customerId: number) => call<LoyaltyProfile>('/api/loyalty/enroll', post({ customer_id: customerId }));
export const adjustLoyaltyPoints = (customerId: number, points: number, reason: string) =>
  call<LoyaltyProfile>('/api/loyalty/adjust', post({ customer_id: customerId, points, reason }));
export const updateLoyaltyMember = (customerId: number, patch: { tier_id?: number | null; tier_locked?: boolean; is_active?: boolean; reason?: string }) =>
  call<LoyaltyProfile>('/api/loyalty/member_update', post({ customer_id: customerId, ...patch }));

export const lookupLoyalty = (customerId: number) => call<LoyaltyLookup>(`/api/loyalty/lookup?customer_id=${customerId}`);
export const fetchLoyaltyStats = () => call<{
  enabled: boolean; program: string; members: number; points_outstanding: number; liability: number;
  earned_this_month: number; redeemed_this_month: number; by_tier: { id: number; name: string; color: string; n: number }[];
}>('/api/loyalty/stats');

export const runLoyaltyJobs = () => call<{ expired_members: number; expired_points: number; birthdays: number; tier_changes: number }>('/api/loyalty/run_jobs', post({}));
export const fetchLoyaltyReports = () => call<{
  months: { ym: string; earned: number; redeemed: number; expired: number; reversed: number; redeemed_value: number; bills: number }[];
  top: { customer_id: number; member_no: string; name: string; phone?: string; points_balance: number; lifetime_points: number; tier_name?: string; tier_color?: string; spend_12m: number }[];
  expiring: { customer_id: number; member_no: string; name: string; phone?: string; points_balance: number; expiring: number; first_expiry: string }[];
  redemption_rate: number; point_value: number; last_daily_run: string;
}>('/api/loyalty/reports');

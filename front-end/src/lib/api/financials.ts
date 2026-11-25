import { api } from './client';

export interface FsNode { id: number; code: string; name: string; type: string; level: number; is_group: number; values: number[]; children: FsNode[] }
export interface PnlSection { key: string; label: string; kind: 'income' | 'expense' | 'total' | 'grand'; values: number[]; lines?: FsNode[] }
export interface Pnl { period: { from: string; to: string; cfrom: string | null; cto: string | null }; sections: PnlSection[]; margins: { gross: (number | null)[]; net: (number | null)[] } }
export interface BalanceSheet {
    as_of: string; cas_of: string | null;
    assets: { lines: FsNode[]; total: number[] };
    liabilities: { lines: FsNode[]; total: number[] };
    equity: { lines: FsNode[]; profit: number[]; total: number[] };
    total_le: number[]; balanced: boolean[];
}

const get = async (path: string) => {
    const res = await api(path);
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status === 'error') throw new Error(d.message || 'Failed to load statement');
    return d.data;
};

export const fetchPnl = (p: { from: string; to: string; cfrom?: string; cto?: string; location_id?: string }): Promise<Pnl> =>
    get(`/api/financials/pnl?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`);

export const fetchBalanceSheet = (p: { as_of: string; cas_of?: string; location_id?: string }): Promise<BalanceSheet> =>
    get(`/api/financials/balance_sheet?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`);

export interface CardClearing {
    balance: number;
    by_day: { day: string; taken: string }[];
    settlements: { id: number; entry_date: string; description: string; gross: string }[];
    banks: { id: number; code: string; name: string }[];
}
export const fetchCardClearing = (): Promise<CardClearing> => get('/api/financials/card_clearing');
export const postCardSettlement = async (p: { date: string; gross: number; commission: number; bank_account_id?: number; reference?: string }) => {
    const res = await api('/api/financials/card_settlement', { method: 'POST', body: JSON.stringify(p) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status === 'error') throw new Error(d.message || 'Failed to post settlement');
    return d;
};

export interface CashFlowLine { code: string; name: string; amount: number }
export interface CashFlow {
    from: string; to: string;
    operating: { net_profit: number; depreciation: number; working_capital: CashFlowLine[]; total: number };
    investing: { lines: CashFlowLine[]; total: number };
    financing: { lines: CashFlowLine[]; total: number };
    net_change: number; opening_cash: number; closing_cash: number; difference: number;
    non_cash: { description: string; count: number; amount: number }[];
}
export const fetchCashFlow = (p: { from: string; to: string; location_id?: string }): Promise<CashFlow> =>
    get(`/api/financials/cash_flow?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`);

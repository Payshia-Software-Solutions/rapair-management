"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { fetchAccounts, createAccount } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Acc = {
  id: number; parent_id: number | null; level: number; is_group: number | string; code: string; name: string;
  type: string; category: string | null; balance: string | number; is_system: number | string;
};
type Node = Acc & { children: Node[]; total: number };

const CREDIT = ["LIABILITY", "EQUITY", "INCOME"];
const money = (v: number) => {
  const s = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
};
const LEVEL_LABEL = ["", "Class", "Group", "Sub-group", "Ledger"];

/**
 * Chart of accounts as a 4-level tree: Class > Group > Sub-group > Ledger.
 * Only ledgers (level 4) take postings; group totals roll up from them.
 */
export default function ChartOfAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ parent_id: "", code: "", name: "", opening_balance: "", as_of_date: new Date().toISOString().slice(0, 10), is_bank: false });

  const load = async () => {
    setLoading(true);
    try { setAccounts(await fetchAccounts({ include_groups: 1 }) || []); }
    catch { toast({ title: "Couldn't load accounts", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // Build tree with natural-sign roll-up (credit-nature accounts shown positive)
  const roots = useMemo(() => {
    const map = new Map<number, Node>();
    accounts.forEach(a => map.set(Number(a.id), { ...a, children: [], total: 0 }));
    const top: Node[] = [];
    map.forEach(n => {
      const p = n.parent_id ? map.get(Number(n.parent_id)) : undefined;
      if (p) p.children.push(n); else top.push(n);
    });
    const sum = (n: Node): number => {
      n.children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const own = Number(n.balance || 0) * (CREDIT.includes(n.type) ? -1 : 1);
      n.total = Number(n.is_group) ? n.children.reduce((s, c) => s + sum(c), 0) : own;
      return n.total;
    };
    top.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    top.forEach(sum);
    return top;
  }, [accounts]);

  const needle = q.trim().toLowerCase();
  const matches = (n: Node): boolean =>
    !needle || n.name.toLowerCase().includes(needle) || n.code.toLowerCase().includes(needle) || n.children.some(matches);
  const isOpen = (n: Node) => !!needle || open[n.id] !== false && (open[n.id] || Number(n.level) < 3);

  const groups3 = accounts.filter(a => Number(a.is_group) && Number(a.level) === 3)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(accounts.filter(a => Number(a.is_group)).map(a => [a.id, v])));

  const totals = useMemo(() => Object.fromEntries(roots.map(r => [r.type, r.total])), [roots]);

  // Ledgers under Cash & Bank (111) can be tagged as bank accounts for reconciliation.
  const isCashBankGroup = groups3.find(g => String(g.id) === form.parent_id)?.code === "111";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAccount({ ...form, is_bank: isCashBankGroup && form.is_bank, parent_id: Number(form.parent_id), opening_balance: form.opening_balance || 0 });
      toast({ title: "Account added", description: `${form.code} ${form.name}` });
      setDialog(false);
      setForm(f => ({ ...f, code: "", name: "", opening_balance: "", is_bank: false }));
      void load();
    } catch (err: any) {
      toast({ title: "Couldn't add account", description: err?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const Row = ({ n, depth }: { n: Node; depth: number }) => {
    if (!matches(n)) return null;
    const group = Number(n.is_group) === 1;
    const expanded = group && isOpen(n);
    return (
      <>
        <tr className={`border-b ${group ? (depth === 0 ? "bg-muted/50 font-semibold" : "bg-muted/20 font-medium") : "hover:bg-muted/20"}`}>
          <td className="py-2 pr-3" style={{ paddingLeft: 12 + depth * 20 }}>
            <div className="flex items-center gap-1.5 min-w-0">
              {group ? (
                <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${n.name}`}
                  onClick={() => setOpen(o => ({ ...o, [n.id]: !expanded }))} className="rounded p-0.5 hover:bg-muted">
                  <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                </button>
              ) : <span className="w-5 shrink-0" />}
              <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{n.code}</span>
              {group ? <span className="truncate">{n.name}</span> : (
                <Link href={`/accounting/accounts/${n.id}/ledger`} className="truncate text-primary hover:underline">{n.name}</Link>
              )}
            </div>
          </td>
          <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{LEVEL_LABEL[Number(n.level)] || ""}</td>
          <td className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${n.total < 0 ? "text-destructive" : ""}`}>{money(n.total)}</td>
        </tr>
        {expanded && n.children.map(c => <Row key={c.id} n={c} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <DashboardLayout title="Chart of Accounts">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">Class → Group → Sub-group → Ledger. Transactions post to ledgers only; group totals add up from them.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add ledger</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[["ASSET", "Assets"], ["LIABILITY", "Liabilities"], ["EQUITY", "Equity"], ["INCOME", "Income"], ["EXPENSE", "Expenses"]].map(([t, l]) => (
            <Card key={t} className="p-3">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold tabular-nums">{money(Number(totals[t] || 0))}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9 h-9" placeholder="Search by code or name…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search accounts" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAll(true)}><ChevronsUpDown className="h-4 w-4 mr-1" aria-hidden="true" /> Expand all</Button>
            <Button size="sm" variant="ghost" onClick={() => setAll(false)}><ChevronsDownUp className="h-4 w-4 mr-1" aria-hidden="true" /> Collapse</Button>
          </div>
          {loading && !accounts.length ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3 font-medium">Account</th>
                    <th className="py-2 px-3 font-medium hidden sm:table-cell w-28">Level</th>
                    <th className="py-2 px-3 font-medium text-right w-40">Balance (LKR)</th>
                  </tr>
                </thead>
                <tbody>{roots.map(r => <Row key={r.id} n={r} depth={0} />)}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add ledger account</DialogTitle>
              <DialogDescription>Ledgers sit under a sub-group. The type (asset, income…) comes from the sub-group.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="parent">Sub-group</Label>
              <select id="parent" required value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose…</option>
                {groups3.map(g => <option key={g.id} value={g.id}>{g.code} · {g.name} ({g.type.toLowerCase()})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.trim() })} placeholder="e.g. 1011" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. BOC Current Account" />
              </div>
            </div>
            {isCashBankGroup && (
              <label htmlFor="is-bank" className="flex items-start gap-3 rounded-md border p-3 text-sm cursor-pointer">
                <input id="is-bank" type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={form.is_bank} onChange={e => setForm({ ...form, is_bank: e.target.checked })} />
                <span>
                  <span className="font-medium">This is a bank account</span>
                  <span className="block text-muted-foreground">Shows in Bank Reconciliation and as a deposit account for card settlements. Leave off for cash, petty cash or clearing ledgers.</span>
                </span>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob">Opening balance (optional)</Label>
                <Input id="ob" type="number" step="0.01" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asof">As of</Label>
                <Input id="asof" type="date" value={form.as_of_date} onChange={e => setForm({ ...form, as_of_date: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">An opening balance is posted against Opening Balance Equity.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

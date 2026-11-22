"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchCardClearing, postCardSettlement, type CardClearing } from "@/lib/api/financials";

const money = (v: any) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Card sales sit in Card Clearing until the bank pays them out (less commission).
 * Recording the settlement moves the money to the bank and books the commission.
 */
export default function CardSettlementsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CardClearing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: today(), gross: "", commission: "", bank_account_id: "", reference: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchCardClearing()); }
    catch (e: any) { toast({ title: "Couldn't load", description: e?.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const gross = Number(form.gross || 0);
  const fee = Number(form.commission || 0);
  const net = gross - fee;
  const pct = gross > 0 ? (fee / gross) * 100 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await postCardSettlement({ date: form.date, gross, commission: fee, bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined, reference: form.reference || undefined });
      toast({ title: "Settlement posted", description: `LKR ${money(net)} to the bank, LKR ${money(fee)} commission.` });
      setForm(f => ({ ...f, gross: "", commission: "", reference: "" }));
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't post", description: err?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Card Settlements</h1>
            <p className="text-sm text-muted-foreground mt-1">Card sales wait in Card Clearing until the bank pays them. Record each payout here.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="space-y-5 min-w-0">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Waiting for the bank (Card Clearing)</p>
              <p className="text-3xl font-bold tabular-nums">LKR {money(data?.balance)}</p>
            </Card>

            <Card className="overflow-hidden">
              <h2 className="border-b px-4 py-3 font-semibold">Card takings by day</h2>
              {!data?.by_day.length ? <p className="p-6 text-sm text-muted-foreground">No card payments recorded yet.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>
                    <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium text-right">Card sales</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {data.by_day.map(d => <tr key={d.day}><td className="px-4 py-2">{d.day}</td><td className="px-4 py-2 text-right tabular-nums">{money(d.taken)}</td></tr>)}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="overflow-hidden">
              <h2 className="border-b px-4 py-3 font-semibold">Recent settlements</h2>
              {!data?.settlements.length ? <p className="p-6 text-sm text-muted-foreground">None yet.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>
                    <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Reference</th><th className="px-4 py-2 font-medium text-right">Settled</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {data.settlements.map(s => <tr key={s.id}><td className="px-4 py-2">{s.entry_date}</td><td className="px-4 py-2">{s.description}</td><td className="px-4 py-2 text-right tabular-nums">{money(s.gross)}</td></tr>)}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card className="p-4 h-fit">
            <form onSubmit={submit} className="space-y-3">
              <h2 className="font-semibold">Record a settlement</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="d">Date paid</Label>
                  <Input id="d" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ref">Bank reference</Label>
                  <Input id="ref" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="g">Card sales settled</Label>
                  <Input id="g" type="number" step="0.01" min="0" required value={form.gross} onChange={e => setForm({ ...form, gross: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c">Commission</Label>
                  <Input id="c" type="number" step="0.01" min="0" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b">Paid into</Label>
                <select id="b" value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Default bank account</option>
                  {data?.banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
                </select>
              </div>
              {gross > 0 && (
                <dl className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><dt>To bank</dt><dd className="tabular-nums font-medium">{money(net)}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Commission ({pct.toFixed(2)}%)</dt><dd className="tabular-nums">{money(fee)}</dd></div>
                </dl>
              )}
              <Button type="submit" className="w-full" disabled={saving || gross <= 0 || fee >= gross}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Post settlement
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

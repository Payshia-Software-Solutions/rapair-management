"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, MonitorSmartphone, Pencil, Plus, Trash2, RefreshCw, Wallet, Receipt, TrendingUp, Printer } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard, StatCard, EmptyState, LoadingState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { posShiftApi, type PosTerminal } from "@/lib/api/pos-shifts";
import { fetchLocations } from "@/lib/api";

/**
 * POS terminals (cash drawers). Every terminal belongs to one location; a POS PC at that location
 * picks one of them once, and shifts and cash are counted per terminal. Managed only here.
 */
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const money = (v: any) => Number(v || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function totals(list: PosTerminal[]) {
  const r = { open: 0, float: 0, expected: 0, shiftSales: 0, shiftInvoices: 0, todayTotal: 0, todayCount: 0 };
  for (const t of list) {
    const sum = t.shift?.summary;
    if (sum) {
      r.open++; r.float += Number(sum.opening_float || 0); r.expected += Number(sum.expected_cash || 0);
      r.shiftSales += Number(sum.sales_total || 0); r.shiftInvoices += Number(sum.invoice_count || 0);
    }
    r.todayTotal += Number(t.today?.total || 0); r.todayCount += Number(t.today?.count || 0);
  }
  return r;
}

function groups(list: PosTerminal[]): [string, PosTerminal[]][] {
  const m = new Map<string, PosTerminal[]>();
  for (const t of list) {
    const k = t.location_name || `Location ${t.location_id}`;
    m.set(k, [...(m.get(k) || []), t]);
  }
  return [...m.entries()];
}

function Line({ label, value, strong, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function TerminalCard({ t, onEdit, onRemove }: { t: PosTerminal; onEdit: () => void; onRemove: () => void }) {
  const sum = t.shift?.summary;
  return (
    <div className="flex flex-col rounded-xl border bg-muted/20 p-5 text-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold"><MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" /> <span className="truncate">{t.name}</span></div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t.shift ? `${t.shift.shift_no} · ${t.shift.opened_by || ""} · since ${String(t.shift.opened_at).slice(11, 16)}` : "No open shift"}
          </div>
        </div>
        {t.shift
          ? <Badge variant="outline" className="shrink-0 border-none bg-emerald-500/10 text-emerald-700">Open</Badge>
          : <Badge variant="outline" className="shrink-0 border-none bg-muted text-muted-foreground">Closed</Badge>}
      </div>

      {sum ? (
        <div className="space-y-1">
          <Line label="Opening float" value={money(sum.opening_float)} />
          <Line label="Cash sales" value={money(sum.cash_sales)} />
          {Number(sum.voucher_cash) !== 0 && <Line label="Vouchers sold (cash)" value={money(sum.voucher_cash)} />}
          {Number(sum.pay_in) !== 0 && <Line label="Pay ins" value={money(sum.pay_in)} />}
          {Number(sum.pay_out) !== 0 && <Line label="Pay outs" value={money(-sum.pay_out)} />}
          {Number(sum.cash_refunds) !== 0 && <Line label="Cash refunds" value={money(-sum.cash_refunds)} />}
          <div className="my-1.5 border-t" />
          <Line label="Cash in drawer" value={money(sum.expected_cash)} strong />
          <div className="my-1.5 border-t" />
          {Object.entries(sum.methods || {}).map(([m, v]) => <Line key={m} label={`${m} (${v.count})`} value={money(v.total)} muted />)}
          <Line label={`Shift sales (${sum.invoice_count})`} value={money(sum.sales_total)} strong />
        </div>
      ) : (
        <p className="py-3 text-muted-foreground">The drawer is not in use.</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">Today: <span className="font-medium text-foreground tabular-nums">{money(t.today?.total)}</span> · {t.today?.count || 0} inv.</div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onEdit} aria-label={`Edit ${t.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-rose-600 hover:text-rose-700" disabled={!!t.shift}
            title={t.shift ? "Close the open shift first" : undefined} onClick={onRemove} aria-label={`Remove ${t.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function PosTerminalsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PosTerminal[] | null>(null);
  const [edit, setEdit] = useState<{ id?: number; name: string; location_id: string } | null>(null);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [filter, setFilter] = useState("all");
  const [remove, setRemove] = useState<PosTerminal | null>(null);
  const [busy, setBusy] = useState(false);

  const [updated, setUpdated] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await posShiftApi.terminals(filter));
      setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    catch (e: any) { setRows([]); toast({ title: "Could not load terminals", description: e.message, variant: "destructive" }); }
  }, [toast, filter]);

  useEffect(() => { setRows(null); void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    fetchLocations()
      .then((l: any) => setLocations(Array.isArray(l) ? l.map((x: any) => ({ id: Number(x.id), name: String(x.name) })) : []))
      .catch(() => setLocations([]));
  }, []);

  // New terminal: preset to the filtered location, else the location selected in the header.
  const startAdd = () => {
    const current = typeof window !== "undefined" ? window.localStorage.getItem("location_id") || "" : "";
    const preset = filter !== "all" ? filter : (locations.some((l) => String(l.id) === current) ? current : String(locations[0]?.id ?? ""));
    setEdit({ name: "", location_id: preset });
  };

  const save = async () => {
    if (!edit?.name.trim() || !edit.location_id) return;
    setBusy(true);
    try {
      await posShiftApi.saveTerminal(edit.name.trim(), Number(edit.location_id), edit.id);
      toast({ title: edit.id ? "Terminal saved" : "Terminal added" });
      setEdit(null);
      void load();
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await posShiftApi.deleteTerminal(remove.id);
      toast({ title: `${remove.name} removed` });
      setRemove(null);
      void load();
    } catch (e: any) {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <DashboardLayout title="POS Terminals">
      <div className="space-y-6">
        <PageHeader
          title="POS terminals"
          description="Each terminal is one POS PC with its own cash drawer at a location. A POS only offers the terminals of its own location; shifts and expected cash are counted per terminal."
          actions={<Button onClick={startAdd} disabled={!locations.length}><Plus className="mr-1.5 h-4 w-4" /> Add terminal</Button>}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Live figures, refreshed every 30 seconds{updated ? ` · last ${updated}` : ""}.</p>
          <div className="flex items-center gap-2">
            <select aria-label="Location" className={`${selectClass} h-9 w-48`} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All locations</option>
              {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => void load()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={!rows?.length}
              onClick={() => window.open(`/cms/pos/terminals/print?location_id=${encodeURIComponent(filter)}`, "_blank")}>
              <Printer className="mr-1.5 h-4 w-4" /> Print report
            </Button>
          </div>
        </div>

        {rows === null ? (
          <LoadingState label="Loading terminals…" />
        ) : rows.length === 0 ? (
          <SectionCard title="Terminals">
            <EmptyState title="No terminals" description="Add one terminal for each POS PC / cash drawer at each location."
              action={<Button size="sm" onClick={startAdd} disabled={!locations.length}><Plus className="mr-1.5 h-4 w-4" /> Add terminal</Button>} />
          </SectionCard>
        ) : (
          <>
            {/* Overall */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open drawers" value={`${totals(rows).open} / ${rows.length}`} hint="Terminals with an open shift" icon={<MonitorSmartphone className="h-4 w-4" />} />
              <StatCard label="Cash in drawers (LKR)" value={money(totals(rows).expected)} hint={`Float ${money(totals(rows).float)}`} icon={<Wallet className="h-4 w-4" />} />
              <StatCard label="Open shift sales (LKR)" value={money(totals(rows).shiftSales)} hint={`${totals(rows).shiftInvoices} invoices`} icon={<Receipt className="h-4 w-4" />} />
              <StatCard label="Today's sales (LKR)" value={money(totals(rows).todayTotal)} hint={`${totals(rows).todayCount} invoices on terminals`} icon={<TrendingUp className="h-4 w-4" />} />
            </div>

            {/* Per location */}
            {groups(rows).map(([loc, list]) => {
              const t = totals(list);
              return (
                <SectionCard key={loc} title={loc}
                  description={`${t.open} of ${list.length} open · cash in drawers ${money(t.expected)} · today ${money(t.todayTotal)} (${t.todayCount} invoices)`}>
                  <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((term) => <TerminalCard key={term.id} t={term}
                      onEdit={() => setEdit({ id: term.id, name: term.name, location_id: String(term.location_id) })}
                      onRemove={() => setRemove(term)} />)}
                  </div>
                </SectionCard>
              );
            })}
          </>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-sm">
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{edit?.id ? "Edit terminal" : "Add terminal"}</DialogTitle>
              <DialogDescription>Use a name cashiers will recognise, e.g. "Counter 1" or "Bar till".</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="term-name">Name</Label>
              <Input id="term-name" autoFocus maxLength={80} value={edit?.name || ""} onChange={(e) => setEdit((x) => x && { ...x, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-loc">Location</Label>
              <select id="term-loc" className={selectClass} value={edit?.location_id || ""} onChange={(e) => setEdit((x) => x && { ...x, location_id: e.target.value })}>
                <option value="" disabled>Choose a location</option>
                {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
              {edit?.id ? <p className="text-xs text-muted-foreground">Moving a terminal needs its shift closed. PCs set to it will ask again.</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="submit" disabled={busy || !edit?.name.trim() || !edit?.location_id}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!remove} onOpenChange={(o) => { if (!o) setRemove(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {remove?.name}?</DialogTitle>
            <DialogDescription>Past shifts keep their terminal name. A PC set to this terminal will ask to pick another one.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void doRemove()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

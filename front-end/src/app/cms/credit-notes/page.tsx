"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Plus, Printer, Search, Trash2, Undo2, FileMinus, ArrowRightLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard, StatCard, EmptyState, theadClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { fetchCustomers } from "@/lib/api/master-data";
import { creditNoteApi, CREDIT_NOTE_REASONS, type CreditNote, type OpenInvoice } from "@/lib/api/credit-notes";

const money = (v: any) => Number(v || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUSES = ["", "Open", "Used", "Cancelled"] as const;
const statusClass: Record<string, string> = {
  Open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Used: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  Cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function CreditNotesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<CreditNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await creditNoteApi.list(q, status)); }
    catch (e: any) { toast({ title: "Could not load credit notes", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [q, status, toast]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const stats = useMemo(() => {
    const live = rows.filter(r => r.status !== "Cancelled");
    return {
      issued: live.reduce((s, r) => s + Number(r.total), 0),
      open: rows.filter(r => r.status === "Open").reduce((s, r) => s + Number(r.remaining), 0),
      openCount: rows.filter(r => r.status === "Open").length,
    };
  }, [rows]);

  const openDetail = async (id: number) => {
    try { setDetail(await creditNoteApi.details(id)); }
    catch (e: any) { toast({ title: "Could not open credit note", description: e.message, variant: "destructive" }); }
  };

  return (
    <DashboardLayout title="Credit Notes">
      <div className="space-y-6">
        <PageHeader
          title="Credit Notes"
          description="Lower what a customer owes without goods coming back: price corrections, discounts after the sale, billing errors, goodwill. For goods coming back, use Sales Returns."
          actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> New credit note</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Credit issued (listed)" value={`LKR ${money(stats.issued)}`} icon={<FileMinus className="h-4 w-4" />} />
          <StatCard label="Unused credit" value={`LKR ${money(stats.open)}`} hint="Customers can still use this" icon={<ArrowRightLeft className="h-4 w-4" />} />
          <StatCard label="Open notes" value={stats.openCount} icon={<FileMinus className="h-4 w-4" />} />
        </div>

        <SectionCard
          title="Credit notes"
          action={
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Number, customer or invoice" aria-label="Search credit notes" className="pl-8 h-9 w-60" />
              </div>
              <div className="flex gap-0.5 p-0.5 rounded-md bg-muted" role="tablist" aria-label="Filter by status">
                {STATUSES.map(s => (
                  <button key={s || "all"} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                    className={`h-8 px-2.5 rounded-sm text-xs ${status === s ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="No credit notes" description="Issue one when a customer was overcharged or is owed a discount." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Number</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Invoice</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                    <th className="px-4 py-2 font-medium text-right">Unused</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(r.id)}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{r.cn_no}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.cn_date}</td>
                      <td className="px-4 py-2.5">{r.customer_name || "–"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.invoice_no || <span className="text-muted-foreground">–</span>}</td>
                      <td className="px-4 py-2.5">{r.reason}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.status === "Cancelled" ? "–" : money(r.remaining)}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className={`border-none ${statusClass[r.status] || ""}`}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <CreateCreditNoteDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => { setCreateOpen(false); void load(); void openDetail(id); }} />
      <CreditNoteDetailDialog note={detail} onClose={() => setDetail(null)} onChanged={(n) => { setDetail(n); void load(); }} />
    </DashboardLayout>
  );
}

/* ---------------------------------------------------------------- create */

function CreateCreditNoteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState<string>(CREDIT_NOTE_REASONS[0]);
  const [lines, setLines] = useState([{ description: "", amount: "" }]);
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [apply, setApply] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId(""); setInvoiceId(""); setReason(CREDIT_NOTE_REASONS[0]); setLines([{ description: "", amount: "" }]); setTax(""); setNotes(""); setApply(true);
    fetchCustomers().then((r: any) => setCustomers(Array.isArray(r) ? r : [])).catch(() => setCustomers([]));
  }, [open]);

  useEffect(() => {
    setInvoiceId(""); setInvoices([]);
    if (customerId) creditNoteApi.openInvoices(customerId, true).then(setInvoices).catch(() => setInvoices([]));
  }, [customerId]);

  const inv = invoices.find(i => String(i.id) === invoiceId);
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const total = subtotal + (Number(tax) || 0);
  const due = inv ? Number(inv.due) : 0;

  const save = async () => {
    setSaving(true);
    try {
      const r = await creditNoteApi.create({
        customer_id: customerId,
        invoice_id: invoiceId || null,
        reason,
        notes,
        tax_amount: Number(tax) || 0,
        items: lines.filter(l => l.description.trim() || Number(l.amount)).map(l => ({ description: l.description.trim(), amount: Number(l.amount) || 0 })),
        apply_to_invoice: !!invoiceId && apply && due > 0,
      });
      toast({ title: `Credit note ${r.cn_no} issued` });
      onCreated(r.id);
    } catch (e: any) {
      toast({ title: "Could not issue credit note", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New credit note</DialogTitle>
          <DialogDescription>Credits the customer's account and posts to the ledger.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Customer</Label>
            <SearchableSelect
              value={customerId}
              onValueChange={setCustomerId}
              options={customers.map((c: any) => ({ value: String(c.id), label: c.phone ? `${c.name} · ${c.phone}` : c.name }))}
              placeholder="Choose a customer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-invoice">Invoice (optional)</Label>
            <select id="cn-invoice" className={selectClass} value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!customerId}>
              <option value="">Not linked to an invoice</option>
              {invoices.map(i => (
                <option key={i.id} value={String(i.id)}>
                  {i.invoice_no} · {money(i.grand_total)}{Number(i.due) > 0 ? ` · due ${money(i.due)}` : " · paid"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-reason">Reason</Label>
            <select id="cn-reason" className={selectClass} value={reason} onChange={e => setReason(e.target.value)}>
              {CREDIT_NOTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Lines (amount before tax)</Label>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input value={l.description} placeholder="What is credited" aria-label={`Line ${i + 1} description`}
                onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <Input value={l.amount} placeholder="0.00" inputMode="decimal" className="w-32 text-right" aria-label={`Line ${i + 1} amount`}
                onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <Button variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1}
                onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, { description: "", amount: "" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add line</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cn-tax">Tax to reverse</Label>
            <Input id="cn-tax" value={tax} inputMode="decimal" placeholder="0.00" onChange={e => setTax(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-notes">Notes</Label>
            <Input id="cn-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shown on the credit note" />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(tax)}</span></div>
          <div className="flex justify-between font-semibold"><span>Credit total</span><span className="tabular-nums">LKR {money(total)}</span></div>
        </div>

        {inv && due > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={apply} onCheckedChange={(v) => setApply(!!v)} className="mt-0.5" />
            <span>Use the credit on {inv.invoice_no} now (up to its balance of {money(due)}). Anything left stays as open credit.</span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !customerId || total <= 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Issue credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- detail */

function CreditNoteDetailDialog({ note, onClose, onChanged }: { note: CreditNote | null; onClose: () => void; onChanged: (n: CreditNote) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"" | "apply" | "refund" | "cancel">("");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode(""); setAmount(""); setReason(""); setRef(""); setInvoiceId(""); }, [note?.id]);
  useEffect(() => {
    if (mode === "apply" && note) creditNoteApi.openInvoices(note.customer_id).then(setInvoices).catch(() => setInvoices([]));
  }, [mode, note]);

  if (!note) return null;
  const left = Number(note.remaining);
  const canUse = note.status === "Open" && left > 0;
  const canCancel = note.status !== "Cancelled" && Number(note.applied_amount) === 0 && Number(note.refunded_amount) === 0;

  const run = async (fn: () => Promise<CreditNote>, msg: string) => {
    setBusy(true);
    try { const n = await fn(); toast({ title: msg }); setMode(""); setAmount(""); onChanged(n); }
    catch (e: any) { toast({ title: "Not saved", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!note} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{note.cn_no}</span>
            <Badge variant="outline" className={`border-none ${statusClass[note.status] || ""}`}>{note.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {note.customer_name} · {note.cn_date} · {note.reason}{note.invoice_no ? ` · for ${note.invoice_no}` : ""}
          </DialogDescription>
        </DialogHeader>

        <table className="w-full text-sm">
          <tbody>
            {(note.items || []).map((it, i) => (
              <tr key={i} className="border-b"><td className="py-1.5">{it.description}</td><td className="py-1.5 text-right tabular-nums">{money(it.amount)}</td></tr>
            ))}
            <tr><td className="py-1.5 text-muted-foreground">Tax</td><td className="py-1.5 text-right tabular-nums">{money(note.tax_amount)}</td></tr>
            <tr className="font-semibold"><td className="py-1.5">Total</td><td className="py-1.5 text-right tabular-nums">LKR {money(note.total)}</td></tr>
          </tbody>
        </table>
        {note.notes && <p className="text-sm text-muted-foreground">{note.notes}</p>}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border p-2"><div className="text-muted-foreground">Applied</div><div className="font-semibold tabular-nums">{money(note.applied_amount)}</div></div>
          <div className="rounded-md border p-2"><div className="text-muted-foreground">Refunded</div><div className="font-semibold tabular-nums">{money(note.refunded_amount)}</div></div>
          <div className="rounded-md border p-2"><div className="text-muted-foreground">Unused</div><div className="font-semibold tabular-nums">{note.status === "Cancelled" ? "–" : money(left)}</div></div>
        </div>

        {(note.allocations || []).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">History</div>
            {note.allocations!.map(a => (
              <div key={a.id} className="flex justify-between text-sm border-b py-1">
                <span>{a.alloc_date} · {a.type === "Apply" ? `Applied to ${a.invoice_no}` : `Refunded by ${a.payment_method}${a.reference_no ? ` (${a.reference_no})` : ""}`}</span>
                <span className="tabular-nums">{money(a.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {note.status === "Cancelled" && note.cancel_reason && <p className="text-sm text-rose-600">Cancelled: {note.cancel_reason}</p>}

        {mode === "apply" && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="cn-apply-inv">Unpaid invoice</Label>
            <select id="cn-apply-inv" className={selectClass} value={invoiceId}
              onChange={e => { setInvoiceId(e.target.value); const i = invoices.find(x => String(x.id) === e.target.value); if (i) setAmount(String(Math.min(left, Number(i.due)).toFixed(2))); }}>
              <option value="">Choose an invoice</option>
              {invoices.map(i => <option key={i.id} value={String(i.id)}>{i.invoice_no} · due {money(i.due)}</option>)}
            </select>
            {invoices.length === 0 && <p className="text-xs text-muted-foreground">This customer has no unpaid invoices.</p>}
            <Label htmlFor="cn-apply-amt">Amount</Label>
            <Input id="cn-apply-amt" value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("")}>Back</Button>
              <Button disabled={busy || !invoiceId || !(Number(amount) > 0)} onClick={() => run(() => creditNoteApi.apply(note.id, invoiceId, Number(amount)), "Credit applied")}>Apply</Button>
            </div>
          </div>
        )}

        {mode === "refund" && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="cn-ref-amt">Amount to pay back</Label>
            <Input id="cn-ref-amt" value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <Label htmlFor="cn-ref-method">Paid by</Label>
            <select id="cn-ref-method" className={selectClass} value={method} onChange={e => setMethod(e.target.value)}>
              {["Cash", "Card", "Bank Transfer", "Cheque"].map(m => <option key={m}>{m}</option>)}
            </select>
            <Label htmlFor="cn-ref-ref">Reference (optional)</Label>
            <Input id="cn-ref-ref" value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque or transfer number" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("")}>Back</Button>
              <Button disabled={busy || !(Number(amount) > 0)} onClick={() => run(() => creditNoteApi.refund(note.id, Number(amount), method, ref), "Refund recorded")}>Record refund</Button>
            </div>
          </div>
        )}

        {mode === "cancel" && (
          <div className="space-y-2 rounded-lg border border-rose-500/30 p-3">
            <Label htmlFor="cn-cancel">Why cancel?</Label>
            <Input id="cn-cancel" value={reason} onChange={e => setReason(e.target.value)} placeholder="Issued by mistake" />
            <p className="text-xs text-muted-foreground">The ledger entry is reversed. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("")}>Back</Button>
              <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => run(() => creditNoteApi.cancel(note.id, reason), "Credit note cancelled")}>Cancel credit note</Button>
            </div>
          </div>
        )}

        {mode === "" && (
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => printCreditNote(note)}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            <div className="flex flex-wrap gap-2">
              {canCancel && <Button variant="ghost" className="text-rose-600" onClick={() => setMode("cancel")}><Ban className="mr-2 h-4 w-4" /> Cancel</Button>}
              {canUse && <Button variant="outline" onClick={() => { setAmount(left.toFixed(2)); setMode("refund"); }}><Undo2 className="mr-2 h-4 w-4" /> Refund</Button>}
              {canUse && <Button onClick={() => setMode("apply")}><ArrowRightLeft className="mr-2 h-4 w-4" /> Apply to invoice</Button>}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Opens the A4 print page (shared document layout). */
function printCreditNote(n: { id: number }) {
  window.open("/cms/credit-notes/print/" + n.id, "_blank");
}

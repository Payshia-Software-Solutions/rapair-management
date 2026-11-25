"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Plus, Printer, Search, Ticket, Wallet, TrendingDown, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard, StatCard, EmptyState, theadClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StandaloneDatePicker } from "@/components/ui/standalone-date-picker";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { giftVoucherApi, type GiftVoucher } from "@/lib/api/gift-vouchers";
import { printGiftVoucher } from "@/lib/gift-voucher-print";

const money = (v: number | string) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUSES = ["", "Active", "Expired", "Redeemed", "Void"] as const;

const statusClass: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Expired: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Redeemed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Void: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

function inOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export default function GiftVouchersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<GiftVoucher[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof giftVoucherApi.stats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [detail, setDetail] = useState<GiftVoucher | null>(null);
  const [voidTarget, setVoidTarget] = useState<GiftVoucher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([giftVoucherApi.list(q, status), giftVoucherApi.stats()]);
      setRows(list);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Could not load vouchers", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [q, status, toast]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (id: number) => {
    try { setDetail(await giftVoucherApi.details(id)); }
    catch (e: any) { toast({ title: "Could not open voucher", description: e.message, variant: "destructive" }); }
  };

  return (
    <DashboardLayout title="Gift Vouchers">
      <div className="space-y-6">
        <PageHeader
          title="Gift Vouchers"
          description="Stored-value vouchers. Sold at the POS or issued here, used as a payment at checkout, in full or in parts."
          actions={<Button onClick={() => setIssueOpen(true)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Issue voucher</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Outstanding" value={`LKR ${money(stats?.outstanding || 0)}`} hint="Owed to voucher holders" icon={<Wallet className="h-4 w-4" />} />
          <StatCard label="Active vouchers" value={stats?.active_count ?? "–"} icon={<Ticket className="h-4 w-4" />} />
          <StatCard label="Redeemed" value={`LKR ${money(stats?.redeemed_value || 0)}`} icon={<TrendingDown className="h-4 w-4" />} />
          <StatCard label="Expired, unused" value={`LKR ${money(stats?.expired_balance || 0)}`} hint="Void to clear from the liability" icon={<Clock className="h-4 w-4" />} />
        </div>

        <SectionCard
          title="Vouchers"
          action={
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Code, name or phone" aria-label="Search vouchers" className="pl-8 h-9 w-56" />
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
            <EmptyState title="No vouchers" description="Issue one here, or sell one from the POS (ticket button in the cart)." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">For</th>
                    <th className="px-4 py-2 font-medium text-right">Value</th>
                    <th className="px-4 py-2 font-medium text-right">Balance</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(v => {
                    const st = v.display_status || v.status;
                    return (
                      <tr key={v.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(v.id)}>
                        <td className="px-4 py-2.5 font-mono font-semibold">{v.code}</td>
                        <td className="px-4 py-2.5">{v.recipient_name || v.customer_name || <span className="text-muted-foreground">–</span>}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(v.initial_value)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{money(v.balance)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{v.expires_at || "No expiry"}</td>
                        <td className="px-4 py-2.5">{v.source === "Sold" ? `Sold · ${v.payment_method}` : "Issued free"}</td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className={`border-none ${statusClass[st] || ""}`}>{st}</Badge></td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Print" aria-label={`Print ${v.code}`} onClick={() => printGiftVoucher(v)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {v.status !== "Void" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" title="Void" aria-label={`Void ${v.code}`} onClick={() => setVoidTarget(v)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} onDone={load} />
      <VoidDialog voucher={voidTarget} onClose={() => setVoidTarget(null)} onDone={load} />

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{detail.code}</DialogTitle>
                <DialogDescription>
                  {detail.display_status} · balance LKR {money(detail.balance)} of {money(detail.initial_value)}
                  {detail.expires_at ? ` · valid until ${detail.expires_at}` : ""}
                </DialogDescription>
              </DialogHeader>
              {(detail.recipient_name || detail.message || detail.void_reason) && (
                <div className="text-sm space-y-1">
                  {detail.recipient_name && <p>For {detail.recipient_name}{detail.recipient_phone ? ` · ${detail.recipient_phone}` : ""}</p>}
                  {detail.message && <p className="italic text-muted-foreground">“{detail.message}”</p>}
                  {detail.void_reason && <p className="text-rose-600">Voided: {detail.void_reason}</p>}
                </div>
              )}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className={theadClass}>
                    <tr><th className="px-3 py-1.5 font-medium">When</th><th className="px-3 py-1.5 font-medium">What</th><th className="px-3 py-1.5 font-medium text-right">Amount</th><th className="px-3 py-1.5 font-medium text-right">Balance</th></tr>
                  </thead>
                  <tbody>
                    {(detail.transactions || []).map((t: any) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-1.5 tabular-nums text-xs">{String(t.created_at).slice(0, 16)}</td>
                        <td className="px-3 py-1.5 text-xs">{t.type}{t.invoice_no ? ` · ${t.invoice_no}` : ""}{t.notes ? ` · ${t.notes}` : ""}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${Number(t.amount) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(t.amount)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(t.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function IssueDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState(inOneYear());
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setValue(""); setExpires(inOneYear()); setRecipient(""); setPhone(""); setMessage(""); setCode(""); setNotes(""); }
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const v = await giftVoucherApi.issue({
        value: Number(value), expires_at: expires || undefined, recipient_name: recipient,
        recipient_phone: phone, message, code: code || undefined, notes,
      });
      toast({ title: "Voucher issued", description: `${v.code} · LKR ${money(v.initial_value)}` });
      onOpenChange(false);
      onDone();
      printGiftVoucher(v);
    } catch (e: any) {
      toast({ title: "Could not issue the voucher", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue a free voucher</DialogTitle>
          <DialogDescription>For giveaways, complaints or staff rewards. Its value is booked to Complimentary &amp; Hospitality. To sell a voucher, use the POS.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="iv-value">Value (LKR)</Label>
            <Input id="iv-value" type="number" min={0} value={value} onChange={e => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-exp">Valid until</Label>
            <StandaloneDatePicker value={expires} onChange={d => setExpires(format(d, "yyyy-MM-dd"))} placeholder="No expiry" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-to">For</Label>
            <Input id="iv-to" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-phone">Phone</Label>
            <Input id="iv-phone" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="iv-msg">Message on the voucher</Label>
            <Input id="iv-msg" value={message} onChange={e => setMessage(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-code">Code</Label>
            <Input id="iv-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Automatic" className="font-mono uppercase" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-notes">Internal note</Label>
            <Input id="iv-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !(Number(value) > 0)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Issue &amp; print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ voucher, onClose, onDone }: { voucher: GiftVoucher | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setReason(""); }, [voucher]);
  if (!voucher) return null;
  const left = Number(voucher.balance);

  const go = async () => {
    setSaving(true);
    try {
      await giftVoucherApi.void(voucher.id, reason);
      toast({ title: "Voucher voided", description: voucher.code });
      onClose();
      onDone();
    } catch (e: any) {
      toast({ title: "Could not void", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Void {voucher.code}?</DialogTitle>
          <DialogDescription>
            The voucher stops working. This can&apos;t be undone.
            {left > 0 && (voucher.source === "Sold"
              ? ` The LKR ${money(left)} left is booked as refunded by ${voucher.payment_method || "cash"}: pay that back to the customer.`
              : ` The LKR ${money(left)} left is reversed from the complimentary expense.`)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="vd-reason">Reason</Label>
          <Input id="vd-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Lost, refunded, issued by mistake…" />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Keep voucher</Button>
          <Button variant="destructive" onClick={go} disabled={saving || !reason.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Void voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

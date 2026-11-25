"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet, ArrowDownToLine, ArrowUpFromLine, Printer, LogOut, Monitor } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { posShiftApi, type PosShift, type PosTerminal, type ShiftSummary } from "@/lib/api/pos-shifts";
import { getTerminalId, setTerminalId } from "@/lib/pos-terminal";
import { usePOS } from "../context/POSContext";
import { silentPrint, isPrinterServiceAvailable } from "@/lib/api/silent-print";

const money = (v: any) => Number(v || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DENOMS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

/** Status bar and other places open the shift panel with this event. */
export const openShiftPanel = () => window.dispatchEvent(new CustomEvent("pos-shift-panel"));
/** The gate tells the status bar which shift is open. */
export const SHIFT_EVENT = "pos-shift-changed";

/**
 * Cashier shift control for the POS.
 * - A cashier (canCheckout) must open a shift with the drawer's starting cash before selling.
 * - The shift panel records pay ins / pay outs and closes the shift by counting the drawer.
 * - After closing, the shift report can be printed and a new shift is asked for.
 * Stewards (order-taking only) never see any of this.
 */
export function PosShiftGate() {
  const { canCheckout, permsReady, selectedLocation } = usePOS();
  const { toast } = useToast();
  const [shift, setShift] = useState<PosShift | null | undefined>(undefined); // undefined = loading
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false);
  const [closed, setClosed] = useState<PosShift | null>(null);
  // This PC's terminal (cash drawer) at the selected location; "" = not chosen yet.
  const [terminalId, setTerminal] = useState<string>("");
  const [terminals, setTerminals] = useState<PosTerminal[] | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await posShiftApi.current();
      setShift(s);
      window.dispatchEvent(new CustomEvent(SHIFT_EVENT, { detail: s }));
    } catch {
      setShift(null);
    }
  }, []);

  const loadTerminals = useCallback(async () => {
    try { setTerminals(await posShiftApi.terminals()); } catch { setTerminals([]); }
  }, []);

  useEffect(() => {
    if (!permsReady || !canCheckout || !selectedLocation) return;
    const saved = getTerminalId(selectedLocation) || "";
    setTerminal(saved);
    setShift(undefined);
    if (saved) void load();
    void loadTerminals();
  }, [permsReady, canCheckout, selectedLocation, load, loadTerminals]);

  // A saved terminal that was removed (or is not at this location) is forgotten: pick again.
  useEffect(() => {
    if (terminalId && terminals && !terminals.some((t) => String(t.id) === terminalId)) {
      setTerminalId(null, selectedLocation); setTerminal("");
    }
  }, [terminals, terminalId, selectedLocation]);

  const chooseTerminal = (t: PosTerminal) => {
    setTerminalId(t.id, selectedLocation);
    setTerminal(String(t.id));
    setShift(undefined);
    void load();
  };

  const changeTerminal = () => {
    setTerminalId(null, selectedLocation);
    setTerminal("");
    setShift(null);
    void loadTerminals();
  };

  useEffect(() => {
    const open = () => { void load(); setPanel(true); };
    window.addEventListener("pos-shift-panel", open);
    return () => window.removeEventListener("pos-shift-panel", open);
  }, [load]);

  if (!permsReady || !canCheckout) return null;

  const openShift = async () => {
    setBusy(true);
    try {
      const s = await posShiftApi.open(Number(float) || 0);
      setShift(s); setFloat("");
      window.dispatchEvent(new CustomEvent(SHIFT_EVENT, { detail: s }));
      toast({ title: `Shift ${s.shift_no} opened` });
    } catch (e: any) {
      toast({ title: "Could not open the shift", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Terminal screen: this PC picks which cash drawer it is (once per location) */}
      {!terminalId && !closed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
          </div>
          <div className="relative w-full max-w-3xl space-y-8 rounded-3xl border bg-card/80 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Monitor className="h-7 w-7" /></div>
              <h2 className="text-2xl font-bold">Which terminal is this?</h2>
              <p className="text-sm text-muted-foreground">Each terminal has its own cash drawer and shift. This PC remembers the choice.</p>
            </div>
            {terminals === null ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-6">
                  {terminals.map((t) => <TerminalCard3D key={t.id} t={t} onPick={() => chooseTerminal(t)} />)}
                </div>
                {terminals.length === 0 && <p className="text-center text-sm text-muted-foreground">No terminals at this location yet. Ask a manager to add them in Sales → POS Terminals.</p>}
              </>
            )}
            <Link href="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">Back to the ERP</Link>
          </div>
        </div>
      )}

      {/* Open-shift screen: blocks selling until the drawer's starting cash is entered */}
      {terminalId && shift === null && !closed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
          <form className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 shadow-xl" onSubmit={(e) => { e.preventDefault(); void openShift(); }}>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Wallet className="h-7 w-7" /></div>
              <h2 className="text-xl font-bold">Open the shift</h2>
              <p className="text-sm text-muted-foreground">
                {terminals?.find((t) => String(t.id) === terminalId)?.name || "This terminal"}: count the cash in the drawer before the first sale.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-float">Opening cash (LKR)</Label>
              <Input id="shift-float" autoFocus inputMode="decimal" placeholder="0.00" value={float}
                onChange={(e) => setFloat(e.target.value.replace(/[^\d.]/g, ""))} className="h-12 text-center text-2xl tabular-nums" />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Open shift
            </Button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={changeTerminal} className="text-muted-foreground hover:text-foreground">Change terminal</button>
              <Link href="/" className="text-muted-foreground hover:text-foreground">Back to the ERP</Link>
            </div>
          </form>
        </div>
      )}

      {shift && (
        <ShiftPanel
          open={panel}
          onOpenChange={setPanel}
          shift={shift}
          onShift={(s) => { setShift(s); window.dispatchEvent(new CustomEvent(SHIFT_EVENT, { detail: s })); }}
          onClosed={(s) => { setPanel(false); setClosed(s); setShift(null); void printShift(s); window.dispatchEvent(new CustomEvent(SHIFT_EVENT, { detail: null })); }}
        />
      )}

      {/* Shift report after closing */}
      <Dialog open={!!closed} onOpenChange={(o) => { if (!o) setClosed(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shift {closed?.shift_no} closed</DialogTitle>
            <DialogDescription>The report was sent to the printer. Put it in the drawer bag.</DialogDescription>
          </DialogHeader>
          {closed && <ShiftReport shift={closed} summary={closed.summary!} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => closed && printShift(closed)}><Printer className="mr-2 h-4 w-4" /> Print again</Button>
            <Button onClick={() => setClosed(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A POS terminal drawn in CSS 3D (screen, stand, cash drawer). It tilts toward the pointer. */
function TerminalCard3D({ t, onPick }: { t: PosTerminal; onPick: () => void }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const open = !!t.open_shift_no;
  const glow = open ? "16,185,129" : "99,102,241";

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 18, y: px * 22 });
  };

  return (
    <button
      type="button"
      onClick={onPick}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTilt({ x: 0, y: 0 }); }}
      className="group relative w-44 rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ perspective: "900px" }}
      aria-label={`Terminal ${t.name}${open ? `, open shift ${t.open_shift_no}` : ""}`}
    >
      <div
        className="relative mx-auto h-48 w-36 transition-transform duration-200 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${4 + tilt.x}deg) rotateY(${-10 + tilt.y}deg) translateY(${hover ? -6 : 0}px)`,
        }}
      >
        {/* Screen */}
        <div
          className="absolute left-1 top-0 h-[92px] w-[136px] rounded-lg border border-white/10 bg-gradient-to-br from-slate-700 to-slate-900 p-1.5"
          style={{ boxShadow: hover ? `0 0 32px rgba(${glow},.55)` : `0 0 14px rgba(${glow},.25)` }}
        >
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md"
            style={{ background: `radial-gradient(circle at 30% 20%, rgba(${glow},.55), rgba(15,23,42,.95) 70%)` }}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,255,255,.04)_50%)] bg-[length:100%_4px]" />
            <div className="pointer-events-none absolute -left-6 top-0 h-full w-10 rotate-12 bg-white/10 blur-sm transition-transform duration-700 group-hover:translate-x-40" />
            <span className="text-3xl font-black tracking-wider text-white drop-shadow">{t.name}</span>
            <span className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${open ? "text-emerald-300" : "text-indigo-200/80"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${open ? "animate-pulse bg-emerald-400" : "bg-slate-400"}`} />
              {open ? t.open_shift_no : "Idle"}
            </span>
          </div>
        </div>
        {/* Neck: joins screen to base */}
        <div className="absolute left-[62px] top-[88px] h-[30px] w-3 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600" />
        {/* Cash drawer: lit top face + front face, one solid block */}
        <div className="absolute left-0 top-[116px] w-36 overflow-hidden rounded-md shadow-[0_10px_20px_rgba(0,0,0,.45)]">
          <div className="h-3 bg-gradient-to-b from-slate-400 to-slate-500" />
          <div className="relative h-11 border-t border-black/30 bg-gradient-to-b from-slate-700 to-slate-800">
            <div className="mx-auto mt-4 h-1.5 w-14 rounded-full bg-slate-900/80 shadow-inner" />
            <div className={`absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,.9)]" : "bg-slate-500"}`} />
          </div>
        </div>
        {/* Floor shadow */}
        <div className="absolute left-3 top-[172px] h-4 rounded-[50%] bg-black/40 blur-md transition-transform duration-200"
          style={{ width: 120, transform: `scale(${hover ? 0.85 : 1})` }} />
      </div>
      <div className="mt-2 text-center">
        <div className="font-semibold">Terminal {t.name}</div>
        <div className={`text-xs ${open ? "text-emerald-500" : "text-muted-foreground"}`}>{open ? `Open: ${t.open_shift_no}` : "No open shift"}</div>
      </div>
    </button>
  );
}

function ShiftReport({ shift, summary }: { shift: PosShift; summary: ShiftSummary }) {
  const variance = Number(shift.variance ?? 0);
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1 rounded-lg border p-3">
        <Row label="Opening cash" value={summary.opening_float} />
        <Row label="Cash sales" value={summary.cash_sales} />
        {summary.voucher_cash > 0 && <Row label="Gift vouchers sold (cash)" value={summary.voucher_cash} />}
        {summary.pay_in > 0 && <Row label="Pay ins" value={summary.pay_in} />}
        {summary.pay_out > 0 && <Row label="Pay outs" value={-summary.pay_out} />}
        {summary.cash_refunds > 0 && <Row label="Cash refunds" value={-summary.cash_refunds} />}
        <Row label="Expected cash" value={summary.expected_cash} bold />
        {shift.counted_cash != null && <Row label="Counted cash" value={shift.counted_cash} bold />}
        {shift.counted_cash != null && (
          <div className={`flex justify-between font-semibold ${variance === 0 ? "text-emerald-600" : "text-rose-600"}`}>
            <span>{variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short"}</span>
            <span className="tabular-nums">{money(variance)}</span>
          </div>
        )}
      </div>
      <div className="space-y-1 rounded-lg border p-3">
        <div className="text-xs font-medium text-muted-foreground">All payments taken</div>
        {Object.entries(summary.methods || {}).map(([m, v]) => <Row key={m} label={`${m} (${v.count})`} value={v.total} />)}
        {Object.keys(summary.methods || {}).length === 0 && <div className="text-muted-foreground">No payments yet.</div>}
        <Row label={`Invoices (${summary.invoice_count})`} value={summary.sales_total} />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: any; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function ShiftPanel({ open, onOpenChange, shift, onShift, onClosed }: {
  open: boolean; onOpenChange: (o: boolean) => void; shift: PosShift; onShift: (s: PosShift) => void; onClosed: (s: PosShift) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"" | "PayIn" | "PayOut" | "close">("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setMode(""); setAmount(""); setReason(""); setCounts({}); setCounted(""); setNotes(""); } }, [open]);

  const sum = shift.summary_live;
  const denomTotal = DENOMS.reduce((s, d) => s + d * (Number(counts[d]) || 0), 0);
  const countedNum = counted !== "" ? Number(counted) : denomTotal;
  const variance = sum ? Math.round((countedNum - sum.expected_cash) * 100) / 100 : 0;

  const move = async () => {
    setBusy(true);
    try {
      const s = await posShiftApi.cashMove(mode as "PayIn" | "PayOut", Number(amount), reason);
      onShift(s); setMode(""); setAmount(""); setReason("");
      toast({ title: "Saved" });
    } catch (e: any) { toast({ title: "Not saved", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const close = async () => {
    setBusy(true);
    try {
      const d: Record<string, number> = {};
      DENOMS.forEach(x => { const n = Number(counts[x]) || 0; if (n) d[x] = n; });
      const s = await posShiftApi.close(countedNum, Object.keys(d).length ? d : null, notes);
      onClosed(s);
    } catch (e: any) { toast({ title: "Could not close the shift", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shift {shift.shift_no}</DialogTitle>
          <DialogDescription>{shift.terminal_name ? `${shift.terminal_name} · ` : ""}Opened {new Date(String(shift.opened_at).replace(" ", "T")).toLocaleString()}</DialogDescription>
        </DialogHeader>

        {sum && mode !== "close" && <ShiftReport shift={shift} summary={sum} />}

        {(mode === "PayIn" || mode === "PayOut") && (
          <form className="space-y-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); void move(); }}>
            <div className="font-medium">{mode === "PayIn" ? "Put cash into the drawer" : "Take cash out of the drawer"}</div>
            <Input autoFocus inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <Input placeholder={mode === "PayIn" ? "Reason, e.g. extra change" : "Reason, e.g. bought milk, cash to safe"} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMode("")}>Back</Button>
              <Button type="submit" disabled={busy || !(Number(amount) > 0) || !reason.trim()}>Save</Button>
            </div>
          </form>
        )}

        {mode === "close" && sum && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Count the notes and coins in the drawer, or type the total.</div>
            <div className="grid grid-cols-3 gap-2">
              {DENOMS.map(d => (
                <label key={d} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                  <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{d}×</span>
                  <input inputMode="numeric" className="w-full bg-transparent text-right text-sm outline-none" value={counts[d] || ""}
                    onChange={(e) => { setCounted(""); setCounts(c => ({ ...c, [d]: e.target.value.replace(/\D/g, "") })); }} aria-label={`${d} rupee count`} />
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-counted">Counted cash</Label>
              <Input id="shift-counted" inputMode="decimal" value={counted !== "" ? counted : denomTotal ? String(denomTotal) : ""} placeholder="0.00"
                onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} className="h-11 text-lg tabular-nums" />
            </div>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <Row label="Expected cash" value={sum.expected_cash} />
              <Row label="Counted" value={countedNum} />
              <div className={`flex justify-between font-semibold ${variance === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                <span>{variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short"}</span><span className="tabular-nums">{money(variance)}</span>
              </div>
            </div>
            {variance !== 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="shift-notes">Why is it different?</Label>
                <Input id="shift-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Required when the count is off" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("")}>Back</Button>
              <Button disabled={busy || (variance !== 0 && !notes.trim())} onClick={close}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Close shift
              </Button>
            </div>
          </div>
        )}

        {mode === "" && (
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("PayIn")}><ArrowDownToLine className="mr-1.5 h-4 w-4" /> Pay in</Button>
              <Button variant="outline" size="sm" onClick={() => setMode("PayOut")}><ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Pay out</Button>
            </div>
            <Button size="sm" onClick={() => setMode("close")}><LogOut className="mr-1.5 h-4 w-4" /> Close shift</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function printShift(s: PosShift) {
  const sum = s.summary!;
  const line = (l: string, v: any) => `<div class="r"><span>${l}</span><span>${money(v)}</span></div>`;
  const methods = Object.entries(sum.methods || {}).map(([m, v]) => line(`${m} (${v.count})`, v.total)).join("");
  const doc = (auto: boolean) => `<!doctype html><html><head><meta charset="utf-8"><title>${s.shift_no}</title>
  <style>body{font-family:monospace;width:72mm;margin:0 auto;font-size:12px}.r{display:flex;justify-content:space-between}.b{font-weight:700}h2{text-align:center;margin:4px 0}hr{border:0;border-top:1px dashed #000}</style></head>
  <body><h2>SHIFT REPORT</h2><div style="text-align:center">${s.shift_no}<br>${s.terminal_name ? `${s.terminal_name} · ` : ""}${s.user_name || ""} · ${s.location_name || ""}</div><hr>
  <div class="r"><span>Opened</span><span>${s.opened_at}</span></div><div class="r"><span>Closed</span><span>${s.closed_at || ""}</span></div><hr>
  ${line("Opening cash", sum.opening_float)}${line("Cash sales", sum.cash_sales)}${sum.voucher_cash ? line("Vouchers sold", sum.voucher_cash) : ""}
  ${sum.pay_in ? line("Pay ins", sum.pay_in) : ""}${sum.pay_out ? line("Pay outs", -sum.pay_out) : ""}${sum.cash_refunds ? line("Cash refunds", -sum.cash_refunds) : ""}<hr>
  <div class="b">${line("Expected cash", sum.expected_cash)}${line("Counted cash", s.counted_cash)}${line(Number(s.variance) === 0 ? "Balanced" : Number(s.variance) > 0 ? "Over" : "Short", s.variance)}</div>
  ${s.close_notes ? `<div>Note: ${String(s.close_notes).replace(/</g, "&lt;")}</div>` : ""}<hr><div class="b">Payments</div>${methods}${line(`Invoices (${sum.invoice_count})`, sum.sales_total)}
  <br><br><div>Cashier: ____________</div><br><div>Supervisor: ____________</div>
  ${auto ? "<script>window.onload=function(){window.print()}</script>" : ""}</body></html>`;

  // Silent: send straight to the receipt printer (or Windows default) via the local printer service.
  try {
    if (await isPrinterServiceAvailable()) {
      const r = await silentPrint(doc(false), "Receipt", undefined, `Shift ${s.shift_no}`);
      if (r?.success) return;
    }
  } catch { /* fall back to the browser dialog */ }

  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return;
  w.document.write(doc(true));
  w.document.close();
}

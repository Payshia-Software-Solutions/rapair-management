"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Minus, Plus } from "lucide-react";
import { fetchCompApprovers, type CompApprover } from "@/lib/api/orders";
import { usePOS } from "../../context/POSContext";
import { PosDialogHeader } from "./PosDialogHeader";

const REASONS = ["Manager's guest", "Service recovery", "Birthday / anniversary", "Long wait", "Staff meal", "Marketing / promotion"];

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Make an item (or the whole bill) complimentary: choose how many, a reason, and a manager
 * approves with their PIN. The item stays on the bill at full price with 100% off.
 */
export const CompApprovalDialog: React.FC = () => {
  const { compRequest, setCompRequest, approveCompItems, cart } = usePOS();
  const open = !!compRequest;
  const wholeBill = compRequest?.index === null;
  const line = compRequest && compRequest.index !== null ? cart[compRequest.index] : null;

  const [approvers, setApprovers] = useState<CompApprover[] | null>(null);
  const [approverId, setApproverId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin(""); setReason(""); setError(null); setBusy(false);
    setQty(line ? Number(line.quantity) : 1);
    fetchCompApprovers()
      .then((list) => { setApprovers(list); if (list.length === 1) setApproverId(String(list[0].id)); })
      .catch((e) => { setApprovers([]); setError(e?.message || "Couldn't load approvers."); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const billLines = useMemo(
    () => (wholeBill ? cart.filter((l: any) => !l.is_comp && !l.is_reward && Number(l.unit_price) > 0) : []),
    [wholeBill, cart]
  );
  const amount = wholeBill
    ? billLines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unit_price), 0)
    : line ? qty * Number(line.unit_price) : 0;

  const approver = approvers?.find((a) => String(a.id) === approverId);
  const limit = approver && approver.comp_limit !== null && approver.comp_limit !== "" ? Number(approver.comp_limit) : null;
  const overLimit = limit !== null && amount > limit + 0.001;

  const canSubmit = !!approverId && pin.length >= 4 && reason.trim().length > 0 && amount > 0 && !overLimit && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await approveCompItems(Number(approverId), pin, reason.trim(), wholeBill ? undefined : qty);
    } catch (err: any) {
      setPin("");
      setError(err?.message || "Couldn't approve.");
    } finally {
      setBusy(false);
    }
  };

  const maxQty = line ? Number(line.quantity) : 1;
  const step = (d: number) => setQty((q) => Math.min(maxQty, Math.max(1, Math.round((q + d) * 1000) / 1000)));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) setCompRequest(null); }}>
      <DialogContent size="sm" className="p-0 gap-0">
        <PosDialogHeader
          title={wholeBill ? "Complimentary bill" : "Complimentary item"}
          description="Stays on the bill at full price, free to the guest. A manager must approve."
        />
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {line && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{line.description}</div>
                <div className="text-xs text-muted-foreground tabular-nums">LKR {money(Number(line.unit_price))} each</div>
              </div>
              {maxQty > 1 && (
                <div className="flex items-center gap-1 shrink-0" aria-label="Quantity to make complimentary">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} disabled={qty <= 1} aria-label="Fewer">
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums">{qty} / {maxQty}</span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} disabled={qty >= maxQty} aria-label="More">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {wholeBill && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {billLines.length} item{billLines.length === 1 ? "" : "s"} on this bill
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Complimentary value</span>
            <span className="font-semibold tabular-nums">LKR {money(amount)}</span>
          </div>

          <div>
            <div className="text-sm font-medium mb-1.5">Reason</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={`h-8 px-2.5 rounded-md border text-xs transition-colors ${reason === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 255))} placeholder="Or type a reason" aria-label="Reason" className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="comp-approver" className="text-sm font-medium">Approved by</label>
              <select
                id="comp-approver"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{approvers === null ? "Loading…" : "Select"}</option>
                {(approvers || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="comp-pin" className="text-sm font-medium">Approver PIN</label>
              <Input
                id="comp-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 h-10 text-center tracking-[0.4em]"
              />
            </div>
          </div>

          {approver && (
            <p className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {limit === null
                ? `${approver.name} can approve any amount.`
                : overLimit
                  ? `Over ${approver.name}'s limit of LKR ${money(limit)}. Choose a senior manager.`
                  : `${approver.name}'s limit: LKR ${money(limit)} per approval.`}
            </p>
          )}
          {approvers && approvers.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">
              No approvers yet. An admin, or a role with the &ldquo;pos.comp&rdquo; permission, needs a POS PIN set on their profile.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setCompRequest(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Approve
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { fetchVoidApprovers } from "@/lib/api/orders";
import { usePOS } from "../../context/POSContext";
import { PosDialogHeader } from "./PosDialogHeader";

const REASONS = ["Customer changed mind", "Wrong item entered", "Out of stock", "Taking too long", "Quality issue"];

/**
 * Removing an item the kitchen already received: pick an approver, enter their PIN,
 * give a reason. The kitchen then gets a CANCELLED slip naming the approver.
 */
export const VoidApprovalDialog: React.FC = () => {
  const { voidRequest, setVoidRequest, approveVoid, cart } = usePOS();
  const open = !!voidRequest;
  const line = voidRequest ? cart[voidRequest.index] : null;
  const removeQty = line && voidRequest ? Math.round((Number(line.kot_qty || 0) - voidRequest.newQty) * 1000) / 1000 : 0;

  const [approvers, setApprovers] = useState<Array<{ id: number; name: string; role: string }> | null>(null);
  const [approverId, setApproverId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin(""); setReason(""); setError(null); setBusy(false);
    fetchVoidApprovers()
      .then((list) => { setApprovers(list); if (list.length === 1) setApproverId(String(list[0].id)); })
      .catch((e) => { setApprovers([]); setError(e?.message || "Couldn't load approvers."); });
  }, [open]);

  const canSubmit = !!approverId && pin.length >= 4 && reason.trim().length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await approveVoid(Number(approverId), pin, reason.trim());
    } catch (err: any) {
      setPin("");
      setError(err?.message || "Couldn't remove the item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) setVoidRequest(null); }}>
      <DialogContent size="sm" className="p-0 gap-0">
        <PosDialogHeader
          title="Approval needed"
          description="This item was already sent to the kitchen. A manager must approve removing it."
        />
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {line && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-medium">Remove {removeQty} ×</span> {line.description}
              {voidRequest && voidRequest.newQty > 0 && (
                <span className="text-muted-foreground"> (keeps {voidRequest.newQty})</span>
              )}
            </div>
          )}

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
              <label htmlFor="void-approver" className="text-sm font-medium">Approved by</label>
              <select
                id="void-approver"
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
              <label htmlFor="void-pin" className="text-sm font-medium">Approver PIN</label>
              <Input
                id="void-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 h-10 text-center tracking-[0.4em]"
              />
            </div>
          </div>

          {approvers && approvers.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">
              No approvers yet. An admin, or a role with the &ldquo;pos.void&rdquo; permission, needs a POS PIN set on their profile.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setVoidRequest(null)} disabled={busy}>Keep item</Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Approve &amp; remove
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

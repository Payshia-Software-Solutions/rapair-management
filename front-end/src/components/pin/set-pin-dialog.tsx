"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { savePin } from "@/lib/api/pin";

/**
 * Set or change the signed-in user's POS PIN.
 * Asks for the account password so the PIN can't be changed on an unattended terminal.
 */
export function SetPinDialog({
  open,
  onOpenChange,
  hasPin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasPin?: boolean;
  onSaved?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setPin(""); setConfirm(""); setPassword(""); setError(null); }
  }, [open]);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  const mismatch = confirm.length > 0 && confirm !== pin;
  const canSave = pin.length >= 4 && confirm === pin && password.length > 0 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await savePin(pin, password);
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Couldn't save the PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader className="text-left">
          <DialogTitle>{hasPin ? "Change POS PIN" : "Set POS PIN"}</DialogTitle>
          <DialogDescription>Used to unlock the POS screen. 4 to 6 digits.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-pin" className="text-sm font-medium">New PIN</label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(digits(e.target.value))}
                className="mt-1.5 h-10 tracking-[0.4em] text-center"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="confirm-pin" className="text-sm font-medium">Confirm PIN</label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(digits(e.target.value))}
                aria-invalid={mismatch}
                aria-describedby={mismatch ? "pin-mismatch" : undefined}
                className={`mt-1.5 h-10 tracking-[0.4em] text-center ${mismatch ? "border-destructive" : ""}`}
              />
            </div>
          </div>
          {mismatch && <p id="pin-mismatch" className="text-xs text-destructive">PINs don't match.</p>}
          <p className="text-xs text-muted-foreground">Avoid easy PINs like 1111 or 1234; they're not accepted.</p>

          <div>
            <label htmlFor="pin-password" className="text-sm font-medium">Your account password</label>
            <Input
              id="pin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-10"
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSave}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save PIN
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

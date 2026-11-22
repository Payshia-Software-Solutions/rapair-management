"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Eye, EyeOff, Loader2, Wand2 } from "lucide-react";
import { resetUserPassword } from "@/lib/api/pin";

/** Readable random password: letters + digits, no look-alikes (0/O, 1/l/I). */
function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [pick(letters), pick(letters), pick(digits), pick(digits)];
  while (chars.length < 10) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function ResetPasswordDialog({
  user,
  onOpenChange,
  onDone,
}: {
  user: { id: number; name: string; email: string } | null;
  onOpenChange: (open: boolean) => void;
  onDone: (name: string) => void;
}) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user) { setPwd(""); setShow(false); setError(null); setSaving(false); setDone(false); }
  }, [user]);

  const problem =
    pwd.length === 0 ? null :
    pwd.length < 8 ? "At least 8 characters." :
    !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd) ? "Use letters and numbers." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || problem || !pwd) return;
    setSaving(true);
    setError(null);
    try {
      await resetUserPassword(user.id, pwd);
      setDone(true);
      onDone(user.name);
    } catch (err: any) {
      setError(err?.message || "Couldn't reset the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent size="sm">
        <DialogHeader className="text-left">
          <DialogTitle>{done ? "Password reset" : "Reset password"}</DialogTitle>
          <DialogDescription>
            {user ? <>{user.name} · {user.email}</> : null}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p className="text-sm">Give this new password to <b>{user?.name}</b>. Ask them to keep it private.</p>
            <div className="flex gap-2">
              <Input readOnly value={pwd} className="font-mono" onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" aria-label="Copy password" onClick={() => void navigator.clipboard?.writeText(pwd)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Already signed-in devices stay signed in until their session expires.</p>
            <div className="flex justify-end"><Button onClick={() => onOpenChange(false)}>Done</Button></div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="new-pwd" className="text-sm font-medium">New password</label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new-pwd"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    aria-invalid={!!problem}
                    aria-describedby="new-pwd-help"
                    className={`h-10 pr-10 ${problem ? "border-destructive" : ""}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { setPwd(generatePassword()); setShow(true); }}>
                  <Wand2 className="w-4 h-4 mr-1.5" aria-hidden="true" /> Generate
                </Button>
              </div>
              <p id="new-pwd-help" className={`mt-1 text-xs ${problem ? "text-destructive" : "text-muted-foreground"}`}>
                {problem || "At least 8 characters, with letters and numbers."}
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!pwd || !!problem || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Reset password
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

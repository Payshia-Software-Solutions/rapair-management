"use client";

import { clearUserSession } from "@/lib/session";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Delete, Loader2, Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPinStatus, verifyPin } from "@/lib/api/pin";
import { SetPinDialog } from "@/components/pin/set-pin-dialog";
import { usePOS } from "../context/POSContext";

/* ------------------------------------------------------------------ lock store
 * Saved per terminal (localStorage) so a page refresh can't skip the lock.
 */
const LOCK_KEY = "pos_locked";
const AUTOLOCK_KEY = "pos_autolock_min";
const LOCK_EVENT = "pos-lock-change";
const REQUEST_EVENT = "pos-request-lock";

const readLocked = () => { try { return window.localStorage.getItem(LOCK_KEY) === "1"; } catch { return false; } };
const setLocked = (v: boolean) => {
  try { v ? window.localStorage.setItem(LOCK_KEY, "1") : window.localStorage.removeItem(LOCK_KEY); } catch {}
  window.dispatchEvent(new Event(LOCK_EVENT));
};
const subscribe = (cb: () => void) => {
  window.addEventListener(LOCK_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(LOCK_EVENT, cb); window.removeEventListener("storage", cb); };
};
export const usePosLocked = () => useSyncExternalStore(subscribe, readLocked, () => false);

/** Ask to lock the POS (sets up a PIN first if the user has none). */
export const requestPosLock = () => window.dispatchEvent(new Event(REQUEST_EVENT));

/** Auto-lock after N idle minutes (0 = off). Saved per terminal. */
export const getAutoLockMinutes = () => { try { return Number(window.localStorage.getItem(AUTOLOCK_KEY) ?? 5) || 0; } catch { return 5; } };
export const setAutoLockMinutes = (m: number) => {
  try { window.localStorage.setItem(AUTOLOCK_KEY, String(m)); } catch {}
  window.dispatchEvent(new Event(LOCK_EVENT));
};

function useSignedInName() {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      const part = window.localStorage.getItem("auth_token")?.split(".")[1];
      if (!part) return;
      const p = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      setName(p.name || p.username || p.email || "");
    } catch {}
  }, []);
  return name;
}

/* ------------------------------------------------------------------ component */
export const PosLockScreen: React.FC = () => {
  const { locations, selectedLocation } = usePOS();
  const locked = usePosLocked();
  const user = useSignedInName();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const locationName = locations.find((l: any) => String(l.id) === String(selectedLocation))?.name || "";

  useEffect(() => { fetchPinStatus().then((d) => setHasPin(!!d.has_pin)).catch(() => setHasPin(false)); }, []);

  const lockNow = useCallback(() => {
    setPin(""); setError(null); setBlocked(false);
    setLocked(true);
  }, []);

  // Lock requests from buttons/menus: set a PIN first if needed
  useEffect(() => {
    const onRequest = () => (hasPin ? lockNow() : setSetupOpen(true));
    window.addEventListener(REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REQUEST_EVENT, onRequest);
  }, [hasPin, lockNow]);

  // Idle auto-lock (only once a PIN exists, never while already locked)
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!hasPin || locked) return;
    const bump = () => { lastActivity.current = Date.now(); };
    const evts = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    const t = setInterval(() => {
      const mins = getAutoLockMinutes();
      if (mins > 0 && Date.now() - lastActivity.current > mins * 60_000) lockNow();
    }, 15_000);
    return () => { evts.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [hasPin, locked, lockNow]);

  // Clock on the lock screen
  useEffect(() => {
    if (!locked) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [locked]);

  const submit = useCallback(async (value: string) => {
    if (value.length < 4 || checking || blocked) return;
    setChecking(true);
    setError(null);
    try {
      await verifyPin(value);
      setPin("");
      setLocked(false);
    } catch (e: any) {
      setPin("");
      setError(e?.message || "Couldn't check the PIN.");
      if (e?.status === 423) setBlocked(true);
      if (e?.status === 409) setHasPin(false); // PIN was cleared by an admin
    } finally {
      setChecking(false);
    }
  }, [checking, blocked]);

  const press = useCallback((k: string) => {
    if (blocked || checking) return;
    setError(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (k === "ok") void submit(pin);
    else setPin((p) => (p.length < 6 ? p + k : p));
  }, [blocked, checking, pin, submit]);

  // While locked: our keys only. Capture phase + stopImmediatePropagation keeps the
  // POS shortcuts (F8/F9), qty keypad and barcode scanner from acting underneath.
  useEffect(() => {
    if (!locked) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
      else if (e.key === "Enter") { e.preventDefault(); press("ok"); }
      else if (e.key !== "Tab") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [locked, press]);

  const signOut = () => {
    setLocked(false);
    clearUserSession();
    window.location.href = "/login";
  };

  return (
    <>
      <SetPinDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        hasPin={false}
        onSaved={() => { setHasPin(true); lockNow(); }}
      />

      {locked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="POS locked"
          className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xs flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold">POS locked</h2>
            <p className="text-sm text-muted-foreground">
              {user ? <>Enter the PIN for <span className="font-medium text-foreground">{user}</span></> : "Enter your PIN"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locationName}{locationName && now ? " · " : ""}{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </p>

            {/* PIN dots */}
            <div className="flex gap-2.5 my-5 h-4" aria-live="polite" aria-label={`${pin.length} digits entered`}>
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < pin.length ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
              ))}
            </div>

            <div className="min-h-[2.5rem] mb-2">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</span>
              ) : error ? (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              ) : hasPin === false ? (
                <p className="text-sm text-muted-foreground">This account has no PIN. Sign out and back in with your password.</p>
              ) : null}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"].map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={k === "ok" ? "default" : "outline"}
                  disabled={blocked || checking || hasPin === false || (k === "ok" && pin.length < 4)}
                  aria-label={k === "back" ? "Delete last digit" : k === "ok" ? "Unlock" : undefined}
                  className="h-14 text-xl font-semibold tabular-nums"
                  onClick={() => press(k)}
                >
                  {k === "back" ? <Delete className="w-5 h-5" /> : k === "ok" ? "Unlock" : k}
                </Button>
              ))}
            </div>

            <button
              type="button"
              onClick={signOut}
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> Not you? Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
};

"use client";

import React, { useEffect, useState } from "react";
import { MapPin, User, Wifi, WifiOff, Clock, Lock, ChefHat, Printer } from "lucide-react";
import { PrintQueueDialog } from "./Dialogs/PrintQueueDialog";
import { fetchQueueLocationStatus, getKotRoute } from "@/lib/api/printqueue";
import { requestPosLock } from "./PosLockScreen";
import { usePOS } from "../context/POSContext";
import { openShiftPanel, SHIFT_EVENT } from "./PosShiftGate";
import { Wallet } from "lucide-react";

/** Read the signed-in user's display name from the JWT (no network call). */
function useSignedInUser() {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    try {
      const token = window.localStorage.getItem("auth_token");
      const part = token?.split(".")[1];
      if (!part) return;
      const p = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      setName(p.name || p.full_name || p.username || p.email || "");
    } catch {}
  }, []);
  return name;
}

/**
 * Slim terminal status bar (bottom of the POS):
 * location (shown read-only), cashier,
 * connection state, and a live clock.
 */
export const PosStatusBar: React.FC = () => {
  const { locations, selectedLocation } = usePOS();
  const user = useSignedInUser();
  const [now, setNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Kitchen printer (server queue) status, polled while this terminal sends KOTs to the kitchen PC
  const [kitchen, setKitchen] = useState<{ waiting: number; failed: number; devices_online: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (getKotRoute() !== 'queue') { if (alive) setKitchen(null); return; }
      try { const s = await fetchQueueLocationStatus(); if (alive) setKitchen(s); } catch {}
    };
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [selectedLocation]);
  const [queueOpen, setQueueOpen] = useState(false);
  // Open cashier shift (told by PosShiftGate)
  const { canCheckout } = usePOS();
  const [shiftNo, setShiftNo] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setShiftNo((e as CustomEvent).detail?.shift_no || null);
    window.addEventListener(SHIFT_EVENT, on);
    return () => window.removeEventListener(SHIFT_EVENT, on);
  }, []);

  const current = locations.find((l: any) => String(l.id) === String(selectedLocation));

  return (
    <footer
      className="h-8 shrink-0 border-t border-border bg-muted/50 px-3 flex items-center gap-4 text-xs text-muted-foreground select-none"
      aria-label="Terminal status"
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {/* Read-only: the POS location is not switched from the terminal */}
        <span className="font-medium text-foreground truncate">{current?.name || "No location"}</span>
      </span>

      {user && (
        <span className="hidden sm:flex items-center gap-1.5 min-w-0">
          <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{user}</span>
        </span>
      )}

      <span className={`flex items-center gap-1.5 ${online ? "" : "text-destructive font-medium"}`}>
        {online ? <Wifi className="w-3.5 h-3.5" aria-hidden="true" /> : <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />}
        {online ? "Online" : "Offline"}
      </span>

      {/* Print queue: kitchen tickets (server queue) + this terminal's printer app. Opens the panel. */}
      <button
        type="button"
        onClick={() => setQueueOpen(true)}
        title="Open the print queue"
        className={`flex items-center gap-1.5 h-6 px-2 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          kitchen && (kitchen.failed > 0 || kitchen.devices_online === 0 || kitchen.waiting > 0) ? 'text-destructive font-medium' : ''}`}
      >
        {kitchen ? <ChefHat className="w-3.5 h-3.5" aria-hidden="true" /> : <Printer className="w-3.5 h-3.5" aria-hidden="true" />}
        {!kitchen ? 'Print queue'
          : kitchen.failed > 0 ? `${kitchen.failed} ticket${kitchen.failed > 1 ? 's' : ''} failed`
          : kitchen.devices_online === 0 ? 'Kitchen printer offline'
          : kitchen.waiting > 0 ? `${kitchen.waiting} waiting`
          : 'Kitchen printer ready'}
      </button>
      <PrintQueueDialog open={queueOpen} onOpenChange={(v) => { setQueueOpen(v); if (!v && getKotRoute() === 'queue') fetchQueueLocationStatus().then(setKitchen).catch(() => {}); }} />

      {canCheckout && (
        <button
          type="button"
          onClick={openShiftPanel}
          title="Shift: pay in, pay out, close and count the drawer"
          className="ml-auto flex items-center gap-1.5 h-6 px-2 rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" /> {shiftNo ? `Shift ${shiftNo}` : "Shift"}
        </button>
      )}

      <button
        type="button"
        onClick={requestPosLock}
        className={`${canCheckout ? "" : "ml-auto "}flex items-center gap-1.5 h-6 px-2 rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        title="Lock the POS (Alt+L)"
      >
        <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Lock
      </button>

      <span className="flex items-center gap-1.5 tabular-nums">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        {now
          ? `${now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : ""}
      </span>
    </footer>
  );
};

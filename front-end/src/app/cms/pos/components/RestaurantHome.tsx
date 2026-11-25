"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeft, Clock, ClipboardList, Printer, ShoppingBag, Store, Utensils } from "lucide-react";
import { usePOS } from "../context/POSContext";
import { PosFloorView } from "./PosFloorView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { currentUserId } from "@/lib/session";
import { erpHomeRoute } from "@/lib/home-route";
import { verifySupervisorPin } from "@/lib/api/pin";
import { Lock } from "lucide-react";

/**
 * Restaurant profile start screen, shown in the POS's left panel instead of the order-type popup.
 * Pick a table on the floor (plan or cards), or start a Take away / Retail bill; the item grid
 * then takes the left panel as usual. Orders stewards send from their tablets are listed in the
 * "Steward orders" panel.
 */
export function RestaurantHome() {
    const {
        selectedLocation, locations, heldOrders, refreshHeldOrders, loadPOSBill,
        setOrderType, setSelectedTable, setSelectedSteward, canCheckout, printKOT,
        setGuestPrintOrderId, setGuestPrintSelectionOpen, stewards,
    } = usePOS();
    const [stewardOpen, setStewardOpen] = useState(false);
    // Table waiting for the cashier to pick a steward (or none)
    const [pendingTable, setPendingTable] = useState<{ id: number; name: string } | null>(null);
    // Table that already has an open bill: open it, or start another one with a supervisor PIN
    const [busyTable, setBusyTable] = useState<{ orderId: number; table: { id: number; name: string } } | null>(null);
    const [pinMode, setPinMode] = useState(false);
    const [pin, setPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [pinBusy, setPinBusy] = useState(false);
    const closeBusy = () => { setBusyTable(null); setPinMode(false); setPin(""); setPinError(""); };
    const approveNewBill = async () => {
        if (!busyTable || !pin) return;
        setPinBusy(true); setPinError("");
        try {
            await verifySupervisorPin(pin, `table_rebook:${busyTable.table.id}`);
            const t = busyTable.table;
            closeBusy();
            startTable(t);
        } catch (e: any) {
            setPinError(e?.message || "PIN not accepted.");
            setPin("");
        } finally {
            setPinBusy(false);
        }
    };

    const loc = locations.find((l: any) => String(l.id) === String(selectedLocation));
    const allow = (k: string) => !loc || Boolean(loc[k]);

    // Orders from steward tablets: held bills with a steward on them
    const stewardOrders = useMemo(() => (heldOrders || []).filter((o: any) => o.steward_id), [heldOrders]);
    const otherHeld = (heldOrders || []).length - stewardOrders.length;

    const openTable = (t: { id: number; name: string }, stewardId: string | null) => {
        setPendingTable(null);
        setOrderType("dine_in");
        setSelectedTable(String(t.id));
        setSelectedSteward(stewardId);
    };
    const startTable = (t: { id: number; name: string }) => {
        // Stewards serve their own tables
        if (!canCheckout) return openTable(t, (currentUserId() as any) || null);
        // Cashier: ask who serves this table, unless no stewards are set up
        if (!stewards || stewards.length === 0) return openTable(t, null);
        setPendingTable(t);
    };
    const startType = (type: "take_away" | "retail") => {
        setSelectedTable(null);
        setSelectedSteward(null);
        setOrderType(type);
    };
    const openBill = (id: number) => { setStewardOpen(false); void loadPOSBill(id); };

    const ago = (iso?: string) => {
        if (!iso) return "";
        const m = Math.max(0, Math.round((Date.now() - new Date(String(iso).replace(" ", "T")).getTime()) / 60000));
        return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
    };

    return (
        <div className="flex h-full flex-col gap-3 bg-slate-100 p-3 dark:bg-background">
            {/* Order types + panels */}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={async () => { window.location.href = await erpHomeRoute(); }} className="text-muted-foreground">
                    <ArrowLeft className="mr-1 h-4 w-4" /> ERP
                </Button>
                <div className="mr-auto flex items-center gap-2 px-1">
                    <Utensils className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Choose a table</span>
                </div>
                {allow("allow_take_away") && (
                    <Button variant="outline" onClick={() => startType("take_away")} className="h-10 gap-2 bg-card">
                        <ShoppingBag className="h-4 w-4 text-emerald-600" /> Take away
                    </Button>
                )}
                {allow("allow_retail") && (
                    <Button variant="outline" onClick={() => startType("retail")} className="h-10 gap-2 bg-card">
                        <Store className="h-4 w-4 text-amber-600" /> Retail
                    </Button>
                )}
                <Button onClick={() => { void refreshHeldOrders(); setStewardOpen(true); }} className="relative h-10 gap-2">
                    <ClipboardList className="h-4 w-4" /> Open orders
                    {(heldOrders || []).length > 0 && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs font-bold tabular-nums">{(heldOrders || []).length}</span>
                    )}
                </Button>
            </div>

            <div className="min-h-0 flex-1 rounded-xl border bg-card p-3">
                <PosFloorView
                    locationId={selectedLocation}
                    heldOrders={heldOrders}
                    onRefresh={() => refreshHeldOrders()}
                    onPickFree={startTable}
                    onPickBusy={(id, t) => (t ? setBusyTable({ orderId: id, table: t }) : openBill(id))}
                    onSkip={() => startTable({ id: "none" as any, name: "No Table" })}
                />
            </div>

            {/* Steward / open orders panel */}
            <Dialog open={stewardOpen} onOpenChange={setStewardOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Open orders</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {stewardOrders.length} from stewards{otherHeld > 0 ? ` · ${otherHeld} held at the counter` : ""}. New tablet orders appear here on their own.
                        </p>
                    </DialogHeader>
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                        {(heldOrders || []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No open orders.</p>}
                        {[...stewardOrders, ...(heldOrders || []).filter((o: any) => !o.steward_id)].map((o: any) => (
                            <div key={o.id} className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary">
                                <button onClick={() => openBill(Number(o.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                                        <span className="text-[10px] leading-none">{o.table_name ? "Table" : "#"}</span>
                                        <span className="text-sm font-bold leading-tight">{o.table_name || o.id}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">
                                            {o.steward_name ? o.steward_name : "Counter"} · {String(o.order_type || "").replace("_", " ")}
                                        </p>
                                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" /> {ago(o.created_at)} · {o.customer_name}
                                        </p>
                                    </div>
                                </button>
                                <span className="text-sm font-bold tabular-nums">LKR {Number(o.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <Button size="sm" variant="outline" title="Reprint KOT" onClick={() => void printKOT(o.id, true)}><Utensils className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="outline" title="Print guest bill" onClick={() => { setGuestPrintOrderId(o.id); setGuestPrintSelectionOpen(true); }}><Printer className="h-3.5 w-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Steward for the chosen table */}
            <Dialog open={!!pendingTable} onOpenChange={(o) => { if (!o) setPendingTable(null); }}>
                <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Who serves {pendingTable?.name}?</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => pendingTable && openTable(pendingTable, null)}
                            className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm font-semibold text-muted-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            Continue without steward
                        </button>
                        {(stewards || []).map((s: any) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => pendingTable && openTable(pendingTable, String(s.id))}
                                className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary hover:bg-primary/5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                    {String(s.name || "?").charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate text-sm font-semibold">{s.name}</span>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Table already has an open bill */}
            <Dialog open={!!busyTable} onOpenChange={(o) => { if (!o) closeBusy(); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{busyTable?.table.name} is occupied</DialogTitle>
                    </DialogHeader>
                    {!pinMode ? (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">This table already has an open bill.</p>
                            <Button className="w-full" onClick={() => { const id = busyTable!.orderId; closeBusy(); openBill(id); }}>
                                Open the current bill
                            </Button>
                            <Button variant="outline" className="w-full gap-2" onClick={() => setPinMode(true)}>
                                <Lock className="h-4 w-4" /> New bill on this table
                            </Button>
                        </div>
                    ) : (
                        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void approveNewBill(); }}>
                            <p className="text-sm text-muted-foreground">A manager or supervisor must enter their PIN to book this table again.</p>
                            <input
                                autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={8}
                                value={pin} onChange={(e) => setPin(e.target.value.replace(/D/g, ""))}
                                placeholder="Supervisor PIN"
                                className="h-12 w-full rounded-xl border bg-background text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {pinError && <p className="text-sm text-destructive">{pinError}</p>}
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" className="flex-1" onClick={() => { setPinMode(false); setPin(""); setPinError(""); }}>Back</Button>
                                <Button type="submit" className="flex-1" disabled={!pin || pinBusy}>{pinBusy ? "Checking…" : "Approve"}</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

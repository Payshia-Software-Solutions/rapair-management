"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Combine, LayoutGrid, Link2, Loader2, Map as MapIcon, RefreshCw, Split, Users, X } from "lucide-react";
import { fetchFloorLayout, mergeTables, unmergeTables, type FloorLayout, type FloorTable } from "@/lib/api/floor";
import { FLOOR_3D_CSS, FloorObjectShape, FloorTableShape, GRID_BG, WOOD_FLOOR_BG, type TableTone } from "@/components/floor/floor-shapes";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Dine-in table choice for the Restaurant POS profile: the location's floor plan, coloured live.
 * A table with an open (held) bill is red and opens that bill; a free table starts a new order.
 * The floor plan is optional: "Cards" shows the same live tables as a simple grid (remembered on
 * this device), and locations without a drawn plan always use cards.
 * "Merge" seats a group across tables: the others join the main table and share its bill.
 */
export function PosFloorView({
    locationId, heldOrders, onPickFree, onPickBusy, onSkip, onRefresh,
}: {
    locationId: string | number | null;
    heldOrders: any[];
    onPickFree: (table: { id: number; name: string }) => void;
    onPickBusy: (orderId: number, table?: { id: number; name: string }) => void;
    onSkip: () => void;
    onRefresh?: () => void;
}) {
    const { toast } = useToast();
    const [layout, setLayout] = useState<FloorLayout | null>(null);
    const [error, setError] = useState("");
    const [areaKey, setAreaKey] = useState("");
    const [scale, setScale] = useState(1);
    const [now, setNow] = useState(Date.now());
    const viewKey = `pos_table_view_${locationId ?? ""}`;
    const [view, setViewState] = useState<"plan" | "cards">("plan");
    useEffect(() => {
        try { setViewState(localStorage.getItem(viewKey) === "cards" ? "cards" : "plan"); } catch {}
    }, [viewKey]);
    const setView = (v: "plan" | "cards") => { setViewState(v); try { localStorage.setItem(viewKey, v); } catch {} };
    const wrap = useRef<HTMLDivElement>(null);

    // Merge mode: first table tapped is the main one
    const [merging, setMerging] = useState(false);
    const [mergeSel, setMergeSel] = useState<number[]>([]);
    const [busyAction, setBusyAction] = useState(false);

    const load = async () => {
        setError("");
        try {
            const l = await fetchFloorLayout(locationId ?? undefined);
            setLayout(l);
            setAreaKey((k) => (l.areas.some((a) => a.key === k) ? k : l.areas[0]?.key || ""));
        } catch (e: any) {
            setError(e.message || "Couldn't load the floor plan");
        }
    };
    useEffect(() => { void load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

    // "Seated for" times tick every 30 s
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

    const area = layout?.areas.find((a) => a.key === areaKey);

    // 3D look (tilted floor, raised tables) or flat; remembered on this device
    const [look, setLookState] = useState<"3d" | "flat">("3d");
    useEffect(() => { try { setLookState(localStorage.getItem("pos_floor_look") === "flat" ? "flat" : "3d"); } catch {} }, []);
    const setLook = (v: "3d" | "flat") => { setLookState(v); try { localStorage.setItem("pos_floor_look", v); } catch {} };
    const TILT = 38;

    // Merged groups are drawn pushed together: joined tables line up beside their main table
    // (display only; the saved plan keeps each table's own place)
    const shown = useMemo(() => {
        const tables = layout?.tables || [];
        const byIdLocal = new Map(tables.map((t) => [t.id!, t]));
        const out = new Map<string, FloorTable>();
        const groupBoxes: { mainId: number; areaKey: string; x: number; y: number; w: number; h: number }[] = [];
        for (const t of tables) if (!t.joined_to) out.set(t.key, t);
        for (const main of tables) {
            if (main.joined_to) continue;
            const members = tables.filter((t) => t.joined_to === main.id && t.areaKey === main.areaKey);
            if (!members.length) continue;
            const areaW = layout?.areas.find((a) => a.key === main.areaKey)?.width || 1200;
            const total = members.reduce((s, m) => s + m.width + 2, 0);
            const toRight = main.pos_x + main.width + total <= areaW;
            let x = toRight ? main.pos_x + main.width + 2 : main.pos_x - 2;
            let maxH = main.height;
            for (const m of members) {
                const nx = toRight ? x : x - m.width;
                out.set(m.key, { ...m, pos_x: nx, pos_y: main.pos_y + (main.height - m.height) / 2, rotation: 0 });
                x = toRight ? x + m.width + 2 : nx - 2;
                maxH = Math.max(maxH, m.height);
            }
            const x0 = toRight ? main.pos_x : x + 2, x1 = toRight ? x - 2 : main.pos_x + main.width;
            groupBoxes.push({ mainId: main.id!, areaKey: main.areaKey || "", x: x0, y: main.pos_y + (main.height - maxH) / 2, w: x1 - x0, h: maxH });
        }
        // members on another area than their main stay where they are
        for (const t of tables) if (!out.has(t.key)) out.set(t.key, t);
        return { tables: tables.map((t) => out.get(t.key)!), groupBoxes, byIdLocal };
    }, [layout]);

    // Only the part of the area that has tables or drawings is shown (plus a margin)
    const bounds = useMemo(() => {
        if (!area || !layout) return null;
        const items = [
            ...shown.tables.filter((t) => t.areaKey === area.key),
            ...layout.objects.filter((o) => o.areaKey === area.key),
        ];
        if (!items.length) return { x: 0, y: 0, w: area.width, h: area.height };
        const pad = 70;
        const x0 = Math.max(0, Math.min(...items.map((i) => i.pos_x)) - pad);
        const y0 = Math.max(0, Math.min(...items.map((i) => i.pos_y)) - pad);
        const x1 = Math.min(area.width, Math.max(...items.map((i) => i.pos_x + i.width)) + pad);
        const y1 = Math.min(area.height, Math.max(...items.map((i) => i.pos_y + i.height)) + pad);
        return { x: x0, y: y0, w: Math.max(x1 - x0, 520), h: Math.max(y1 - y0, 360) };
    }, [area, layout, shown]);

    // Scale the plan to fit the panel (a tilted floor looks shorter, so it can be larger)
    useEffect(() => {
        if (!bounds || !wrap.current) return;
        const fit = () => {
            const el = wrap.current!;
            const hFactor = look === "3d" ? Math.cos((TILT * Math.PI) / 180) : 1;
            setScale(Math.min(1.4, (el.clientWidth - 60) / bounds.w, (el.clientHeight - 70) / (bounds.h * hFactor)));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(wrap.current);
        return () => ro.disconnect();
    }, [bounds, look]);

    const byId = useMemo(() => new Map((layout?.tables || []).map((t) => [t.id!, t])), [layout]);
    const mainOf = (t: FloorTable) => (t.joined_to && byId.has(t.joined_to) ? byId.get(t.joined_to)! : t);
    const joinedTo = (mainId: number) => (layout?.tables || []).filter((t) => t.joined_to === mainId);

    const openByTable = useMemo(() => {
        const m = new Map<number, any>();
        for (const o of heldOrders || []) if (o.table_id && !m.has(Number(o.table_id))) m.set(Number(o.table_id), o);
        return m;
    }, [heldOrders]);

    const tones = (t: FloorTable): TableTone => {
        const main = mainOf(t);
        if (merging && mergeSel.includes(t.id!)) return "selected";
        if (t.status === "Out of Service") return "off";
        if (openByTable.has(main.id!)) return "busy";
        if (main.status === "Reserved") return "reserved";
        if (t.joined_to) return "bill";      // joined to a group that hasn't ordered yet
        return "free";
    };

    const minutes = (iso?: string) => {
        if (!iso) return "";
        const m = Math.max(0, Math.round((now - new Date(String(iso).replace(" ", "T")).getTime()) / 60000));
        return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
    };

    const pick = (t: FloorTable) => {
        if (merging) {
            if (t.status === "Out of Service") return;
            setMergeSel((s) => (s.includes(t.id!) ? s.filter((x) => x !== t.id) : [...s, t.id!]));
            return;
        }
        if (tones(t) === "off") return;
        const main = mainOf(t);                       // a joined table acts as its main table
        const order = openByTable.get(main.id!);
        if (order) onPickBusy(Number(order.id), { id: main.id!, name: main.name }); else onPickFree({ id: main.id!, name: main.name });
    };

    const doMerge = async () => {
        if (mergeSel.length < 2) return;
        const [primary, ...rest] = mergeSel;
        setBusyAction(true);
        try {
            const r = await mergeTables(primary, rest);
            toast({ title: "Tables merged", description: r.message });
            setMerging(false);
            setMergeSel([]);
            await load();
            onRefresh?.();
        } catch (e: any) {
            toast({ title: "Couldn't merge", description: e.message, variant: "destructive" });
        } finally {
            setBusyAction(false);
        }
    };

    const doSplit = async (mainId: number) => {
        setBusyAction(true);
        try {
            await unmergeTables(mainId);
            toast({ title: "Tables split" });
            await load();
        } catch (e: any) {
            toast({ title: "Couldn't split", description: e.message, variant: "destructive" });
        } finally {
            setBusyAction(false);
        }
    };

    if (error) {
        return <div className="py-10 text-center text-sm text-destructive">{error} <button onClick={load} className="ml-2 underline">Retry</button></div>;
    }
    if (!layout) {
        return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    const placed = shown.tables.filter((t) => t.areaKey === areaKey);
    const counts = layout.tables.reduce((c, t) => { c[tones(t)] = (c[tones(t)] || 0) + 1; return c; }, {} as Record<string, number>);
    const hasPlan = layout.tables.some((t) => t.areaKey);
    const mode = hasPlan ? view : "cards";
    const groups = layout.tables.filter((t) => !t.joined_to && joinedTo(t.id!).length > 0);

    /** What a table shows: name, then bill / group / seats. */
    const tableBody = (t: FloorTable, big = false) => {
        const main = mainOf(t);
        const order = openByTable.get(main.id!);
        const joined = joinedTo(t.id!);
        return (
            <>
                <span className={cn("font-bold", big ? "text-base" : "text-sm")}>{t.name}</span>
                {merging && mergeSel[0] === t.id && <span className="text-[10px] font-semibold uppercase">Main</span>}
                {t.joined_to ? (
                    <span className="flex items-center gap-0.5 text-[10px] opacity-80"><Link2 className="h-2.5 w-2.5" /> {main.name}</span>
                ) : order ? (
                    <>
                        <span className="text-[11px] font-semibold tabular-nums">{Number(order.grand_total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-[10px] opacity-75">{minutes(order.created_at)}{order.steward_name ? ` · ${String(order.steward_name).split(" ")[0]}` : ""}</span>
                    </>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] opacity-70">
                        {t.status === "Reserved" ? "Reserved" : t.status === "Out of Service" ? "Out of service" : <><Users className="h-2.5 w-2.5" /> {t.seats}</>}
                    </span>
                )}
                {joined.length > 0 && <span className="text-[10px] font-semibold">+{joined.length} table{joined.length > 1 ? "s" : ""}</span>}
            </>
        );
    };

    const CARD_TONE: Record<string, string> = {
        free: "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10", busy: "border-rose-400 bg-rose-50 dark:bg-rose-500/10",
        reserved: "border-sky-400 bg-sky-50 dark:bg-sky-500/10", off: "border-slate-300 bg-slate-100 opacity-60 dark:bg-slate-800",
        bill: "border-amber-400 bg-amber-50 dark:bg-amber-500/10", selected: "border-primary bg-primary/10 ring-2 ring-primary",
    };
    const cardGroups: { name: string; tables: FloorTable[] }[] = [
        ...layout.areas.map((a) => ({ name: a.name, tables: layout.tables.filter((t) => t.areaKey === a.key) })),
        { name: layout.areas.length ? "Other tables" : "Tables", tables: layout.tables.filter((t) => !t.areaKey) },
    ].filter((g) => g.tables.length);

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <style>{FLOOR_3D_CSS}</style>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {hasPlan && (
                        <div className="mr-1 flex rounded-md border p-0.5">
                            <button onClick={() => setView("plan")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs", mode === "plan" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                                <MapIcon className="h-3.5 w-3.5" /> Floor plan
                            </button>
                            <button onClick={() => setView("cards")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs", mode === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                                <LayoutGrid className="h-3.5 w-3.5" /> Cards
                            </button>
                        </div>
                    )}
                    {hasPlan && mode === "plan" && (
                        <div className="mr-1 flex rounded-md border p-0.5 text-xs">
                            <button onClick={() => setLook("3d")} className={cn("rounded px-2 py-1", look === "3d" ? "bg-foreground text-background" : "hover:bg-muted")}>3D</button>
                            <button onClick={() => setLook("flat")} className={cn("rounded px-2 py-1", look === "flat" ? "bg-foreground text-background" : "hover:bg-muted")}>Flat</button>
                        </div>
                    )}
                    {mode === "plan" && layout.areas.map((a) => (
                        <button key={a.key} onClick={() => setAreaKey(a.key)}
                            className={cn("rounded-md border px-3 py-1.5 text-sm", a.key === areaKey ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}>
                            {a.name}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Free {counts.free || 0}</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Open bill {counts.busy || 0}</span>
                    <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Reserved {counts.reserved || 0}</span>
                    <button onClick={() => { setMerging(!merging); setMergeSel([]); }}
                        className={cn("flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium", merging ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                        <Combine className="h-3.5 w-3.5" /> Merge tables
                    </button>
                    <button onClick={() => { void load(); onRefresh?.(); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Refresh">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Merge bar / merged groups */}
            {merging ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                    <Combine className="h-4 w-4 text-primary" />
                    <span className="mr-auto">
                        {mergeSel.length === 0 ? "Tap the main table for the group, then the tables to join to it."
                            : `${byId.get(mergeSel[0])?.name} (main)${mergeSel.length > 1 ? " + " + mergeSel.slice(1).map((id) => byId.get(id)?.name).join(", ") : " — now tap the tables to join"}`}
                    </span>
                    <span className="text-xs text-muted-foreground">Open bills on joined tables move onto the main bill.</span>
                    <button onClick={() => { setMerging(false); setMergeSel([]); }} className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
                    <button onClick={doMerge} disabled={mergeSel.length < 2 || busyAction}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                        {busyAction ? "Merging…" : `Merge ${mergeSel.length || ""} tables`}
                    </button>
                </div>
            ) : groups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Merged:</span>
                    {groups.map((g) => (
                        <span key={g.id} className="flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1">
                            <Link2 className="h-3 w-3 text-amber-600" /> {g.name} + {joinedTo(g.id!).map((t) => t.name).join(", ")}
                            <button onClick={() => doSplit(g.id!)} disabled={busyAction} title="Split this group" className="ml-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                                <Split className="h-3 w-3" /> Split
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {mode === "cards" && (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    {cardGroups.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No tables yet. Add them in Admin → Locations → Floor plan, or Master Data → Tables.</p>}
                    {cardGroups.map((g) => (
                        <div key={g.name}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                                {g.tables.map((t) => {
                                    const tone = tones(t);
                                    return (
                                        <button key={t.key} onClick={() => pick(t)} disabled={tone === "off" && !merging}
                                            className={cn("flex min-h-[88px] flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition hover:shadow-md", CARD_TONE[tone])}>
                                            {tableBody(t, true)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div ref={wrap}
                className={cn("floor3d relative min-h-[360px] flex-1 overflow-hidden rounded-lg border", look === "flat" && "bg-muted/30", mode !== "plan" && "hidden")}
                style={look === "3d" ? { perspective: "1500px", perspectiveOrigin: "50% 20%", background: "var(--f3-sky)", ["--f3-tilt" as any]: `${TILT}deg` } : undefined}>
                {area && bounds && (
                    <div className="absolute left-1/2 top-1/2" style={{
                        width: bounds.w * scale, height: bounds.h * scale,
                        transform: look === "3d" ? `translate(-50%, -46%) rotateX(${TILT}deg)` : "translate(-50%, -50%)",
                        transformOrigin: "50% 50%",
                        transformStyle: "preserve-3d",
                    }}>
                        <div className={cn("relative origin-top-left", look === "3d" ? "rounded-2xl" : "overflow-hidden rounded-md border bg-white dark:bg-slate-950")}
                            style={{
                                width: bounds.w, height: bounds.h, transform: `scale(${scale})`, transformStyle: "preserve-3d",
                                ...(look === "3d"
                                    ? { ...WOOD_FLOOR_BG, boxShadow: "0 40px 80px rgba(0,0,0,.45), inset 0 0 0 8px var(--f3-rim), inset 0 0 60px rgba(0,0,0,.25)" }
                                    : GRID_BG),
                            }}>
                            <div className="absolute" style={{ left: -bounds.x, top: -bounds.y, width: area.width, height: area.height, transformStyle: "preserve-3d" }}>
                                {layout.objects.filter((o) => o.areaKey === areaKey).map((o) => <FloorObjectShape key={o.key} obj={o} look={look} />)}
                                {/* merged groups: one shared outline around the tables pushed together */}
                                {shown.groupBoxes.filter((g) => g.areaKey === areaKey).map((g) => (
                                    <div key={`g${g.mainId}`} className="pointer-events-none absolute rounded-2xl border-[3px] border-dashed border-amber-500/80"
                                        style={{ left: g.x - 22, top: g.y - 26, width: g.w + 44, height: g.h + 52, background: "rgba(245,158,11,.10)" }}>
                                        <span className="absolute -top-3 left-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                                            <Link2 className="h-3 w-3" /> Merged
                                        </span>
                                    </div>
                                ))}
                                {placed.map((t) => {
                                    const tone = tones(t);
                                    const hasBill = !t.joined_to && openByTable.has(t.id!);
                                    return (
                                        <FloorTableShape key={t.key} table={t} tone={tone} look={look} flag={hasBill && !merging}
                                            className={cn(tone === "off" && !merging ? "cursor-not-allowed opacity-70" : "cursor-pointer")}
                                            onClick={() => pick(t)}
                                            title={t.name}>
                                            {tableBody(t)}
                                        </FloorTableShape>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {merging && mode === "plan" && (
                    <button onClick={() => { setMerging(false); setMergeSel([]); }} className="absolute right-3 top-3 rounded-full bg-card p-1.5 shadow" aria-label="Stop merging">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {!merging && (
                <button onClick={onSkip} className="flex items-center justify-center gap-2 rounded-md border border-dashed py-2 text-sm text-muted-foreground hover:border-emerald-500 hover:text-foreground">
                    <LayoutGrid className="h-4 w-4" /> No table
                </button>
            )}
        </div>
    );
}

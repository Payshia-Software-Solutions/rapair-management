"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    ArrowLeft, Circle, Copy, DoorOpen, Flower2, Loader2, Minus, Plus, RectangleHorizontal, RotateCw, Save,
    Square, Trash2, Type, Undo2, Utensils, Waves, Wine, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchLocation } from "@/lib/api";
import {
    fetchFloorLayout, saveFloorLayout, type FloorArea, type FloorObject, type FloorObjectKind, type FloorTable, type TableShape,
} from "@/lib/api/floor";
import { FloorObjectShape, FloorTableShape, GRID_BG, OBJECT_LABELS } from "@/components/floor/floor-shapes";
import { cn } from "@/lib/utils";

const SNAP = 10;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const newKey = (p: string) => p + Math.random().toString(36).slice(2, 9);

type Sel = { kind: "table" | "object"; key: string } | null;
interface Plan { areas: FloorArea[]; tables: FloorTable[]; objects: FloorObject[] }
type Drag = { mode: "move" | "resize"; kind: "table" | "object"; key: string; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number } };

const TABLE_PRESETS: { shape: TableShape; label: string; icon: any; w: number; h: number; seats: number }[] = [
    { shape: "square", label: "Square", icon: Square, w: 80, h: 80, seats: 4 },
    { shape: "round", label: "Round", icon: Circle, w: 90, h: 90, seats: 4 },
    { shape: "rect", label: "Long", icon: RectangleHorizontal, w: 160, h: 80, seats: 6 },
];
const OBJECT_PRESETS: { kind: FloorObjectKind; icon: any; w: number; h: number }[] = [
    { kind: "wall", icon: Minus, w: 200, h: 10 },
    { kind: "bar", icon: Wine, w: 240, h: 50 },
    { kind: "kitchen", icon: Utensils, w: 200, h: 120 },
    { kind: "door", icon: DoorOpen, w: 80, h: 20 },
    { kind: "plant", icon: Flower2, w: 30, h: 30 },
    { kind: "label", icon: Type, w: 140, h: 30 },
    { kind: "pool", icon: Waves, w: 360, h: 200 },
];

export default function FloorPlanDesignerPage() {
    const { id } = useParams() as { id: string };
    const { toast } = useToast();
    const [locationName, setLocationName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [plan, setPlan] = useState<Plan>({ areas: [], tables: [], objects: [] });
    const [history, setHistory] = useState<Plan[]>([]);
    const [dirty, setDirty] = useState(false);
    const [activeArea, setActiveArea] = useState<string>("");
    const [sel, setSel] = useState<Sel>(null);
    const [zoom, setZoom] = useState(0.8);
    const [deletedTables, setDeletedTables] = useState<number[]>([]);
    const [deletedAreas, setDeletedAreas] = useState<number[]>([]);
    const dragRef = useRef<Drag | null>(null);
    const canvasWrap = useRef<HTMLDivElement>(null);

    // ---------- load ----------
    useEffect(() => {
        void (async () => {
            try {
                const [loc, layout] = await Promise.all([fetchLocation(id), fetchFloorLayout(id)]);
                setLocationName(loc?.name || "");
                let areas = layout.areas;
                if (!areas.length) areas = [{ key: newKey("a"), name: "Main floor", width: 1200, height: 800 }];
                setPlan({ areas, tables: layout.tables, objects: layout.objects });
                setActiveArea(areas[0].key);
            } catch (e: any) {
                toast({ title: "Couldn't load the floor plan", description: e.message, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, toast]);

    // Fit the area to the screen width once loaded / when switching areas
    const area = plan.areas.find((a) => a.key === activeArea);
    useEffect(() => {
        if (!area || !canvasWrap.current) return;
        const w = canvasWrap.current.clientWidth - 32;
        setZoom(Math.max(0.3, Math.min(1, Math.round((w / area.width) * 20) / 20)));
    }, [activeArea, loading]); // eslint-disable-line react-hooks/exhaustive-deps

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
        window.addEventListener("beforeunload", h);
        return () => window.removeEventListener("beforeunload", h);
    }, [dirty]);

    // ---------- edit helpers ----------
    const commit = useCallback((next: Plan | ((p: Plan) => Plan)) => {
        setPlan((prev) => {
            const value = typeof next === "function" ? next(prev) : next;
            setHistory((h) => [...h.slice(-49), prev]);
            return value;
        });
        setDirty(true);
    }, []);

    const undo = () => {
        setHistory((h) => {
            if (!h.length) return h;
            setPlan(h[h.length - 1]);
            setDirty(true);
            return h.slice(0, -1);
        });
    };

    const areaTables = plan.tables.filter((t) => t.areaKey === activeArea);
    const unplaced = plan.tables.filter((t) => !t.areaKey);
    const areaObjects = plan.objects.filter((o) => o.areaKey === activeArea);
    const selTable = sel?.kind === "table" ? plan.tables.find((t) => t.key === sel.key) : undefined;
    const selObject = sel?.kind === "object" ? plan.objects.find((o) => o.key === sel.key) : undefined;

    const nextTableName = () => {
        const used = new Set(plan.tables.map((t) => t.name.trim().toLowerCase()));
        for (let i = 1; ; i++) if (!used.has(`t${i}`)) return `T${i}`;
    };

    /** A free spot near the top-left that doesn't sit on another table. */
    const freeSpot = (w: number, h: number) => {
        if (!area) return { x: 40, y: 40 };
        for (let y = 40; y < area.height - h; y += 40) {
            for (let x = 40; x < area.width - w; x += 40) {
                const hit = areaTables.some((t) => x < t.pos_x + t.width + 30 && x + w + 30 > t.pos_x && y < t.pos_y + t.height + 30 && y + h + 30 > t.pos_y);
                if (!hit) return { x, y };
            }
        }
        return { x: 40, y: 40 };
    };

    const addTable = (preset: typeof TABLE_PRESETS[number]) => {
        const spot = freeSpot(preset.w, preset.h);
        const t: FloorTable = {
            key: newKey("t"), name: nextTableName(), areaKey: activeArea, pos_x: spot.x, pos_y: spot.y,
            width: preset.w, height: preset.h, rotation: 0, shape: preset.shape, seats: preset.seats,
        };
        commit((p) => ({ ...p, tables: [...p.tables, t] }));
        setSel({ kind: "table", key: t.key });
    };

    const placeTable = (key: string) => {
        const spot = freeSpot(90, 90);
        commit((p) => ({ ...p, tables: p.tables.map((t) => (t.key === key ? { ...t, areaKey: activeArea, pos_x: spot.x, pos_y: spot.y } : t)) }));
        setSel({ kind: "table", key });
    };

    const addObject = (preset: typeof OBJECT_PRESETS[number]) => {
        const o: FloorObject = { key: newKey("o"), areaKey: activeArea, kind: preset.kind, label: null, pos_x: 40, pos_y: 40, width: preset.w, height: preset.h, rotation: 0 };
        commit((p) => ({ ...p, objects: [...p.objects, o] }));
        setSel({ kind: "object", key: o.key });
    };

    const updateTable = (key: string, patch: Partial<FloorTable>) =>
        commit((p) => ({ ...p, tables: p.tables.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
    const updateObject = (key: string, patch: Partial<FloorObject>) =>
        commit((p) => ({ ...p, objects: p.objects.map((o) => (o.key === key ? { ...o, ...patch } : o)) }));

    const removeSelected = useCallback(() => {
        if (!sel) return;
        if (sel.kind === "table") {
            const t = plan.tables.find((x) => x.key === sel.key);
            if (t?.id) setDeletedTables((d) => [...d, t.id!]);
            commit((p) => ({ ...p, tables: p.tables.filter((x) => x.key !== sel.key) }));
        } else {
            commit((p) => ({ ...p, objects: p.objects.filter((x) => x.key !== sel.key) }));
        }
        setSel(null);
    }, [sel, plan.tables, commit]);

    const duplicateSelected = () => {
        if (selTable) {
            const t = { ...selTable, id: undefined, key: newKey("t"), name: nextTableName(), pos_x: selTable.pos_x + 30, pos_y: selTable.pos_y + 30 };
            commit((p) => ({ ...p, tables: [...p.tables, t] }));
            setSel({ kind: "table", key: t.key });
        } else if (selObject) {
            const o = { ...selObject, id: undefined, key: newKey("o"), pos_x: selObject.pos_x + 30, pos_y: selObject.pos_y + 30 };
            commit((p) => ({ ...p, objects: [...p.objects, o] }));
            setSel({ kind: "object", key: o.key });
        }
    };

    const rotateSelected = () => {
        if (selTable) updateTable(selTable.key, { rotation: (selTable.rotation + 45) % 360 });
        if (selObject) updateObject(selObject.key, { rotation: (selObject.rotation + 45) % 360 });
    };

    // ---------- areas ----------
    const addArea = () => {
        const a: FloorArea = { key: newKey("a"), name: `Area ${plan.areas.length + 1}`, width: 1200, height: 800 };
        commit((p) => ({ ...p, areas: [...p.areas, a] }));
        setActiveArea(a.key);
        setSel(null);
    };
    const removeArea = (a: FloorArea) => {
        if (plan.areas.length <= 1) { toast({ title: "Keep at least one area" }); return; }
        if (!confirm(`Remove "${a.name}"? Its tables go back to "Not placed"; walls and other drawings on it are removed.`)) return;
        if (a.id) setDeletedAreas((d) => [...d, a.id!]);
        commit((p) => ({
            areas: p.areas.filter((x) => x.key !== a.key),
            tables: p.tables.map((t) => (t.areaKey === a.key ? { ...t, areaKey: null } : t)),
            objects: p.objects.filter((o) => o.areaKey !== a.key),
        }));
        const rest = plan.areas.filter((x) => x.key !== a.key);
        setActiveArea(rest[0]?.key || "");
        setSel(null);
    };
    const updateArea = (patch: Partial<FloorArea>) =>
        commit((p) => ({ ...p, areas: p.areas.map((a) => (a.key === activeArea ? { ...a, ...patch } : a)) }));

    // ---------- dragging ----------
    const startDrag = (e: React.PointerEvent, kind: "table" | "object", key: string, mode: "move" | "resize") => {
        e.stopPropagation();
        e.preventDefault();
        const item = kind === "table" ? plan.tables.find((t) => t.key === key) : plan.objects.find((o) => o.key === key);
        if (!item) return;
        setSel({ kind, key });
        // One undo step for the whole drag
        setHistory((h) => [...h.slice(-49), plan]);
        dragRef.current = { mode, kind, key, startX: e.clientX, startY: e.clientY, orig: { x: item.pos_x, y: item.pos_y, w: item.width, h: item.height } };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d || !area) return;
        const dx = (e.clientX - d.startX) / zoom, dy = (e.clientY - d.startY) / zoom;
        let patch: any;
        if (d.mode === "move") {
            patch = {
                pos_x: Math.max(0, Math.min(area.width - d.orig.w, snap(d.orig.x + dx))),
                pos_y: Math.max(0, Math.min(area.height - d.orig.h, snap(d.orig.y + dy))),
            };
        } else {
            const min = d.kind === "table" ? 40 : 8;
            patch = { width: Math.max(min, snap(d.orig.w + dx)), height: Math.max(min, snap(d.orig.h + dy)) };
            if (d.kind === "table") {
                const t = plan.tables.find((x) => x.key === d.key);
                if (t?.shape === "round") patch.height = patch.width; // circles stay circles
            }
        }
        setPlan((p) => d.kind === "table"
            ? { ...p, tables: p.tables.map((t) => (t.key === d.key ? { ...t, ...patch } : t)) }
            : { ...p, objects: p.objects.map((o) => (o.key === d.key ? { ...o, ...patch } : o)) });
        setDirty(true);
    };
    const endDrag = () => { dragRef.current = null; };

    // ---------- keyboard ----------
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
            if (!sel) return;
            if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
            if (e.key === "Escape") { setSel(null); return; }
            const step = e.shiftKey ? 50 : SNAP;
            const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            const m = mv[e.key];
            if (!m) return;
            e.preventDefault();
            if (sel.kind === "table") {
                const t = plan.tables.find((x) => x.key === sel.key);
                if (t) updateTable(t.key, { pos_x: Math.max(0, t.pos_x + m[0]), pos_y: Math.max(0, t.pos_y + m[1]) });
            } else {
                const o = plan.objects.find((x) => x.key === sel.key);
                if (o) updateObject(o.key, { pos_x: Math.max(0, o.pos_x + m[0]), pos_y: Math.max(0, o.pos_y + m[1]) });
            }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    });

    // ---------- save ----------
    const save = async () => {
        const names = new Map<string, number>();
        for (const t of plan.tables) {
            const n = t.name.trim().toLowerCase();
            if (!n) { toast({ title: "Every table needs a name", variant: "destructive" }); return; }
            names.set(n, (names.get(n) || 0) + 1);
        }
        const dup = [...names.entries()].find(([, c]) => c > 1);
        if (dup) { toast({ title: "Two tables have the same name", description: `"${dup[0].toUpperCase()}" is used twice.`, variant: "destructive" }); return; }

        setSaving(true);
        try {
            await saveFloorLayout({
                location_id: Number(id),
                areas: plan.areas.map((a) => ({
                    id: a.id, name: a.name, width: a.width, height: a.height,
                    tables: plan.tables.filter((t) => t.areaKey === a.key).map((t) => ({
                        id: t.id, name: t.name.trim(), pos_x: t.pos_x, pos_y: t.pos_y, width: t.width, height: t.height, rotation: t.rotation, shape: t.shape, seats: t.seats,
                    })),
                    objects: plan.objects.filter((o) => o.areaKey === a.key).map((o) => ({
                        kind: o.kind, label: o.label, pos_x: o.pos_x, pos_y: o.pos_y, width: o.width, height: o.height, rotation: o.rotation,
                    })),
                })),
                deleted_area_ids: deletedAreas,
                // A table removed and then brought back with Undo is kept
                deleted_table_ids: deletedTables.filter((tid) => !plan.tables.some((t) => t.id === tid)),
            });
            // Reload so new rows get their ids
            const layout = await fetchFloorLayout(id);
            const keepIndex = Math.max(0, plan.areas.findIndex((a) => a.key === activeArea));
            setPlan({ areas: layout.areas, tables: layout.tables, objects: layout.objects });
            setActiveArea(layout.areas[keepIndex]?.key || layout.areas[0]?.key || "");
            setHistory([]);
            setDeletedAreas([]);
            setDeletedTables([]);
            setSel(null);
            setDirty(false);
            toast({ title: "Floor plan saved", description: "The POS shows the new layout next time a table is chosen." });
        } catch (e: any) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const totalSeats = useMemo(() => areaTables.reduce((s, t) => s + (t.seats || 0), 0), [areaTables]);

    if (loading) {
        return (
            <DashboardLayout title="Floor plan">
                <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Floor plan">
            <div className="flex flex-col gap-4 py-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost" size="icon" className="rounded-full">
                            <Link href={`/admin/locations/${id}`} aria-label="Back to location"><ArrowLeft className="h-5 w-5" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Floor plan</h1>
                            <p className="text-sm text-muted-foreground">{locationName} · drag tables where they stand in the room. The POS shows this plan for Dine-in.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"><Undo2 className="mr-2 h-4 w-4" /> Undo</Button>
                        <Button onClick={save} disabled={saving || !dirty}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {dirty ? "Save layout" : "Saved"}
                        </Button>
                    </div>
                </div>

                {/* Area tabs */}
                <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
                    {plan.areas.map((a) => (
                        <div key={a.key} className={cn("group flex items-center rounded-md border text-sm", a.key === activeArea ? "border-primary bg-primary/5 font-semibold" : "bg-card hover:bg-muted")}>
                            <button onClick={() => { setActiveArea(a.key); setSel(null); }} className="px-3 py-1.5">{a.name}</button>
                            {plan.areas.length > 1 && (
                                <button onClick={() => removeArea(a)} aria-label={`Remove ${a.name}`} className="pr-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addArea}><Plus className="mr-1 h-4 w-4" /> Add area</Button>
                </div>

                <div className="flex min-h-[600px] gap-4">
                    {/* Left tools */}
                    <aside className="w-56 shrink-0 space-y-5">
                        <section>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add table</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {TABLE_PRESETS.map((p) => (
                                    <button key={p.shape} onClick={() => addTable(p)} className="flex flex-col items-center gap-1 rounded-md border bg-card p-2 text-xs hover:border-primary hover:bg-primary/5">
                                        <p.icon className="h-5 w-5" /> {p.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                        <section>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add to the room</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {OBJECT_PRESETS.map((p) => (
                                    <button key={p.kind} onClick={() => addObject(p)} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs hover:border-primary hover:bg-primary/5">
                                        <p.icon className="h-4 w-4" /> {OBJECT_LABELS[p.kind]}
                                    </button>
                                ))}
                            </div>
                        </section>
                        {unplaced.length > 0 && (
                            <section>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not placed ({unplaced.length})</p>
                                <p className="mb-2 text-xs text-muted-foreground">Tables you made before. Click one to put it on this area.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {unplaced.map((t) => (
                                        <button key={t.key} onClick={() => placeTable(t.key)} className="rounded-md border border-dashed bg-card px-2.5 py-1 text-xs font-medium hover:border-primary">
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        <section className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                            <p><b className="text-foreground">{areaTables.length}</b> tables · <b className="text-foreground">{totalSeats}</b> seats on this area</p>
                            <p className="mt-2">Drag to move · corner handle to resize · arrow keys nudge (Shift = more) · Delete removes</p>
                        </section>
                    </aside>

                    {/* Canvas */}
                    <div className="relative min-w-0 flex-1 rounded-lg border bg-muted/30">
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
                            <button onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} className="rounded p-1 hover:bg-muted" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
                            <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} className="rounded p-1 hover:bg-muted" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
                        </div>
                        <div ref={canvasWrap} className="h-[calc(100vh-260px)] min-h-[560px] overflow-auto p-4">
                            {area && (
                                <div style={{ width: area.width * zoom, height: area.height * zoom }}>
                                    <div
                                        className="relative origin-top-left rounded-md border-2 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
                                        style={{ width: area.width, height: area.height, transform: `scale(${zoom})`, ...GRID_BG }}
                                        onPointerMove={onPointerMove}
                                        onPointerUp={endDrag}
                                        onPointerLeave={endDrag}
                                        onPointerDown={() => setSel(null)}
                                    >
                                        {areaObjects.map((o) => {
                                            const on = sel?.kind === "object" && sel.key === o.key;
                                            return (
                                                <FloorObjectShape key={o.key} obj={o}
                                                    className={cn("cursor-move", on && "ring-2 ring-primary ring-offset-2")}
                                                    onPointerDown={(e) => startDrag(e, "object", o.key, "move")}>
                                                </FloorObjectShape>
                                            );
                                        })}
                                        {areaObjects.filter((o) => sel?.kind === "object" && sel.key === o.key).map((o) => (
                                            <span key={`h${o.key}`} onPointerDown={(e) => startDrag(e, "object", o.key, "resize")}
                                                className="absolute z-20 h-3 w-3 cursor-nwse-resize rounded-sm border-2 border-primary bg-white"
                                                style={{ left: o.pos_x + o.width - 6, top: o.pos_y + o.height - 6 }} />
                                        ))}
                                        {areaTables.map((t) => {
                                            const on = sel?.kind === "table" && sel.key === t.key;
                                            return (
                                                <FloorTableShape key={t.key} table={t} tone={on ? "selected" : "neutral"}
                                                    className={cn("cursor-move", on && "z-10")}
                                                    onPointerDown={(e) => startDrag(e, "table", t.key, "move")}>
                                                    <span className="text-sm font-bold">{t.name}</span>
                                                    <span className="text-[10px] opacity-70">{t.seats} seats</span>
                                                </FloorTableShape>
                                            );
                                        })}
                                        {selTable && selTable.areaKey === activeArea && (
                                            <span onPointerDown={(e) => startDrag(e, "table", selTable.key, "resize")}
                                                className="absolute z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-primary bg-white"
                                                style={{ left: selTable.pos_x + selTable.width - 7, top: selTable.pos_y + selTable.height - 7 }} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: properties */}
                    <aside className="w-60 shrink-0">
                        <div className="sticky top-4 space-y-4 rounded-lg border bg-card p-4">
                            {selTable ? (
                                <>
                                    <p className="text-sm font-semibold">Table</p>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="t-name">Name</Label>
                                        <Input id="t-name" value={selTable.name} maxLength={50} onChange={(e) => updateTable(selTable.key, { name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Seats</Label>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="outline" onClick={() => updateTable(selTable.key, { seats: Math.max(1, selTable.seats - 1) })}><Minus className="h-4 w-4" /></Button>
                                            <span className="w-8 text-center font-semibold tabular-nums">{selTable.seats}</span>
                                            <Button size="icon" variant="outline" onClick={() => updateTable(selTable.key, { seats: Math.min(24, selTable.seats + 1) })}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Shape</Label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {TABLE_PRESETS.map((p) => (
                                                <button key={p.shape} onClick={() => updateTable(selTable.key, {
                                                    shape: p.shape,
                                                    ...(p.shape === "round" ? { height: selTable.width } : p.shape === "rect" && selTable.width === selTable.height ? { width: selTable.width * 2 } : {}),
                                                })}
                                                    className={cn("flex flex-col items-center rounded-md border p-1.5 text-[11px]", selTable.shape === p.shape ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                                                    <p.icon className="h-4 w-4" /> {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : selObject ? (
                                <>
                                    <p className="text-sm font-semibold">{OBJECT_LABELS[selObject.kind]}</p>
                                    {selObject.kind !== "wall" && selObject.kind !== "plant" && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="o-label">Text</Label>
                                            <Input id="o-label" value={selObject.label || ""} maxLength={60} placeholder={OBJECT_LABELS[selObject.kind]}
                                                onChange={(e) => updateObject(selObject.key, { label: e.target.value })} />
                                        </div>
                                    )}
                                </>
                            ) : area ? (
                                <>
                                    <p className="text-sm font-semibold">Area</p>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="a-name">Name</Label>
                                        <Input id="a-name" value={area.name} maxLength={60} onChange={(e) => updateArea({ name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="a-w">Width</Label>
                                            <Input id="a-w" type="number" min={400} max={4000} step={100} value={area.width}
                                                onChange={(e) => updateArea({ width: Math.max(400, Math.min(4000, Number(e.target.value) || 400)) })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="a-h">Height</Label>
                                            <Input id="a-h" type="number" min={300} max={4000} step={100} value={area.height}
                                                onChange={(e) => updateArea({ height: Math.max(300, Math.min(4000, Number(e.target.value) || 300)) })} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Click a table or drawing to change it.</p>
                                </>
                            ) : null}

                            {(selTable || selObject) && (
                                <div className="grid grid-cols-3 gap-1.5 border-t pt-3">
                                    <Button variant="outline" size="sm" onClick={rotateSelected} title="Rotate 45°"><RotateCw className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={duplicateSelected} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={removeSelected} title="Remove" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </DashboardLayout>
    );
}

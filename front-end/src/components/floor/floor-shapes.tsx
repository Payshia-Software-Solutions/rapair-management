"use client";

import React from "react";
import type { FloorObject, FloorTable } from "@/lib/api/floor";
import { cn } from "@/lib/utils";

/**
 * Drawing pieces shared by the floor plan designer and the POS floor view.
 * Positions are in canvas pixels; the parent scales the whole canvas.
 */

/** Where each chair sits around a table, as offsets from the table's top-left corner. */
function chairSpots(t: Pick<FloorTable, "shape" | "width" | "height" | "seats">) {
    const seats = Math.max(0, Math.min(t.seats, 24));
    const out: { x: number; y: number }[] = [];
    if (t.shape === "round") {
        const rx = t.width / 2 + 10, ry = t.height / 2 + 10;
        for (let i = 0; i < seats; i++) {
            const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
            out.push({ x: t.width / 2 + Math.cos(a) * rx, y: t.height / 2 + Math.sin(a) * ry });
        }
        return out;
    }
    // Square / long tables: chairs along the long sides first, then the ends
    const long = t.width >= t.height;
    const ends = seats > 4 && t.shape === "square" ? 2 : seats >= 6 ? 2 : 0;
    const sides = seats - ends;
    const a = Math.ceil(sides / 2), b = sides - a;
    const place = (count: number, side: "top" | "bottom" | "left" | "right") => {
        for (let i = 0; i < count; i++) {
            const f = (i + 1) / (count + 1);
            if (side === "top") out.push({ x: t.width * f, y: -10 });
            if (side === "bottom") out.push({ x: t.width * f, y: t.height + 10 });
            if (side === "left") out.push({ x: -10, y: t.height * f });
            if (side === "right") out.push({ x: t.width + 10, y: t.height * f });
        }
    };
    if (long) { place(a, "top"); place(b, "bottom"); if (ends) { place(1, "left"); place(1, "right"); } }
    else { place(a, "left"); place(b, "right"); if (ends) { place(1, "top"); place(1, "bottom"); } }
    return out;
}

export type TableTone = "neutral" | "free" | "busy" | "bill" | "reserved" | "off" | "selected";

const TONES: Record<TableTone, string> = {
    neutral: "bg-white border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100",
    free: "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100",
    busy: "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100",
    bill: "bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100",
    reserved: "bg-sky-50 border-sky-500 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100",
    off: "bg-slate-200 border-slate-400 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
    selected: "bg-primary/10 border-primary text-foreground",
};
const CHAIR_TONES: Record<TableTone, string> = {
    neutral: "bg-slate-300 dark:bg-slate-600", free: "bg-emerald-300", busy: "bg-rose-300", bill: "bg-amber-300",
    reserved: "bg-sky-300", off: "bg-slate-300", selected: "bg-primary/40",
};

/** 3D look: top surface colours and the darker edge that gives the table its thickness. */
const TONES_3D: Record<TableTone, { top: string; edge: string; text: string; chair: string; chairEdge: string }> = {
    neutral:  { top: "linear-gradient(145deg,#ffffff,#e2e8f0)", edge: "#94a3b8", text: "#1e293b", chair: "linear-gradient(145deg,#f1f5f9,#cbd5e1)", chairEdge: "#94a3b8" },
    free:     { top: "linear-gradient(145deg,#d1fae5,#6ee7b7)", edge: "#059669", text: "#064e3b", chair: "linear-gradient(145deg,#a7f3d0,#34d399)", chairEdge: "#047857" },
    busy:     { top: "linear-gradient(145deg,#ffe4e6,#fda4af)", edge: "#e11d48", text: "#881337", chair: "linear-gradient(145deg,#fecdd3,#fb7185)", chairEdge: "#be123c" },
    bill:     { top: "linear-gradient(145deg,#fef3c7,#fcd34d)", edge: "#d97706", text: "#78350f", chair: "linear-gradient(145deg,#fde68a,#fbbf24)", chairEdge: "#b45309" },
    reserved: { top: "linear-gradient(145deg,#e0f2fe,#7dd3fc)", edge: "#0284c7", text: "#0c4a6e", chair: "linear-gradient(145deg,#bae6fd,#38bdf8)", chairEdge: "#0369a1" },
    off:      { top: "linear-gradient(145deg,#e2e8f0,#94a3b8)", edge: "#475569", text: "#334155", chair: "linear-gradient(145deg,#cbd5e1,#94a3b8)", chairEdge: "#475569" },
    selected: { top: "linear-gradient(145deg,#e0e7ff,#a5b4fc)", edge: "#4f46e5", text: "#312e81", chair: "linear-gradient(145deg,#c7d2fe,#818cf8)", chairEdge: "#4338ca" },
};

export function FloorTableShape({ table, tone = "neutral", look = "flat", flag = true, className, children, ...rest }: {
    table: FloorTable; tone?: TableTone; look?: "flat" | "3d";
    /** 3D: show the details on a standing flag (tables with a bill); otherwise a small label on the table */
    flag?: boolean;
    className?: string; children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
    if (look === "3d") {
        const t3 = TONES_3D[tone];
        const round = table.shape === "round";
        const cx = table.width / 2, cy = table.height / 2;
        return (
            <div
                {...rest}
                className={cn("group absolute select-none", className)}
                style={{ left: table.pos_x, top: table.pos_y, width: table.width, height: table.height, transform: `rotate(${table.rotation}deg)`, transformStyle: "preserve-3d", ...(rest.style || {}) }}
            >
                {/* soft floor shadow under the whole set */}
                <div className={cn("pointer-events-none absolute -inset-4 blur-md", round ? "rounded-full" : "rounded-3xl")}
                    style={{ background: "rgba(40,20,5,.28)", transform: "translate(6px, 14px)" }} />
                {/* invisible hit area: the whole set (table + chairs) is clickable and hoverable */}
                <div aria-hidden="true" className={cn("absolute -inset-[26px]", round ? "rounded-full" : "rounded-3xl")} />
                {/* chairs: cushion in the status colour, wooden back facing away from the table */}
                {chairSpots(table).map((c, i) => {
                    const ang = (Math.atan2(c.y - cy, c.x - cx) * 180) / Math.PI - 90;
                    return (
                        <div key={i} className="pointer-events-none absolute h-[24px] w-[22px] -translate-x-1/2 -translate-y-1/2"
                            style={{ left: c.x, top: c.y, transform: `translate(-50%,-50%) rotate(${ang}deg)` }}>
                            <span className="absolute left-0 top-0 h-[17px] w-[22px] rounded-[7px]"
                                style={{ background: t3.chair, boxShadow: `0 3px 0 ${t3.chairEdge}, 0 6px 8px rgba(0,0,0,.25)` }} />
                            <span className="absolute bottom-0 left-[-1px] h-[7px] w-[24px] rounded-[4px]"
                                style={{ background: "linear-gradient(180deg,#8b5a2b,#5b3716)", boxShadow: "0 3px 0 #3f240c, 0 5px 6px rgba(0,0,0,.3)" }} />
                        </div>
                    );
                })}
                {/* wooden table top with a status-coloured cloth */}
                <div className={cn("absolute inset-0 transition-transform duration-200 group-hover:-translate-y-1", round ? "rounded-full" : "rounded-xl")}
                    style={{
                        transformStyle: "preserve-3d",
                        background: "var(--f3-tabletop)",
                        boxShadow: `inset 0 2px 0 rgba(255,255,255,.35), 0 8px 0 #5b3716, 0 18px 22px rgba(0,0,0,.30)${tone === "busy" ? ", 0 0 0 4px rgba(244,63,94,.55), 0 0 26px 6px rgba(244,63,94,.45)" : ""}`,
                    }}>
                    <div className={cn("absolute inset-[6px] overflow-hidden", round ? "rounded-full" : "rounded-lg")}
                        style={{ background: t3.top, boxShadow: "inset 0 1px 6px rgba(0,0,0,.15)" }}>
                        {/* linen weave */}
                        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.35) 0 2px,transparent 2px 6px)" }} />
                    </div>
                    {/* plates in front of each chair */}
                    {chairSpots(table).map((c, i) => {
                        const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy) || 1;
                        const k = Math.min(0.55, 26 / d);
                        return (
                            <span key={i} className="pointer-events-none absolute h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                                style={{ left: c.x + dx * k, top: c.y + dy * k, background: "radial-gradient(circle,#fff 45%,#e5e7eb 48%,#fff 60%)", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
                        );
                    })}
                    {tone === "busy" && <span className="pointer-events-none absolute inset-0 animate-ping rounded-[inherit] border-2 border-rose-400/60" />}
                    {!flag && (
                        <div style={{ transform: `rotate(${-table.rotation}deg)` }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center rounded-md px-1.5 py-0.5 text-center leading-tight" style={{ background: "var(--f3-pill)", color: "var(--f3-pill-text)", opacity: 0.9 }}>
                                {children}
                            </div>
                        </div>
                    )}
                    {/* Table flag: a pole standing at the centre of the table with the details on a flag */}
                    {flag && <div style={{ transform: `rotate(${-table.rotation}deg)`, transformStyle: "preserve-3d" }} className="pointer-events-none absolute inset-0">
                        <div className="absolute left-1/2 top-1/2"
                            style={{ transform: "rotateX(calc(var(--f3-tilt, 0deg) * -1))", transformOrigin: "0 0", transformStyle: "preserve-3d" }}>
                            {/* base and pole */}
                            <span className="absolute -left-[5px] -top-[3px] h-[6px] w-[10px] rounded-full" style={{ background: "#475569", boxShadow: "0 1px 2px rgba(0,0,0,.4)" }} />
                            <span className="absolute -left-[1.5px] bottom-0 h-[64px] w-[3px] rounded-full"
                                style={{ background: "linear-gradient(90deg,#cbd5e1,#64748b)", boxShadow: "1px 0 2px rgba(0,0,0,.3)" }} />
                            <span className="absolute -left-[3.5px] bottom-[62px] h-[7px] w-[7px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%,#fde68a,#b45309)" }} />
                            {/* the flag, hanging from the top of the pole */}
                            <div className="absolute bottom-[24px] left-[1px] flex flex-col whitespace-nowrap py-1 pl-2 pr-3.5 leading-tight shadow-lg"
                                style={{
                                    background: "var(--f3-pill)", color: "var(--f3-pill-text)",
                                    borderLeft: `4px solid ${t3.edge}`,
                                    clipPath: "polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%)",
                                    borderRadius: "0 3px 3px 0",
                                }}>
                                {children}
                            </div>
                        </div>
                    </div>}
                </div>
            </div>
        );
    }
    return (
        <div
            {...rest}
            className={cn("absolute select-none", className)}
            style={{ left: table.pos_x, top: table.pos_y, width: table.width, height: table.height, transform: `rotate(${table.rotation}deg)`, ...(rest.style || {}) }}
        >
            {/* invisible hit area covering the chairs too */}
            <div aria-hidden="true" className={cn("absolute -inset-[20px]", table.shape === "round" ? "rounded-full" : "rounded-2xl")} />
            {chairSpots(table).map((c, i) => (
                <span key={i} className={cn("pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full", CHAIR_TONES[tone])}
                    style={{ left: c.x, top: c.y }} />
            ))}
            <div className={cn("absolute inset-0 flex flex-col items-center justify-center border-2 shadow-sm",
                table.shape === "round" ? "rounded-full" : "rounded-lg", TONES[tone])}>
                <div style={{ transform: `rotate(${-table.rotation}deg)` }} className="flex flex-col items-center px-1 text-center leading-tight">
                    {children}
                </div>
            </div>
        </div>
    );
}

const OBJECT_STYLE: Record<string, string> = {
    wall: "bg-slate-500 dark:bg-slate-400",
    bar: "bg-amber-800/80 text-amber-50 rounded-md",
    door: "bg-transparent border-2 border-dashed border-slate-400 rounded-sm text-slate-500",
    kitchen: "bg-orange-100 border-2 border-orange-300 text-orange-800 rounded-md dark:bg-orange-500/15 dark:text-orange-200",
    plant: "bg-green-500/70 rounded-full",
    label: "bg-transparent text-muted-foreground font-semibold",
    pool: "bg-cyan-300/70 border-4 border-stone-300 rounded-2xl text-cyan-900 font-semibold",
};
export const OBJECT_LABELS: Record<string, string> = {
    wall: "Wall", bar: "Bar counter", door: "Door", kitchen: "Kitchen", plant: "Plant", label: "Text", pool: "Pool",
};

/** 3D look for room objects: walls and counters get height, the plant is round and leafy. */
const OBJECT_3D: Record<string, React.CSSProperties> = {
    wall: { background: "var(--f3-wall)", boxShadow: "0 16px 0 var(--f3-wall-side), 0 17px 0 var(--f3-wall-edge), 0 26px 24px rgba(0,0,0,.35)", borderRadius: 3 },
    pool: {
        background: "radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.55),transparent 40%), repeating-linear-gradient(115deg,rgba(255,255,255,.18) 0 6px,transparent 6px 22px), linear-gradient(160deg,#67e8f9,#0891b2 60%,#155e75)",
        color: "#ecfeff", border: "10px solid #e7e5e4", borderRadius: 26,
        boxShadow: "inset 0 6px 18px rgba(8,51,68,.55), 0 4px 0 #a8a29e, 0 14px 24px rgba(0,0,0,.25)",
        textShadow: "0 1px 2px rgba(8,51,68,.6)", fontSize: 14,
    },
    bar: { background: "repeating-linear-gradient(90deg,#92400e 0 14px,#a16207 14px 28px)", color: "#fff7ed", boxShadow: "inset 0 2px 0 rgba(255,255,255,.25), 0 10px 0 #78350f, 0 18px 22px rgba(0,0,0,.35)", borderRadius: 8 },
    kitchen: { background: "linear-gradient(145deg,#ffedd5,#fdba74)", color: "#7c2d12", boxShadow: "inset 0 2px 0 rgba(255,255,255,.6), 0 8px 0 #c2410c, 0 16px 20px rgba(0,0,0,.3)", borderRadius: 8 },
    door: { background: "linear-gradient(90deg,#d6d3d1,#a8a29e)", color: "#44403c", boxShadow: "0 3px 0 #78716c", borderRadius: 3 },
    plant: { background: "radial-gradient(circle at 35% 30%,#86efac,#16a34a 60%,#14532d)", boxShadow: "0 6px 0 #78350f, 0 12px 14px rgba(0,0,0,.3)", borderRadius: "9999px" },
    label: { background: "transparent", color: "var(--f3-label)", fontWeight: 700 },
};

export function FloorObjectShape({ obj, look = "flat", className, ...rest }: { obj: FloorObject; look?: "flat" | "3d"; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    const text = obj.label || (obj.kind === "wall" || obj.kind === "plant" ? "" : OBJECT_LABELS[obj.kind]);
    if (look === "3d") {
        return (
            <div {...rest} className={cn("absolute flex select-none items-center justify-center overflow-hidden text-xs font-semibold", className)}
                style={{ left: obj.pos_x, top: obj.pos_y, width: obj.width, height: obj.height, transform: `rotate(${obj.rotation}deg)`, ...(OBJECT_3D[obj.kind] || OBJECT_3D.wall), ...(rest.style || {}) }}>
                {text && <span className="truncate px-1">{text}</span>}
            </div>
        );
    }
    return (
        <div
            {...rest}
            className={cn("absolute flex select-none items-center justify-center overflow-hidden text-xs", OBJECT_STYLE[obj.kind] || OBJECT_STYLE.wall, className)}
            style={{ left: obj.pos_x, top: obj.pos_y, width: obj.width, height: obj.height, transform: `rotate(${obj.rotation}deg)`, ...(rest.style || {}) }}
        >
            {text && <span className="truncate px-1">{text}</span>}
        </div>
    );
}

/** Warm wooden floor for the 3D look. */
export const WOOD_FLOOR_BG: React.CSSProperties = {
    backgroundColor: "var(--f3-wood-b)",
    backgroundImage:
        "repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 34px)," +
        "repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 140px, rgba(0,0,0,.06) 140px 141px, transparent 141px 280px)," +
        "radial-gradient(ellipse at 50% 30%, var(--f3-light), transparent 60%)," +
        "linear-gradient(180deg, var(--f3-wood-a), var(--f3-wood-b))",
};

/**
 * Colours of the 3D floor for light and dark mode (put FLOOR_3D_CSS in a <style> and the
 * "floor3d" class on the scene). Everything 3D reads these variables.
 */
export const FLOOR_3D_CSS = `
.floor3d {
  --f3-wood-a: #e6c9a1; --f3-wood-b: #c69c6b; --f3-light: rgba(255,244,214,.6);
  --f3-rim: rgba(120,72,30,.55); --f3-tabletop: linear-gradient(145deg,#c08a55,#8a5a2e);
  --f3-pill: rgba(255,255,255,.92); --f3-pill-text: #1e293b; --f3-label: #57534e;
  --f3-wall: linear-gradient(180deg,#f8fafc,#cbd5e1); --f3-wall-side: #94a3b8; --f3-wall-edge: #64748b;
  --f3-sky: linear-gradient(180deg,#e2e8f0,#f8fafc 45%,#cbd5e1);
}
.dark .floor3d {
  --f3-wood-a: #5a3c24; --f3-wood-b: #3a2616; --f3-light: rgba(255,190,110,.20);
  --f3-rim: rgba(0,0,0,.6); --f3-tabletop: linear-gradient(145deg,#7a5232,#4a2f19);
  --f3-pill: rgba(15,23,42,.88); --f3-pill-text: #f1f5f9; --f3-label: #d6d3d1;
  --f3-wall: linear-gradient(180deg,#475569,#334155); --f3-wall-side: #1e293b; --f3-wall-edge: #0f172a;
  --f3-sky: radial-gradient(ellipse at 50% 0%,#1e293b,#020617 70%);
}`;

/** Light grid behind the plan (every 20px, stronger every 100px). */
export const GRID_BG: React.CSSProperties = {
    backgroundImage:
        "linear-gradient(to right, rgba(148,163,184,.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.15) 1px, transparent 1px)," +
        "linear-gradient(to right, rgba(148,163,184,.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.3) 1px, transparent 1px)",
    backgroundSize: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
};

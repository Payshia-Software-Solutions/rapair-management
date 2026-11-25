"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, Store } from "lucide-react";

/**
 * POS startup screen: a progress bar driven by the real loading steps (items, taxes, customers,
 * tables...). Between steps it creeps forward slowly so it never looks frozen, but it only
 * reaches 100% when everything has arrived.
 */
export function PosLoadingScreen({ done, total, companyName, extraWait }: {
    done: string[];
    total: number;
    companyName?: string;
    /** Something outside the data steps is still pending (e.g. permissions) */
    extraWait?: boolean;
}) {
    const steps = total + 1;                       // + permissions
    const finished = done.length + (extraWait ? 0 : 1);
    const real = Math.min(1, finished / steps);
    const [shown, setShown] = useState(0.04);

    // Creep towards the next step while waiting, jump when a step completes
    useEffect(() => {
        setShown((s) => Math.max(s, real * 0.98));
        const ceiling = Math.min(0.97, real + 0.8 / steps);
        const t = setInterval(() => setShown((s) => (s < ceiling ? s + (ceiling - s) * 0.08 : s)), 120);
        return () => clearInterval(t);
    }, [real, steps]);

    const pct = Math.round(Math.min(real >= 1 ? 1 : shown, 1) * 100);
    const last = done[done.length - 1];

    return (
        <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* soft background glow */}
            <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative w-full max-w-sm px-6">
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/30">
                        <Store className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{companyName || "Point of Sale"}</p>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Starting the terminal</p>
                    </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                        className="relative h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-[width] duration-300 ease-out"
                        style={{ width: `${pct}%` }}
                    >
                        <div className="absolute inset-0 animate-[pos-shine_1.4s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)] bg-[length:50%_100%] bg-no-repeat" />
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        {pct < 100 ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                        <span key={pct >= 100 ? "ready" : last || "start"} className="truncate animate-in fade-in slide-in-from-bottom-1 duration-300">
                            {pct >= 100 ? "Ready" : last ? `Loaded ${last.toLowerCase()}…` : "Connecting…"}
                        </span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">{pct}%</span>
                </div>

            </div>

            <style>{`@keyframes pos-shine { from { background-position: -50% 0 } to { background-position: 150% 0 } }`}</style>
        </div>
    );
}

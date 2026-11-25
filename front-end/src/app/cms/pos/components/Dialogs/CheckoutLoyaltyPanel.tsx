"use client";

import React, { useEffect, useState } from "react";
import { Award, Coins, X } from "lucide-react";
import { usePOS } from "../../context/POSContext";

const money = (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Checkout: pay part of the bill with the member's loyalty points. Quick buttons (max / half /
 * the minimum) or type a number; the total due updates straight away. Hidden for non-members,
 * walk-ins, and when the member can't redeem on this bill.
 */
export function CheckoutLoyaltyPanel() {
    const { loyaltyInfo: info, loyalty, loyaltyRedeemPoints, setLoyaltyRedeemPoints } = usePOS();
    const [draft, setDraft] = useState("");
    useEffect(() => { setDraft(loyaltyRedeemPoints ? String(loyaltyRedeemPoints) : ""); }, [loyaltyRedeemPoints]);

    const m = info?.enabled && !info.walk_in ? info.member : null;
    if (!m || !m.active) return null;

    const canRedeem = loyalty.maxPoints > 0;
    const apply = (pts: number) => {
        const p = Math.max(0, Math.min(Math.floor(pts || 0), loyalty.maxPoints));
        setLoyaltyRedeemPoints(p > 0 && p < loyalty.minPoints ? 0 : p);
    };
    const typed = Math.floor(Number(draft) || 0);
    const typedBad = typed > 0 && (typed < loyalty.minPoints || typed > loyalty.maxPoints);
    const quick = [...new Set([loyalty.maxPoints, Math.floor(loyalty.maxPoints / 2), loyalty.minPoints])]
        .filter((v) => v >= loyalty.minPoints && v > 0 && v <= loyalty.maxPoints)
        .sort((a, b) => b - a);

    return (
        <div className="rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/5">
            <div className="flex items-center gap-2 text-xs">
                <Award className="h-4 w-4" style={{ color: m.tier_color || "#f59e0b" }} />
                <span className="font-semibold" style={{ color: m.tier_color }}>{m.tier || "Member"}</span>
                <span className="text-muted-foreground">{m.member_no}</span>
                <span className="ml-auto font-semibold tabular-nums">{(m.points - loyalty.points).toLocaleString()} pts left</span>
            </div>

            {loyalty.tierDiscount > 0 && (
                <div className="mt-1.5 flex justify-between text-xs text-amber-800 dark:text-amber-300">
                    <span>{m.tier} member discount ({loyalty.tierPct}%) applied</span>
                    <span className="font-semibold tabular-nums">−LKR {money(loyalty.tierDiscount)}</span>
                </div>
            )}

            {!canRedeem ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {m.points < loyalty.minPoints ? `Needs at least ${loyalty.minPoints.toLocaleString()} points to redeem.` : "Points can't be used on this bill."}
                </p>
            ) : loyalty.points > 0 ? (
                <div className="mt-2 flex items-center justify-between rounded-md bg-amber-500/15 px-2.5 py-1.5 text-sm">
                    <span className="flex items-center gap-1.5 font-medium"><Coins className="h-4 w-4 text-amber-600" /> {loyalty.points.toLocaleString()} points used</span>
                    <span className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">−LKR {money(loyalty.value)}</span>
                        <button onClick={() => setLoyaltyRedeemPoints(0)} className="rounded p-0.5 hover:bg-amber-500/25" aria-label="Don't use points"><X className="h-3.5 w-3.5" /></button>
                    </span>
                </div>
            ) : (
                <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium">Use points:</span>
                        {quick.map((v) => (
                            <button key={v} onClick={() => apply(v)}
                                className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                                {v === loyalty.maxPoints ? "Max " : ""}{v.toLocaleString()} <span className="text-muted-foreground">= LKR {money(v * loyalty.pointValue)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input type="number" min={0} max={loyalty.maxPoints} value={draft} placeholder="Points"
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); if (!typedBad) apply(typed); } }}
                            className="h-8 w-28 rounded-md border bg-background px-2 text-sm tabular-nums" aria-label="Points to use" />
                        <button onClick={() => apply(typed)} disabled={!typed || typedBad}
                            className="h-8 rounded-md bg-amber-500 px-3 text-xs font-semibold text-white disabled:opacity-40">Use</button>
                        <span className={`text-[11px] ${typedBad ? "text-destructive" : "text-muted-foreground"}`}>
                            {typedBad ? `Use ${loyalty.minPoints.toLocaleString()}–${loyalty.maxPoints.toLocaleString()} points` : `Up to ${loyalty.maxPoints.toLocaleString()} on this bill`}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

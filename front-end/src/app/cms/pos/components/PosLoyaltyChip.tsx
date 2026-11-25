"use client";

import React, { useState } from "react";
import { Award, Loader2, UserPlus, X } from "lucide-react";
import { enrollLoyaltyMember } from "@/lib/api/loyalty";
import { useToast } from "@/hooks/use-toast";
import { usePOS } from "../context/POSContext";

const money = (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * POS cart panel for the selected customer's loyalty membership: tier, points, member discount,
 * and the discount / points already applied (points are used in Checkout). Hidden when the Loyalty module or program is off, or
 * the customer is the location's walk-in customer.
 */
export function PosLoyaltyChip() {
    const { toast } = useToast();
    const { selectedCustomer, loyaltyInfo: info, loyalty, setLoyaltyRedeemPoints, refreshLoyalty } = usePOS();
    const [joining, setJoining] = useState(false);

    if (!info?.enabled || info.walk_in) return null;
    const m = info.member;

    const join = async () => {
        setJoining(true);
        try {
            await enrollLoyaltyMember(Number(selectedCustomer));
            refreshLoyalty();
            toast({ title: `Joined ${info.program || "rewards"}` });
        } catch (e: any) {
            toast({ title: "Couldn't enroll", description: e.message, variant: "destructive" });
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="border-b border-border bg-amber-50/60 px-3 py-1.5 text-xs dark:bg-amber-500/5">
            <div className="flex items-center gap-2">
                <Award className="h-3.5 w-3.5 shrink-0" style={{ color: m?.tier_color || "#f59e0b" }} />
                {m ? (
                    <>
                        <span className="font-semibold" style={{ color: m.tier_color }}>{m.tier || "Member"}</span>
                        <span className="text-muted-foreground">{m.member_no}</span>
                        {m.multiplier > 1 && <span className="rounded bg-amber-500/15 px-1 font-semibold text-amber-700 dark:text-amber-300">{m.multiplier}× pts</span>}
                        <span className="ml-auto font-semibold tabular-nums">{(m.points - loyalty.points).toLocaleString()} pts</span>
                    </>
                ) : (
                    <>
                        <span className="text-muted-foreground">Not in {info.program || "rewards"}{info.auto_enroll ? " · joins on this sale" : ""}</span>
                        {!info.auto_enroll && (
                            <button onClick={join} disabled={joining} className="ml-auto flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-medium hover:bg-muted">
                                {joining ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} Join
                            </button>
                        )}
                    </>
                )}
            </div>

            {m && (loyalty.tierDiscount > 0 || loyalty.points > 0) && (
                <div className="mt-1 space-y-0.5">
                    {loyalty.tierDiscount > 0 && (
                        <div className="flex justify-between text-amber-800 dark:text-amber-300">
                            <span>{m.tier} member discount ({loyalty.tierPct}%)</span>
                            <span className="font-semibold tabular-nums">−LKR {money(loyalty.tierDiscount)}</span>
                        </div>
                    )}
                    {loyalty.points > 0 && (
                        <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
                            <span className="flex items-center gap-1">
                                {loyalty.points.toLocaleString()} points used
                                <button onClick={() => setLoyaltyRedeemPoints(0)} className="rounded p-0.5 hover:bg-amber-500/20" aria-label="Remove points"><X className="h-3 w-3" /></button>
                            </span>
                            <span className="font-semibold tabular-nums">−LKR {money(loyalty.value)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Coins, Loader2, Settings2, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { fetchLoyaltyStats } from "@/lib/api/loyalty";

type Stats = Awaited<ReturnType<typeof fetchLoyaltyStats>>;

const n = (v: number) => Number(v || 0).toLocaleString();

export default function LoyaltyOverviewPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState("");

    useEffect(() => { fetchLoyaltyStats().then(setStats).catch((e) => setError(e.message)); }, []);

    const total = stats?.by_tier.reduce((s, t) => s + Number(t.n), 0) || 0;

    return (
        <DashboardLayout title="Loyalty">
            <div className="space-y-6">
                <PageHeader
                    title={stats?.program ? `${stats.program} · Loyalty` : "Loyalty & Rewards"}
                    description="Points on every sale, member tiers and their benefits."
                    actions={<>
                        <Button variant="outline" asChild><Link href="/loyalty/members"><Users className="mr-2 h-4 w-4" /> Members</Link></Button>
                        <Button asChild><Link href="/loyalty/settings"><Settings2 className="mr-2 h-4 w-4" /> Program & tiers</Link></Button>
                    </>}
                />

                {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
                {!stats && !error && <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>}

                {stats && !stats.enabled && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                        <span>The program is switched off, so sales don't earn points yet.</span>
                        <Button size="sm" asChild><Link href="/loyalty/settings">Set up and switch on</Link></Button>
                    </div>
                )}

                {stats && (
                    <>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            {[
                                { label: "Members", value: n(stats.members), icon: Users },
                                { label: "Points held by members", value: n(stats.points_outstanding), icon: Coins },
                                { label: "Value of those points", value: `LKR ${Number(stats.liability).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Wallet },
                                { label: "Earned this month", value: n(stats.earned_this_month), icon: TrendingUp },
                                { label: "Redeemed this month", value: n(stats.redeemed_this_month), icon: TrendingDown },
                            ].map((k) => (
                                <div key={k.label} className="rounded-lg border bg-card p-4">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><k.icon className="h-4 w-4" /> {k.label}</div>
                                    <p className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</p>
                                </div>
                            ))}
                        </div>

                        <SectionCard title="Members by tier" description="Who is where on the ladder right now.">
                            <div className="space-y-3 p-4">
                                {stats.by_tier.map((t) => {
                                    const pct = total ? Math.round((Number(t.n) / total) * 100) : 0;
                                    return (
                                        <div key={t.id} className="flex items-center gap-3">
                                            <span className="flex w-32 items-center gap-2 text-sm font-medium">
                                                <Award className="h-4 w-4" style={{ color: t.color }} /> {t.name}
                                            </span>
                                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.color }} />
                                            </div>
                                            <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">{n(Number(t.n))} · {pct}%</span>
                                        </div>
                                    );
                                })}
                                {stats.by_tier.length === 0 && <p className="text-sm text-muted-foreground">No tiers yet.</p>}
                            </div>
                        </SectionCard>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

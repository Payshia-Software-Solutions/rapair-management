"use client";

import React, { useEffect, useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { fetchLoyaltyReports } from "@/lib/api/loyalty";

type Reports = Awaited<ReturnType<typeof fetchLoyaltyReports>>;
const n = (v: number) => Number(v || 0).toLocaleString();
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" });

export default function LoyaltyReportsPage() {
    const [r, setR] = useState<Reports | null>(null);
    const [error, setError] = useState("");
    useEffect(() => { fetchLoyaltyReports().then(setR).catch((e) => setError(e.message)); }, []);

    const peak = Math.max(1, ...(r?.months || []).map((m) => Math.max(Number(m.earned), Number(m.redeemed))));
    const totals = (r?.months || []).reduce((a, m) => ({
        earned: a.earned + Number(m.earned), redeemed: a.redeemed + Number(m.redeemed), expired: a.expired + Number(m.expired),
        value: a.value + Number(m.redeemed_value), bills: a.bills + Number(m.bills),
    }), { earned: 0, redeemed: 0, expired: 0, value: 0, bills: 0 });

    return (
        <DashboardLayout title="Loyalty reports">
            <div className="space-y-6">
                <PageHeader title="Loyalty reports" description={`Last 12 months${r?.last_daily_run ? ` · daily jobs last ran ${r.last_daily_run}` : ""}`} />
                {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
                {!r && !error && <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>}

                {r && (
                    <>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            {[
                                ["Points earned", n(totals.earned)],
                                ["Points redeemed", n(totals.redeemed)],
                                ["Redemption rate", `${r.redemption_rate}%`],
                                ["Value redeemed", `LKR ${totals.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
                                ["Points expired", n(totals.expired)],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border bg-card p-4">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
                                </div>
                            ))}
                        </div>

                        <SectionCard title="Points by month" description="Earned (green) and redeemed (amber).">
                            <div className="p-4">
                                {r.months.length === 0 ? <p className="text-sm text-muted-foreground">No points activity yet.</p> : (
                                    <div className="flex h-48 items-end gap-2">
                                        {r.months.map((m) => (
                                            <div key={m.ym} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(m.ym)}: earned ${n(m.earned)}, redeemed ${n(m.redeemed)}, expired ${n(m.expired)}`}>
                                                <div className="flex h-40 w-full items-end justify-center gap-0.5">
                                                    <div className="w-1/2 max-w-5 rounded-t bg-emerald-500" style={{ height: `${(Number(m.earned) / peak) * 100}%` }} />
                                                    <div className="w-1/2 max-w-5 rounded-t bg-amber-500" style={{ height: `${(Number(m.redeemed) / peak) * 100}%` }} />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{monthLabel(m.ym)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </SectionCard>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <SectionCard title="Top members" description="By spend in the last 12 months.">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs text-muted-foreground">
                                        <tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 font-medium">Tier</th><th className="px-4 py-2 text-right font-medium">Spend</th><th className="px-4 py-2 text-right font-medium">Points</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {r.top.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No members yet.</td></tr>}
                                        {r.top.map((t) => (
                                            <tr key={t.customer_id}>
                                                <td className="px-4 py-2"><p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.member_no}</p></td>
                                                <td className="px-4 py-2"><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: t.tier_color }}><Award className="h-3 w-3" /> {t.tier_name}</span></td>
                                                <td className="px-4 py-2 text-right tabular-nums">LKR {Number(t.spend_12m).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                <td className="px-4 py-2 text-right font-semibold tabular-nums">{n(t.points_balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </SectionCard>

                            <SectionCard title="Points expiring in 30 days" description="Good people to remind (SMS Marketing → Loyalty: points expiring).">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs text-muted-foreground">
                                        <tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 font-medium">From</th><th className="px-4 py-2 text-right font-medium">Expiring</th><th className="px-4 py-2 text-right font-medium">Balance</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {r.expiring.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nothing expiring soon.</td></tr>}
                                        {r.expiring.map((e) => (
                                            <tr key={e.customer_id}>
                                                <td className="px-4 py-2"><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.phone}</p></td>
                                                <td className="px-4 py-2 text-xs">{e.first_expiry}</td>
                                                <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-600">{n(e.expiring)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{n(e.points_balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </SectionCard>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

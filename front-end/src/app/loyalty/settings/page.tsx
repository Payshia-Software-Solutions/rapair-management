"use client";

import React, { useEffect, useState } from "react";
import { Award, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
    fetchLoyaltySettings, runLoyaltyJobs, saveLoyaltySettings, saveLoyaltyTiers, type LoyaltySettings, type LoyaltyTier,
} from "@/lib/api/loyalty";

const money = (v: number) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function LoyaltySettingsPage() {
    const { toast } = useToast();
    const [s, setS] = useState<LoyaltySettings | null>(null);
    const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
    const [deleted, setDeleted] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);
    const [savingTiers, setSavingTiers] = useState(false);
    const [error, setError] = useState("");
    const [running, setRunning] = useState(false);
    const runJobs = async () => {
        setRunning(true);
        try {
            const r = await runLoyaltyJobs();
            toast({ title: "Daily jobs finished", description: `${r.expired_points} points expired (${r.expired_members} members) · ${r.birthdays} birthday bonuses · ${r.tier_changes} tier changes` });
        } catch (e: any) { toast({ title: "Couldn't run jobs", description: e.message, variant: "destructive" }); }
        finally { setRunning(false); }
    };

    useEffect(() => {
        fetchLoyaltySettings()
            .then((d) => { setS(d.settings); setTiers(d.tiers); })
            .catch((e) => setError(e.message));
    }, []);

    const set = (k: keyof LoyaltySettings, v: string) => setS((p) => (p ? { ...p, [k]: v } : p));
    const setTier = (i: number, patch: Partial<LoyaltyTier>) => setTiers((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    const saveSettings = async () => {
        if (!s) return;
        setSaving(true);
        try { await saveLoyaltySettings(s); toast({ title: "Program saved" }); }
        catch (e: any) { toast({ title: "Couldn't save", description: e.message, variant: "destructive" }); }
        finally { setSaving(false); }
    };

    const saveTiers = async () => {
        setSavingTiers(true);
        try {
            const sorted = [...tiers].sort((a, b) => Number(a.threshold) - Number(b.threshold));
            const fresh = await saveLoyaltyTiers(sorted, deleted);
            setTiers(fresh);
            setDeleted([]);
            toast({ title: "Tiers saved" });
        } catch (e: any) { toast({ title: "Couldn't save tiers", description: e.message, variant: "destructive" }); }
        finally { setSavingTiers(false); }
    };

    // Live example: what a 5,000 bill earns at each tier
    const example = 5000;
    const basePts = s ? Math.floor((example / Math.max(0.01, Number(s.earn_amount))) * Number(s.earn_points)) : 0;
    const tierLabel = s?.tier_basis === "lifetime_points" ? "Lifetime points needed" : "Spend in 12 months (LKR)";

    return (
        <DashboardLayout title="Loyalty program">
            <div className="space-y-6">
                <PageHeader title="Program & tiers" description="How customers earn points and move up the tiers." />
                {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
                {!s && !error && <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>}

                {s && (
                    <SectionCard title="Program" description="Changes apply to sales from now on.">
                        <div className="grid gap-6 p-5 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="text-sm font-semibold">Program on</p>
                                        <p className="text-xs text-muted-foreground">When off, sales don't earn points.</p>
                                    </div>
                                    <Switch checked={s.enabled === "1"} onCheckedChange={(v) => set("enabled", v ? "1" : "0")} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="pname">Program name</Label>
                                    <Input id="pname" value={s.program_name} maxLength={60} onChange={(e) => set("program_name", e.target.value)} placeholder="e.g. Nebulync Rewards" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Earning</Label>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span>Every LKR</span>
                                        <Input type="number" min={1} className="w-28" value={s.earn_amount} onChange={(e) => set("earn_amount", e.target.value)} />
                                        <span>earns</span>
                                        <Input type="number" min={1} className="w-20" value={s.earn_points} onChange={(e) => set("earn_points", e.target.value)} />
                                        <span>point(s)</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="basis">Points are worked out on</Label>
                                    <select id="basis" value={s.earn_basis} onChange={(e) => set("earn_basis", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                        <option value="pre_tax">The bill after discounts, before tax and service charge</option>
                                        <option value="total">The full bill total (with tax and service charge)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="minbill">Smallest bill that earns (LKR)</Label>
                                        <Input id="minbill" type="number" min={0} value={s.min_bill} onChange={(e) => set("min_bill", e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="exp">Points expire after (months)</Label>
                                        <Input id="exp" type="number" min={0} value={s.expiry_months} onChange={(e) => set("expiry_months", e.target.value)} />
                                        <p className="text-[11px] text-muted-foreground">0 = never</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="tbasis">Tier is decided by</Label>
                                    <select id="tbasis" value={s.tier_basis} onChange={(e) => set("tier_basis", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                        <option value="spend_12m">Spending in the last 12 months</option>
                                        <option value="lifetime_points">Total points ever earned</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="pv">1 point is worth (LKR)</Label>
                                        <Input id="pv" type="number" min={0} step="0.01" value={s.point_value} onChange={(e) => set("point_value", e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mr">Min. points to redeem</Label>
                                        <Input id="mr" type="number" min={0} value={s.min_redeem} onChange={(e) => set("min_redeem", e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mp">Max. % of a bill</Label>
                                        <Input id="mp" type="number" min={0} max={100} value={s.max_redeem_pct} onChange={(e) => set("max_redeem_pct", e.target.value)} />
                                    </div>
                                </div>
                                <p className="-mt-2 text-[11px] text-muted-foreground">At the POS, "Use points" on the member's line pays part of the bill with points.</p>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="text-sm font-semibold">Enroll customers on their first sale</p>
                                        <p className="text-xs text-muted-foreground">Walk-in (default) customers are never enrolled.</p>
                                    </div>
                                    <Switch checked={s.auto_enroll === "1"} onCheckedChange={(v) => set("auto_enroll", v ? "1" : "0")} />
                                </div>
                                <div className="space-y-2 rounded-lg border p-3">
                                    <p className="text-sm font-semibold">SMS to customers</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Points earned after each sale</span>
                                        <Switch checked={s.sms_on_earn === "1"} onCheckedChange={(v) => set("sms_on_earn", v ? "1" : "0")} />
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Moved up to a new tier</span>
                                        <Switch checked={s.sms_on_tier_up === "1"} onCheckedChange={(v) => set("sms_on_tier_up", v ? "1" : "0")} />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Uses the SMS gateway in System Settings. Each message is charged by your SMS provider.</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    <p className="font-medium">Example: a LKR {money(example)} bill</p>
                                    <p className="mt-1 text-muted-foreground">
                                        {tiers.filter((t) => Number(t.is_active ?? 1)).map((t) => `${t.name}: ${Math.floor(basePts * Number(t.multiplier || 1))} pts`).join(" · ") || `${basePts} pts`}
                                    </p>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={saveSettings} disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save program
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                )}

                {s && (
                    <SectionCard title="Tiers" description="Members move up as soon as they reach a tier. Lowest tier is where new members start.">
                        <div className="overflow-x-auto p-4">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead className="text-left text-xs text-muted-foreground">
                                    <tr>
                                        <th className="pb-2 font-medium">Tier</th>
                                        <th className="pb-2 font-medium">Colour</th>
                                        <th className="pb-2 font-medium">{tierLabel}</th>
                                        <th className="pb-2 font-medium">Points ×</th>
                                        <th className="pb-2 font-medium">Discount %</th>
                                        <th className="pb-2 font-medium">Birthday points</th>
                                        <th className="pb-2 font-medium">Active</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {tiers.map((t, i) => (
                                        <tr key={t.id ?? `new${i}`}>
                                            <td className="py-2 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <Award className="h-4 w-4 shrink-0" style={{ color: t.color }} />
                                                    <Input value={t.name} maxLength={40} onChange={(e) => setTier(i, { name: e.target.value })} className="h-9" />
                                                </div>
                                            </td>
                                            <td className="py-2 pr-2"><input type="color" value={t.color} onChange={(e) => setTier(i, { color: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-transparent" /></td>
                                            <td className="py-2 pr-2"><Input type="number" min={0} value={t.threshold} onChange={(e) => setTier(i, { threshold: e.target.value })} className="h-9 w-36" /></td>
                                            <td className="py-2 pr-2"><Input type="number" min={0} step="0.1" value={t.multiplier} onChange={(e) => setTier(i, { multiplier: e.target.value })} className="h-9 w-20" /></td>
                                            <td className="py-2 pr-2"><Input type="number" min={0} max={100} step="0.5" value={t.discount_pct} onChange={(e) => setTier(i, { discount_pct: e.target.value })} className="h-9 w-20" /></td>
                                            <td className="py-2 pr-2"><Input type="number" min={0} value={t.birthday_points} onChange={(e) => setTier(i, { birthday_points: e.target.value })} className="h-9 w-24" /></td>
                                            <td className="py-2 pr-2"><Switch checked={Number(t.is_active ?? 1) === 1} onCheckedChange={(v) => setTier(i, { is_active: v ? 1 : 0 })} /></td>
                                            <td className="py-2 text-right">
                                                <Button variant="ghost" size="icon" disabled={tiers.length <= 1} aria-label={`Remove ${t.name}`}
                                                    onClick={() => { if (t.id) setDeleted((d) => [...d, t.id!]); setTiers((x) => x.filter((_, j) => j !== i)); }}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Discount % comes off the bill at the POS for members of that tier. Birthday points need the customer's date of birth.
                                Expiry, birthday points and the tier review run once a day on their own (tiers are reviewed monthly).
                            </p>
                            <div className="mt-3 flex justify-between">
                                <div className="flex gap-2">
                                <Button variant="outline" onClick={runJobs} disabled={running} title="Expire points, give birthday points and review tiers now">
                                    {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Run daily jobs now
                                </Button>
                                <Button variant="outline" onClick={() => setTiers((t) => [...t, { name: "", color: "#10b981", threshold: 0, multiplier: 1, discount_pct: 0, birthday_points: 0, is_active: 1 }])}>
                                    <Plus className="mr-2 h-4 w-4" /> Add tier
                                </Button>
                                </div>
                                <Button onClick={saveTiers} disabled={savingTiers}>
                                    {savingTiers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save tiers
                                </Button>
                            </div>
                        </div>
                    </SectionCard>
                )}
            </div>
        </DashboardLayout>
    );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Award, CreditCard, Loader2, Lock, Minus, Plus, Printer, Search, UserPlus } from "lucide-react";
import { printLoyaltyCard } from "@/lib/loyalty-card-print";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchCustomers } from "@/lib/api/master-data";
import {
    adjustLoyaltyPoints, enrollLoyaltyMember, fetchLoyaltyMember, fetchLoyaltyMembers, fetchLoyaltySettings,
    updateLoyaltyMember, type LoyaltyMemberRow, type LoyaltyProfile, type LoyaltyTier,
} from "@/lib/api/loyalty";
import { cn } from "@/lib/utils";

const n = (v: number) => Number(v || 0).toLocaleString();

const cardOf = (p: LoyaltyProfile) => ({
    member_no: p.member.member_no, name: p.customer.name, phone: p.customer.phone,
    tier: p.member.tier_name, tier_color: p.member.tier_color, program: p.program, joined_at: p.member.joined_at,
});
const TYPE_LABEL: Record<string, string> = { earn: "Earned", redeem: "Redeemed", expire: "Expired", adjust: "Adjusted", reverse: "Reversed", bonus: "Bonus" };

function TierBadge({ name, color }: { name?: string; color?: string }) {
    if (!name) return <span className="text-xs text-muted-foreground">—</span>;
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${color}22`, color }}>
            <Award className="h-3 w-3" /> {name}
        </span>
    );
}

export default function LoyaltyMembersPage() {
    const { toast } = useToast();
    const [rows, setRows] = useState<LoyaltyMemberRow[] | null>(null);
    const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
    const [q, setQ] = useState("");
    const [tier, setTier] = useState(0);
    const [error, setError] = useState("");

    const [openId, setOpenId] = useState<number | null>(null);
    const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
    const [adjPts, setAdjPts] = useState("");
    const [adjReason, setAdjReason] = useState("");
    const [busy, setBusy] = useState(false);

    const [enrollOpen, setEnrollOpen] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [custQ, setCustQ] = useState("");

    const load = () => fetchLoyaltyMembers(q.trim(), tier).then(setRows).catch((e) => setError(e.message));
    useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [q, tier]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { fetchLoyaltySettings().then((d) => setTiers(d.tiers)).catch(() => {}); }, []);

    const open = async (customerId: number) => {
        setOpenId(customerId);
        setProfile(null);
        setAdjPts(""); setAdjReason("");
        try { setProfile(await fetchLoyaltyMember(customerId)); }
        catch (e: any) { toast({ title: "Couldn't open member", description: e.message, variant: "destructive" }); setOpenId(null); }
    };

    const adjust = async (sign: 1 | -1) => {
        if (!openId) return;
        const pts = Math.abs(parseInt(adjPts, 10) || 0) * sign;
        if (!pts) { toast({ title: "Enter the points" }); return; }
        if (!adjReason.trim()) { toast({ title: "Give a reason" }); return; }
        setBusy(true);
        try {
            setProfile(await adjustLoyaltyPoints(openId, pts, adjReason.trim()));
            setAdjPts(""); setAdjReason("");
            toast({ title: sign > 0 ? `${n(Math.abs(pts))} points added` : `${n(Math.abs(pts))} points removed` });
            void load();
        } catch (e: any) { toast({ title: "Couldn't update points", description: e.message, variant: "destructive" }); }
        finally { setBusy(false); }
    };

    const patchMember = async (patch: Parameters<typeof updateLoyaltyMember>[1]) => {
        if (!openId) return;
        setBusy(true);
        try { setProfile(await updateLoyaltyMember(openId, patch)); void load(); }
        catch (e: any) { toast({ title: "Couldn't update member", description: e.message, variant: "destructive" }); }
        finally { setBusy(false); }
    };

    const openEnroll = async () => {
        setEnrollOpen(true);
        if (!customers.length) fetchCustomers().then((c) => setCustomers(c || [])).catch(() => {});
    };
    const enroll = async (c: any) => {
        setBusy(true);
        try {
            await enrollLoyaltyMember(Number(c.id));
            toast({ title: `${c.name} enrolled` });
            setEnrollOpen(false);
            void load();
            void open(Number(c.id));
        } catch (e: any) { toast({ title: "Couldn't enroll", description: e.message, variant: "destructive" }); }
        finally { setBusy(false); }
    };
    const memberIds = useMemo(() => new Set((rows || []).map((r) => r.customer_id)), [rows]);
    const custMatches = customers.filter((c) => !memberIds.has(Number(c.id)) &&
        (!custQ || `${c.name} ${c.phone || ""}`.toLowerCase().includes(custQ.toLowerCase()))).slice(0, 50);

    const m = profile?.member;
    const metricLabel = profile?.tier_basis === "lifetime_points" ? "points" : "LKR spent (12 months)";
    const progress = profile?.next_tier ? Math.min(100, Math.round((profile.tier_metric / Math.max(1, profile.next_tier.threshold)) * 100)) : 100;

    return (
        <DashboardLayout title="Loyalty members">
            <div className="space-y-5">
                <PageHeader title="Members" description="Customers in the loyalty program, their tier and points."
                    actions={<Button onClick={openEnroll}><UserPlus className="mr-2 h-4 w-4" /> Enroll customer</Button>} />

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or member no" className="pl-9" />
                    </div>
                    <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                        <option value={0}>All tiers</option>
                        {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

                {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
                <div className="overflow-hidden rounded-lg border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2.5 font-medium">Member</th>
                                <th className="px-4 py-2.5 font-medium">Member no</th>
                                <th className="px-4 py-2.5 font-medium">Tier</th>
                                <th className="px-4 py-2.5 text-right font-medium">Points</th>
                                <th className="px-4 py-2.5 text-right font-medium">Lifetime</th>
                                <th className="px-4 py-2.5 font-medium">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows === null && <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>}
                            {rows?.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No members yet. Enroll a customer, or switch on "Enroll customers on their first sale".</td></tr>}
                            {rows?.map((r) => (
                                <tr key={r.id} onClick={() => open(r.customer_id)} className={cn("cursor-pointer hover:bg-muted/40", !Number(r.is_active) && "opacity-50")}>
                                    <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.phone}</p></td>
                                    <td className="px-4 py-2.5 font-mono text-xs">{r.member_no}</td>
                                    <td className="px-4 py-2.5"><TierBadge name={r.tier_name} color={r.tier_color} /> {Number(r.tier_locked) ? <Lock className="ml-1 inline h-3 w-3 text-muted-foreground" /> : null}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{n(r.points_balance)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{n(r.lifetime_points)}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{String(r.joined_at).slice(0, 10)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member profile */}
            <Dialog open={openId !== null} onOpenChange={(v) => { if (!v) setOpenId(null); }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
                        <DialogTitle>{profile?.customer?.name || "Member"}</DialogTitle>
                        {profile && (
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => printLoyaltyCard(cardOf(profile), "receipt")}><Printer className="mr-1.5 h-4 w-4" aria-hidden="true" /> Print card</Button>
                                <Button size="sm" variant="outline" onClick={() => printLoyaltyCard(cardOf(profile), "card")} title="CR80 card size (85.6 x 54 mm)"><CreditCard className="mr-1.5 h-4 w-4" aria-hidden="true" /> Card size</Button>
                            </div>
                        )}
                    </DialogHeader>
                    {!profile ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
                        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Points balance</p>
                                    <p className="text-2xl font-semibold tabular-nums">{n(m.points_balance)}</p>
                                    <p className="text-xs text-muted-foreground">≈ LKR {(Number(m.points_balance) * profile.point_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Tier</p>
                                    <div className="mt-1"><TierBadge name={m.tier_name} color={m.tier_color} /></div>
                                    <p className="mt-1 text-xs text-muted-foreground">Member {m.member_no} · since {String(m.joined_at).slice(0, 10)}</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Expiring in 30 days</p>
                                    <p className="text-2xl font-semibold tabular-nums">{n(profile.expiring_30d)}</p>
                                    <p className="text-xs text-muted-foreground">Lifetime {n(m.lifetime_points)} pts</p>
                                </div>
                            </div>

                            <div className="rounded-lg border p-3">
                                {profile.next_tier ? (
                                    <>
                                        <div className="mb-1.5 flex justify-between text-xs">
                                            <span>{n(Math.round(profile.tier_metric))} {metricLabel}</span>
                                            <span className="text-muted-foreground">{n(Math.ceil(profile.next_tier.remaining))} more to <b style={{ color: profile.next_tier.color }}>{profile.next_tier.name}</b></span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: profile.next_tier.color }} /></div>
                                    </>
                                ) : <p className="text-sm text-muted-foreground">Top tier reached.</p>}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 rounded-lg border p-3">
                                    <Label>Add or remove points</Label>
                                    <div className="flex gap-2">
                                        <Input type="number" min={1} value={adjPts} onChange={(e) => setAdjPts(e.target.value)} placeholder="Points" className="w-28" />
                                        <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason (required)" maxLength={200} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => adjust(1)} disabled={busy}><Plus className="mr-1 h-4 w-4" /> Add</Button>
                                        <Button size="sm" variant="outline" onClick={() => adjust(-1)} disabled={busy}><Minus className="mr-1 h-4 w-4" /> Remove</Button>
                                    </div>
                                </div>
                                <div className="space-y-2 rounded-lg border p-3">
                                    <Label htmlFor="mtier">Tier</Label>
                                    <select id="mtier" value={m.tier_id || ""} disabled={busy}
                                        onChange={(e) => patchMember({ tier_id: Number(e.target.value) || null })}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                                        {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Keep this tier (no automatic changes)</span>
                                        <Switch checked={Number(m.tier_locked) === 1} disabled={busy} onCheckedChange={(v) => patchMember({ tier_locked: v })} />
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Active member</span>
                                        <Switch checked={Number(m.is_active) === 1} disabled={busy} onCheckedChange={(v) => patchMember({ is_active: v })} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-sm font-semibold">Points history</p>
                                <div className="overflow-hidden rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                                            <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Details</th><th className="px-3 py-2 text-right font-medium">Points</th></tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(profile.ledger || []).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No points yet.</td></tr>}
                                            {(profile.ledger || []).map((l) => (
                                                <tr key={l.id}>
                                                    <td className="px-3 py-2 text-xs text-muted-foreground">{String(l.created_at).slice(0, 16)}</td>
                                                    <td className="px-3 py-2">{TYPE_LABEL[l.type] || l.type}</td>
                                                    <td className="px-3 py-2 text-xs">
                                                        {l.invoice_no ? `Invoice ${l.invoice_no} · LKR ${Number(l.amount).toLocaleString()}` : ""}
                                                        {l.note ? `${l.invoice_no ? " · " : ""}${l.note}` : ""}
                                                        {l.user_name ? <span className="text-muted-foreground"> · {l.user_name}</span> : null}
                                                    </td>
                                                    <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", l.points > 0 ? "text-emerald-600" : l.points < 0 ? "text-rose-600" : "text-muted-foreground")}>
                                                        {l.points > 0 ? "+" : ""}{n(l.points)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Enroll */}
            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Enroll a customer</DialogTitle></DialogHeader>
                    <Input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search customers" autoFocus />
                    <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
                        {custMatches.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No customers to enroll.</p>}
                        {custMatches.map((c) => (
                            <button key={c.id} onClick={() => enroll(c)} disabled={busy} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                                <span><b className="font-medium">{c.name}</b> <span className="text-muted-foreground">{c.phone}</span></span>
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchUnposted, postUnposted, type UnpostedGroup } from "@/lib/api/posting";

const money = (v: any) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HELP: Record<string, string> = {
    StockMovement: "Opening stock is booked Dr Inventory / Cr Opening Balance Equity. Manual changes go to the stock adjustment account. Check the item costs before posting large opening stock.",
    PaymentReceipt: "Dr Cash or Bank / Cr Accounts Receivable, on the receipt date.",
    Refund: "Dr Accounts Receivable / Cr Cash or Bank.",
};

/**
 * Lists business documents that never reached the accounts (P&L and Balance Sheet are only
 * right when this is empty) and posts them with the standard mappings.
 */
export default function PostingCheckPage() {
    const { toast } = useToast();
    const [data, setData] = useState<{ groups: UnpostedGroup[]; total: number; balanced: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [open, setOpen] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try { setData(await fetchUnposted()); }
        catch (e: any) { toast({ title: "Couldn't run the check", description: e?.message, variant: "destructive" }); }
        finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { void load(); }, [load]);

    const post = async (g: UnpostedGroup, ids?: number[]) => {
        const what = ids ? `${ids.length} ${g.label.toLowerCase()}` : `all ${g.count} ${g.label.toLowerCase()} (LKR ${money(g.amount)})`;
        if (!window.confirm(`Post ${what} to the accounts?`)) return;
        setBusy(g.type + (ids ? ids.join(",") : ""));
        try {
            const r = await postUnposted(g.type, ids);
            toast({ title: r.data.failed.length ? "Posted with problems" : "Posted", description: r.message, variant: r.data.failed.length ? "destructive" : undefined });
            await load();
        } catch (e: any) {
            toast({ title: "Couldn't post", description: e?.message, variant: "destructive" });
        } finally { setBusy(null); }
    };

    const pending = (data?.groups || []).filter(g => g.count > 0);

    return (
        <DashboardLayout>
            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Posting Check</h1>
                        <p className="text-sm text-muted-foreground mt-1">Documents that haven&apos;t reached the accounts yet. The P&amp;L and Balance Sheet are only complete when this list is empty.</p>
                    </div>
                    <Button variant="outline" onClick={() => void load()} disabled={loading} className="shrink-0">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Run check
                    </Button>
                </div>

                {data && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Card className="p-4 flex items-center gap-3">
                            {data.total === 0
                                ? <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
                                : <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" aria-hidden="true" />}
                            <div>
                                <p className="font-semibold">{data.total === 0 ? "Everything is posted" : `${data.total} documents not posted`}</p>
                                <p className="text-sm text-muted-foreground">{data.total === 0 ? "Every sale, payment and stock change is in the books." : "Post them so reports show the full picture."}</p>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3">
                            {data.balanced
                                ? <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
                                : <AlertTriangle className="h-6 w-6 text-destructive shrink-0" aria-hidden="true" />}
                            <div>
                                <p className="font-semibold">{data.balanced ? "Books balance" : "Books don't balance"}</p>
                                <p className="text-sm text-muted-foreground">Total debits {data.balanced ? "equal" : "don't equal"} total credits.</p>
                            </div>
                        </Card>
                    </div>
                )}

                {loading && !data ? (
                    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</div>
                ) : pending.length > 0 && (
                    <div className="space-y-3">
                        {pending.map(g => (
                            <Card key={g.type} className="overflow-hidden">
                                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                                    <button type="button" className="flex flex-1 items-center gap-3 text-left min-w-0" aria-expanded={!!open[g.type]}
                                        onClick={() => setOpen(o => ({ ...o, [g.type]: !o[g.type] }))}>
                                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open[g.type] ? "" : "-rotate-90"}`} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <p className="font-semibold">{g.label} <span className="ml-1 rounded-full bg-amber-100 px-2 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 tabular-nums">{g.count}</span></p>
                                            <p className="text-sm text-muted-foreground tabular-nums">LKR {money(g.amount)}</p>
                                        </div>
                                    </button>
                                    <Button onClick={() => void post(g)} disabled={!!busy} className="shrink-0">
                                        {busy === g.type ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" aria-hidden="true" />}
                                        Post all
                                    </Button>
                                </div>
                                {open[g.type] && (
                                    <div className="border-t">
                                        {HELP[g.type] && <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/30">{HELP[g.type]}</p>}
                                        <div className="max-h-[420px] overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                                                    <tr>
                                                        <th className="px-4 py-2 font-medium">Document</th>
                                                        <th className="px-4 py-2 font-medium">Date</th>
                                                        <th className="px-4 py-2 font-medium text-right">Amount</th>
                                                        <th className="px-4 py-2" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {g.rows.map(r => (
                                                        <tr key={r.id}>
                                                            <td className="px-4 py-2">{r.doc_no}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap">{r.doc_date || "—"}</td>
                                                            <td className="px-4 py-2 text-right tabular-nums">{money(r.amount)}</td>
                                                            <td className="px-4 py-2 text-right">
                                                                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void post(g, [r.id])}>Post</Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, CheckCircle2, Clock, ExternalLink, Eye, FileX, Loader2, Plus, RefreshCw, Search, Undo2, X, XCircle } from "lucide-react";
import { ImpactPanel, ItemsTable, fmtDate, getDocUrl } from "../_components/doc-impact";
import { useToast } from "@/hooks/use-toast";
import {
    approveCancelRequest, fetchCancelRequests, rejectCancelRequest, withdrawCancelRequest, setCancelSelfApprove, lookupDocument, type CancelRequest, type CancelLookupResult,
} from "@/lib/api/cancellation";

type Status = "pending" | "approved" | "rejected" | "all";

const TYPE_LABEL: Record<string, string> = {
    Invoice: "Invoice", PaymentReceipt: "Payment receipt", GRN: "GRN", Expense: "Expense",
    VendorPayment: "Vendor payment", Reservation: "Reservation",
};
const TABS: { key: Status; label: string }[] = [
    { key: "pending", label: "Waiting" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];
const money = (v: any) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (v: string | null) => v ? new Date(v.replace(" ", "T")).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

function StatusPill({ status }: { status: CancelRequest["status"] }) {
    if (status === "pending") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><Clock className="h-3 w-3" aria-hidden="true" />Waiting</span>;
    if (status === "approved") return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Approved · cancelled</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"><XCircle className="h-3 w-3" aria-hidden="true" />Rejected</span>;
}

export default function CancellationApprovalsPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<Status>("pending");
    const [mine, setMine] = useState(false);
    const [type, setType] = useState("");
    const [q, setQ] = useState("");
    const [data, setData] = useState<{ requests: CancelRequest[]; pending: number; can_approve: boolean; is_admin?: boolean; admin_self_approve?: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [decision, setDecision] = useState<{ r: CancelRequest; kind: "approve" | "reject" } | null>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState<CancelRequest | null>(null);
    const [doc, setDoc] = useState<CancelLookupResult | null>(null);
    const [docErr, setDocErr] = useState<string | null>(null);

    const openDetail = async (r: CancelRequest) => {
        setDetail(r); setDoc(null); setDocErr(null);
        try { setDoc(await lookupDocument(r.doc_type, String(r.doc_no || r.doc_id))); }
        catch (e: any) { setDocErr(e?.message || "Couldn't load the document"); }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try { setData(await fetchCancelRequests(status, mine)); }
        catch (e: any) {
            setData({ requests: [], pending: 0, can_approve: false });
            toast({ title: "Couldn't load requests", description: e?.message, variant: "destructive" });
        } finally { setLoading(false); }
    }, [status, mine, toast]);
    useEffect(() => { void load(); }, [load]);

    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (data?.requests || []).filter(r =>
            (!type || r.doc_type === type) &&
            (!s || [r.doc_no, r.reason, r.requested_by_name, r.location_name].some(v => (v || "").toLowerCase().includes(s))));
    }, [data, q, type]);

    const run = async (fn: () => Promise<any>, ok: string) => {
        setBusy(true);
        try {
            await fn();
            toast({ title: ok });
            setDecision(null); setDetail(null); setNote("");
            await load();
        } catch (e: any) {
            toast({ title: "Couldn't complete", description: e?.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const confirmDecision = () => {
        if (!decision) return;
        const { r, kind } = decision;
        if (kind === "approve") void run(() => approveCancelRequest(r.id, note), `${r.doc_no || "Document"} cancelled`);
        else void run(() => rejectCancelRequest(r.id, note), "Request rejected");
    };

    const canApprove = !!data?.can_approve;

    return (
        <DashboardLayout>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Cancellation Requests</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {canApprove
                                ? "Review requests from your team. Approving cancels the document and reverses stock, payments and accounts. You can't approve your own requests."
                                : "Track the cancellations you've requested. A manager approves them before the document is cancelled."}
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={() => void load()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
                        </Button>
                        <Button asChild>
                            <Link href="/approvals/request-cancellation"><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Request cancellation</Link>
                        </Button>
                    </div>
                </div>

                {data?.is_admin && (
                    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Label htmlFor="self-approve" className="font-semibold">Let admins approve their own requests</Label>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {data.admin_self_approve
                                    ? "On: an admin can approve a cancellation they asked for. History still shows who asked and who approved."
                                    : "Off: a second user always has to approve. Turn on if you're the only admin."}
                            </p>
                        </div>
                        <Switch id="self-approve" checked={!!data.admin_self_approve} disabled={busy}
                            onCheckedChange={v => void run(() => setCancelSelfApprove(v), v ? "Admins can approve their own requests" : "A second user must approve every request")} />
                    </Card>
                )}

                <Card className="overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
                        <div className="inline-flex rounded-md bg-muted p-1" role="tablist" aria-label="Request status">
                            {TABS.map(t => (
                                <button key={t.key} type="button" role="tab" aria-selected={status === t.key} onClick={() => setStatus(t.key)}
                                    className={`h-8 px-3 rounded-sm text-sm font-medium inline-flex items-center gap-1.5 ${status === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                    {t.label}
                                    {t.key === "pending" && !!data?.pending && (
                                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs leading-5 tabular-nums">{data.pending}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
                            <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                <Input className="pl-9 h-9" placeholder="Search document, reason, user…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search requests" />
                            </div>
                            <select value={type} onChange={e => setType(e.target.value)} aria-label="Document type"
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                                <option value="">All documents</option>
                                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            {canApprove && (
                                <label className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm cursor-pointer">
                                    <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} className="h-4 w-4" />
                                    Only mine
                                </label>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    {loading && !data ? (
                        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><FileX className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>
                            <p className="font-medium">{status === "pending" ? "Nothing waiting for approval" : "No requests found"}</p>
                            <p className="text-sm text-muted-foreground">Requests show up here when someone cancels an invoice, receipt, GRN, expense or payment.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Document</th>
                                        <th className="px-4 py-2.5 font-medium text-right">Amount (LKR)</th>
                                        <th className="px-4 py-2.5 font-medium">Reason</th>
                                        <th className="px-4 py-2.5 font-medium">Requested</th>
                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map(r => (
                                        <tr key={r.id} className="align-top hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <button type="button" onClick={() => void openDetail(r)} className="font-semibold text-primary hover:underline text-left">{r.doc_no || `#${r.doc_id}`}</button>
                                                <div className="text-xs text-muted-foreground">{TYPE_LABEL[r.doc_type] || r.doc_type}{r.location_name ? ` · ${r.location_name}` : ""}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">{r.amount !== null ? money(r.amount) : "—"}</td>
                                            <td className="px-4 py-3 max-w-[320px]"><p className="break-words">{r.reason}</p></td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div>{r.requested_by_name || `User #${r.requested_by}`}</div>
                                                <div className="text-xs text-muted-foreground">{when(r.requested_at)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusPill status={r.status} />
                                                {r.decided_at && (
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        by {r.decided_by_name || "—"} · {when(r.decided_at)}
                                                        {r.decision_note && <div className="italic">“{r.decision_note}”</div>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => void openDetail(r)}>
                                                        <Eye className="h-4 w-4 mr-1" aria-hidden="true" /> Details
                                                    </Button>
                                                    {r.status === "pending" && r.can_decide && (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => { setNote(""); setDecision({ r, kind: "reject" }); }}>
                                                                <X className="h-4 w-4 mr-1" aria-hidden="true" /> Reject
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => { setNote(""); setDecision({ r, kind: "approve" }); }}>
                                                                <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Approve
                                                            </Button>
                                                        </>
                                                    )}
                                                    {r.status === "pending" && !r.can_decide && (
                                                        <Button size="sm" variant="ghost" disabled={busy}
                                                            onClick={() => void run(() => withdrawCancelRequest(r.id), "Request withdrawn")}>
                                                            <Undo2 className="h-4 w-4 mr-1" aria-hidden="true" /> Withdraw
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            {/* Request details: document, items and everything the approval reverses */}
            <Dialog open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }}>
                <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[92dvh] p-0 gap-0 flex flex-col overflow-hidden">
                    {detail && (
                        <>
                            <DialogHeader className="p-4 sm:p-5 border-b text-left space-y-1">
                                <div className="flex flex-wrap items-center gap-2 pr-6">
                                    <DialogTitle className="text-lg">{detail.doc_no || `#${detail.doc_id}`}</DialogTitle>
                                    <StatusPill status={detail.status} />
                                </div>
                                <DialogDescription>
                                    {TYPE_LABEL[detail.doc_type] || detail.doc_type}{detail.location_name ? ` · ${detail.location_name}` : ""}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                                    <p><span className="text-muted-foreground">Reason: </span>{detail.reason}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Asked by {detail.requested_by_name || `user #${detail.requested_by}`} · {when(detail.requested_at)}
                                        {detail.decided_at && ` · ${detail.status === "approved" ? "Approved" : "Rejected"} by ${detail.decided_by_name || "—"} ${when(detail.decided_at)}`}
                                    </p>
                                    {detail.decision_note && <p className="text-xs italic">“{detail.decision_note}”</p>}
                                </div>

                                {docErr ? (
                                    <p role="alert" className="text-sm text-destructive">{docErr}</p>
                                ) : !doc ? (
                                    <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading document…</div>
                                ) : (
                                    <>
                                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-md border p-3 text-sm">
                                            <div className="col-span-2 sm:col-span-1 min-w-0"><dt className="text-xs text-muted-foreground">Party</dt><dd className="font-medium truncate">{doc.name || "—"}</dd></div>
                                            <div><dt className="text-xs text-muted-foreground">Date</dt><dd className="font-medium">{fmtDate(doc.date)}</dd></div>
                                            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="font-medium">{doc.status}</dd></div>
                                            <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">LKR {money(doc.amount)}</dd></div>
                                        </dl>
                                        {!!doc.items?.length && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold">Items</h3>
                                                <div className="overflow-x-auto"><ItemsTable items={doc.items} /></div>
                                            </div>
                                        )}
                                        {doc.impact && detail.status === "pending" && <div className="overflow-x-auto"><ImpactPanel impact={doc.impact} /></div>}
                                        <Link href={getDocUrl(detail.doc_type, detail.doc_id)} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                            Open document <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                        </Link>
                                    </>
                                )}
                            </div>

                            <DialogFooter className="p-3 sm:p-4 border-t flex-row flex-wrap justify-end gap-2 sm:space-x-0">
                                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                                {detail.status === "pending" && detail.can_decide && (
                                    <>
                                        <Button variant="outline" onClick={() => { setNote(""); setDecision({ r: detail, kind: "reject" }); }}>
                                            <X className="h-4 w-4 mr-1" aria-hidden="true" /> Reject
                                        </Button>
                                        <Button variant="destructive" disabled={!!doc?.impact?.blocker}
                                            onClick={() => { setNote(""); setDecision({ r: detail, kind: "approve" }); }}>
                                            <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Approve
                                        </Button>
                                    </>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!decision} onOpenChange={o => { if (!o && !busy) setDecision(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{decision?.kind === "approve" ? "Approve cancellation?" : "Reject request?"}</DialogTitle>
                        <DialogDescription>
                            {decision?.kind === "approve"
                                ? `${TYPE_LABEL[decision.r.doc_type] || decision?.r.doc_type} ${decision?.r.doc_no} will be cancelled. Stock, payments and accounts are reversed. This can't be undone.`
                                : `${decision?.r.doc_no} stays as it is. The requester sees your note.`}
                        </DialogDescription>
                    </DialogHeader>
                    {decision && (
                        <div className="rounded-md bg-muted/50 p-3 text-sm">
                            <span className="text-muted-foreground">Reason given: </span>{decision.r.reason}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="decision-note">Note (optional)</Label>
                        <Textarea id="decision-note" rows={3} value={note} maxLength={500} onChange={e => setNote(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Back</Button>
                        <Button variant={decision?.kind === "approve" ? "destructive" : "default"} onClick={confirmDecision} disabled={busy}>
                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {decision?.kind === "approve" ? "Approve & cancel" : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

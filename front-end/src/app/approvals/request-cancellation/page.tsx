"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { lookupDocument, processCancellation, getCancellationHistory, type CancelLookupResult } from "@/lib/api/cancellation";
import { AlertCircle, ArrowRight, ExternalLink, FileSearch, FileX, Info, Loader2, RefreshCw, Search } from "lucide-react";
import { ImpactPanel, ItemsTable, money, fmtDate, getDocUrl } from "../_components/doc-impact";

const DOC_TYPES: { value: string; label: string; placeholder: string }[] = [
    { value: "Invoice", label: "Customer invoice", placeholder: "e.g. INV-0001" },
    { value: "PaymentReceipt", label: "Payment receipt", placeholder: "e.g. RCP-0001" },
    { value: "Expense", label: "Expense / payment voucher", placeholder: "e.g. EXP-0001" },
    { value: "GRN", label: "Goods receive note (GRN)", placeholder: "e.g. GRN-0001" },
    { value: "VendorPayment", label: "Vendor payment", placeholder: "e.g. VP-0001" },
    { value: "Reservation", label: "Hotel reservation", placeholder: "e.g. RES-0001" },
];
const typeLabel = (t: string) => DOC_TYPES.find(d => d.value === t)?.label || t;

export default function RequestCancellationPage() {
    const { toast } = useToast();
    const [docType, setDocType] = useState("Invoice");
    const [docNumber, setDocNumber] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [docData, setDocData] = useState<CancelLookupResult | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [viewDoc, setViewDoc] = useState<any | null>(null);

    const fetchHistory = async (page = 1) => {
        setIsLoadingHistory(true);
        try {
            const res = await getCancellationHistory(page);
            if (res.status === "success") {
                setHistory(res.data);
                setCurrentPage(res.pagination.page);
                setTotalPages(Math.max(1, res.pagination.pages));
                setTotalRecords(res.pagination.total);
            }
        } catch (err) {
            console.error("History error:", err);
        } finally {
            setIsLoadingHistory(false);
        }
    };
    useEffect(() => { void fetchHistory(currentPage); }, [currentPage]);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!docNumber.trim()) return;
        setIsLoading(true); setError(null); setDocData(null); setReason("");
        try { setDocData(await lookupDocument(docType, docNumber.trim()) as any); }
        catch (err: any) { setError(err.message || "Document not found"); }
        finally { setIsLoading(false); }
    };

    const handleViewDetails = async (type: string, number: string) => {
        try { setViewDoc({ ...(await lookupDocument(type, number)), type }); }
        catch { toast({ title: "Couldn't load the document", variant: "destructive" }); }
    };

    const reasonOk = reason.trim().length >= 5;
    const handleRequest = async () => {
        if (!docData || !reasonOk) return;
        setIsCancelling(true);
        try {
            await processCancellation(docType, docData.id, reason.trim());
            toast({ title: "Cancellation requested", description: `${docData.number} will be cancelled once another user approves it.` });
            setDocData(null); setDocNumber(""); setReason("");
        } catch (err: any) {
            toast({ variant: "destructive", title: "Couldn't request", description: err.message || "Failed to request cancellation" });
        } finally {
            setIsCancelling(false);
        }
    };

    const isCancelled = docData && String(docData.status).toLowerCase() === "cancelled";
    const placeholder = DOC_TYPES.find(d => d.value === docType)?.placeholder || "Document number";

    return (
        <DashboardLayout>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Request Cancellation</h1>
                        <p className="text-sm text-muted-foreground mt-1">Find a document and say why it should be cancelled. Another user approves the request before anything is reversed.</p>
                    </div>
                    <Button variant="outline" asChild className="shrink-0">
                        <Link href="/approvals/cancellations">Cancellation requests <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" /></Link>
                    </Button>
                </div>

                {/* Find + request */}
                <Card className="overflow-hidden">
                    <form onSubmit={handleSearch} className="grid gap-3 border-b p-4 md:grid-cols-[260px_1fr_auto] md:items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="doc-type">Document type</Label>
                            <Select value={docType} onValueChange={v => { setDocType(v); setDocData(null); setError(null); }}>
                                <SelectTrigger id="doc-type" className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="doc-no">Document number</Label>
                            <Input id="doc-no" className="h-10" placeholder={placeholder} value={docNumber} onChange={e => setDocNumber(e.target.value)} autoComplete="off" />
                        </div>
                        <Button type="submit" className="h-10" disabled={isLoading || !docNumber.trim()}>
                            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" aria-hidden="true" />} Find
                        </Button>
                    </form>

                    <div className="p-4">
                        {error ? (
                            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
                            </div>
                        ) : !docData ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><FileSearch className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>
                                <p className="font-medium">Find a document to start</p>
                                <p className="text-sm text-muted-foreground max-w-md">Pick the type and enter its number. You'll see its details here before you request the cancellation.</p>
                            </div>
                        ) : (
                            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                                {/* Document summary */}
                                <div className="space-y-4 min-w-0">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">{typeLabel(docType)}</p>
                                            <h2 className="text-xl font-bold">{docData.number}</h2>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isCancelled ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>{docData.status}</span>
                                    </div>
                                    <dl className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-3">
                                        <div><dt className="text-xs text-muted-foreground">Party</dt><dd className="font-medium truncate">{docData.name || "—"}</dd></div>
                                        <div><dt className="text-xs text-muted-foreground">Date</dt><dd className="font-medium">{fmtDate(docData.date)}</dd></div>
                                        <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">LKR {money(docData.amount)}</dd></div>
                                    </dl>
                                    {!!docData.items?.length && <ItemsTable items={docData.items} />}
                                    {docData.impact && !isCancelled && <ImpactPanel impact={docData.impact} />}
                                    <Link href={getDocUrl(docType, docData.id)} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                        Open document <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>

                                {/* Request */}
                                <div className="rounded-md border bg-muted/20 p-4 space-y-3 h-fit">
                                    {isCancelled ? (
                                        <p className="text-sm text-muted-foreground">This document is already cancelled. Nothing to request.</p>
                                    ) : (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="reason">Reason <span className="text-destructive">*</span></Label>
                                                <Textarea id="reason" rows={4} maxLength={500} placeholder="Why should this be cancelled?" value={reason} onChange={e => setReason(e.target.value)} />
                                                <p className="text-xs text-muted-foreground">At least 5 characters. The approver sees this.</p>
                                            </div>
                                            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                                                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                Once approved, stock, payments and accounts are reversed. That can't be undone.
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => { setDocData(null); setReason(""); }} disabled={isCancelling}>Clear</Button>
                                                <Button variant="destructive" className="flex-1" disabled={!reasonOk || isCancelling || !!docData.impact?.blocker} onClick={handleRequest}>
                                                    {isCancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileX className="h-4 w-4 mr-2" aria-hidden="true" />}
                                                    Request cancellation
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Recently cancelled */}
                <Card className="overflow-hidden">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <h2 className="font-semibold">Recently cancelled</h2>
                        <Button variant="ghost" size="sm" onClick={() => void fetchHistory(currentPage)} disabled={isLoadingHistory}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingHistory ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium">Document</th>
                                    <th className="px-4 py-2.5 font-medium">Party</th>
                                    <th className="px-4 py-2.5 font-medium">Cancelled</th>
                                    <th className="px-4 py-2.5 font-medium">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoadingHistory && history.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No cancelled documents yet.</td></tr>
                                ) : history.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-muted/20">
                                        <td className="px-4 py-3">
                                            <button type="button" onClick={() => handleViewDetails(row.type, row.number)} className="font-semibold text-primary hover:underline">{row.number}</button>
                                            <div className="text-xs text-muted-foreground">{typeLabel(row.type)}</div>
                                        </td>
                                        <td className="px-4 py-3">{row.party || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(row.cancelled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
                                        <td className="px-4 py-3 max-w-[360px]"><p className="break-words">{row.reason}</p></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                        <span className="text-muted-foreground">{totalRecords} cancelled</span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={currentPage <= 1 || isLoadingHistory} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                            <span className="tabular-nums text-muted-foreground">{currentPage} / {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages || isLoadingHistory} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Cancelled document details */}
            <Dialog open={!!viewDoc} onOpenChange={o => !o && setViewDoc(null)}>
                <DialogContent className="sm:max-w-lg">
                    {viewDoc && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{viewDoc.number}</DialogTitle>
                                <DialogDescription>{typeLabel(viewDoc.type)} · {viewDoc.status}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                                <dl className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
                                    <div><dt className="text-xs text-muted-foreground">Party</dt><dd className="font-medium">{viewDoc.name || "—"}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">LKR {money(viewDoc.amount)}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Document date</dt><dd>{fmtDate(viewDoc.date)}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Cancelled</dt><dd>{viewDoc.cancelled_at ? new Date(viewDoc.cancelled_at).toLocaleString() : "—"}</dd></div>
                                </dl>
                                {!!viewDoc.items?.length && <ItemsTable items={viewDoc.items} />}
                                <div className="rounded-md bg-muted/50 p-3 text-sm">
                                    <span className="text-muted-foreground">Reason: </span>{viewDoc.cancellation_reason || "No reason recorded"}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" asChild>
                                    <Link href={getDocUrl(viewDoc.type, viewDoc.id)} target="_blank"><ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" /> Open document</Link>
                                </Button>
                                <Button onClick={() => setViewDoc(null)}>Close</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

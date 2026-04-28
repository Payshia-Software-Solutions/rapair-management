"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
    Card, 
    CardContent, 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
    lookupDocument, 
    processCancellation, 
    getCancellationHistory,
    CancelLookupResult 
} from "@/lib/api/cancellation";
import { 
    Search, 
    FileX, 
    Loader2, 
    AlertCircle, 
    History,
    FileText,
    Eye,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function DocumentCancellationPage() {
    const { toast } = useToast();
    const [docType, setDocType] = useState<string>("Invoice");
    const [docNumber, setDocNumber] = useState<string>("");
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

    // Summary View Dialog State
    const [viewDoc, setViewDoc] = useState<any | null>(null);
    const [isFetchingSummary, setIsFetchingSummary] = useState(false);

    const handleViewDetails = async (type: string, number: string) => {
        setIsFetchingSummary(true);
        try {
            const data = await lookupDocument(type, number);
            setViewDoc({ ...data, type });
        } catch (err: any) {
            toast({
                title: "View Failed",
                description: "Could not load document summary.",
                variant: "destructive"
            });
        } finally {
            setIsFetchingSummary(false);
        }
    };

    const fetchHistory = async (page = 1) => {
        setIsLoadingHistory(true);
        try {
            const res = await getCancellationHistory(page);
            if (res.status === 'success') {
                setHistory(res.data);
                setCurrentPage(res.pagination.page);
                setTotalPages(res.pagination.pages);
                setTotalRecords(res.pagination.total);
            }
        } catch (err: any) {
            console.error('History error:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory(currentPage);
    }, [currentPage]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!docNumber.trim()) return;

        setIsLoading(true);
        setError(null);
        setDocData(null);

        try {
            const data = await lookupDocument(docType, docNumber.trim());
            setDocData(data);
        } catch (err: any) {
            setError(err.message || 'Document not found');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!docData || !reason.trim()) return;

        setIsCancelling(true);
        try {
            await processCancellation(docType, docData.id, reason);
            toast({
                title: 'Document Cancelled',
                description: `Document ${docData.number} has been successfully reversed.`,
                className: 'bg-emerald-600 text-white border-none shadow-2xl shadow-emerald-200'
            });
            setDocData(null);
            setDocNumber('');
            setReason('');
            fetchHistory(currentPage);
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.message || 'Failed to cancel document'
            });
        } finally {
            setIsCancelling(false);
        }
    };

    const getDocUrl = (type: string, id: number) => {
        switch (type) {
            case 'Invoice': return `/cms/invoices/${id}`;
            case 'PaymentReceipt': return `/cms/payment-receipts/${id}`;
            case 'Reservation': return `/front-office/reservations/${id}`;
            case 'GRN': return `/inventory/grn/print/${id}`;
            case 'Expense': return `/accounting/expenses/print/${id}`;
            case 'VendorPayment': return `/vendors/payments/print/${id}`;
            default: return '#';
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <FileX className="w-7 h-7 text-rose-600" />
                            Document Cancellation Center
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">Standardized reversal utility for financial and inventory documents.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Side: Search */}
                    <Card className="lg:col-span-1 border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden rounded-3xl">
                        <div className="bg-slate-900 p-4 text-white">
                            <h2 className="text-sm font-bold flex items-center gap-2">
                                <Search className="w-4 h-4 text-rose-500" />
                                Lookup Document
                            </h2>
                        </div>
                        <CardContent className="p-4 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Document Category</Label>
                                <Select value={docType} onValueChange={(val) => { setDocType(val); setDocData(null); }}>
                                    <SelectTrigger className="h-10 font-semibold rounded-lg border-slate-200">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Invoice">Customer Invoice</SelectItem>
                                        <SelectItem value="PaymentReceipt">Payment Receipt</SelectItem>
                                        <SelectItem value="Expense">Expense / Payment Voucher</SelectItem>
                                        <SelectItem value="GRN">Goods Receive Note (GRN)</SelectItem>
                                        <SelectItem value="VendorPayment">Vendor Payment</SelectItem>
                                        <SelectItem value="Reservation">Hotel Reservation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <form onSubmit={handleSearch} className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Reference Number / ID</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="e.g. INV-0001" 
                                            className="h-10 font-semibold rounded-lg border-slate-200"
                                            value={docNumber}
                                            onChange={(e) => setDocNumber(e.target.value)}
                                        />
                                        <Button 
                                            type="submit"
                                            className="h-10 w-10 rounded-lg bg-slate-900"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </form>

                            {error && (
                                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 border border-rose-100 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm font-bold">{error}</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-dashed">
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-[10px] font-bold text-amber-900 leading-normal uppercase">
                                        Note: Cancellations are final. Reversal journal entries will be posted automatically.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right Side: Preview & Action */}
                    <div className="lg:col-span-2 space-y-6">
                        {docData ? (
                            <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden rounded-3xl animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="bg-rose-600 p-8 text-white relative overflow-hidden">
                                    <FileX className="absolute -right-4 -bottom-4 w-48 h-48 opacity-10 rotate-12" />
                                    <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold text-[10px] px-2 py-0.5">
                                                {docType} Found
                                            </Badge>
                                            <Badge className={`border-none font-bold text-[10px] px-2 py-0.5 ${
                                                docData.status === 'Cancelled' ? 'bg-black text-white' : 'bg-rose-900 text-rose-100'
                                            }`}>
                                                {docData.status}
                                            </Badge>
                                        </div>
                                        <h2 className="text-3xl font-bold tracking-tight">{docData.number}</h2>
                                        <div className="mt-4 grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase opacity-60">Party / Name</p>
                                                <p className="text-base font-semibold truncate">{docData.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase opacity-60">Date</p>
                                                <p className="text-base font-semibold">{docData.date ? new Date(docData.date).toLocaleDateString() : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase opacity-60">Total Amount</p>
                                                <p className="text-base font-bold">LKR {Number(docData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <CardContent className="p-6 space-y-6">
                                    {/* Line Items Section */}
                                    {docData.items && docData.items.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Document Items</Label>
                                            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                                        <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                                            <TableHead className="text-[9px] font-bold uppercase py-2">Description</TableHead>
                                                            <TableHead className="text-[9px] font-bold uppercase py-2 text-center">Qty</TableHead>
                                                            <TableHead className="text-[9px] font-bold uppercase py-2 text-right">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {docData.items.map((item: any, i: number) => (
                                                            <TableRow key={i} className="border-slate-100 dark:border-slate-800 text-[11px] h-10">
                                                                <TableCell className="py-2 font-medium">{item.description}</TableCell>
                                                                <TableCell className="py-2 text-center font-bold">{item.quantity}</TableCell>
                                                                <TableCell className="py-2 text-right font-black">
                                                                    {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {docData.status === 'Cancelled' ? (
                                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center space-y-2 border border-slate-200 dark:border-slate-800">
                                            <History className="w-8 h-8 text-slate-300 mx-auto" />
                                            <div className="space-y-1">
                                                <h4 className="text-base font-bold text-slate-900 dark:text-white">Already Cancelled</h4>
                                                <p className="text-xs font-medium text-slate-500">This document has already been processed and reversed.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Cancellation Reason</Label>
                                                <Textarea 
                                                    placeholder="Enter a detailed reason for this reversal..."
                                                    className="min-h-[80px] rounded-xl border-slate-200 font-medium resize-none focus:ring-rose-500"
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex items-center gap-3 pt-1">
                                                <Button 
                                                    disabled={!reason.trim() || isCancelling}
                                                    className="h-12 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-200 dark:shadow-none flex-1"
                                                    onClick={handleCancel}
                                                >
                                                    {isCancelling ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    ) : (
                                                        <FileX className="w-4 h-4 mr-2" />
                                                    )}
                                                    Confirm Cancellation
                                                </Button>
                                                <Button variant="outline" className="h-12 px-4 font-bold rounded-xl text-muted-foreground" onClick={() => setDocData(null)}>
                                                    Reset
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest">
                                                Warning: This action is permanent and will trigger financial reversals.
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="h-full min-h-[400px] bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mb-6">
                                    <FileText className="w-10 h-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-400">Waiting for lookup</h3>
                                <p className="text-sm text-slate-400 max-w-[280px] mt-2 font-medium">Select a category and enter a document number to begin the reversal process.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* History Section */}
                <Card className="border-none shadow-lg shadow-slate-200/50 dark:shadow-none overflow-hidden rounded-2xl">
                    <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
                        <h2 className="text-sm font-bold flex items-center gap-2">
                            <History className="w-4 h-4 text-rose-500" />
                            Recent Cancellations
                        </h2>
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-slate-400 hover:text-white" onClick={fetchHistory}>
                            <Loader2 className={`w-3 h-3 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                    <TableHead className="font-bold text-[10px] uppercase p-4">Type</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase p-4">Doc No</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase p-4">Party</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase p-4">Date</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase p-4">Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-8 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />
                                        </TableCell>
                                    </TableRow>
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-8 text-center font-bold text-slate-400 text-xs">
                                            No recent cancellations found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((row, idx) => (
                                        <TableRow key={idx} className="border-slate-100 dark:border-slate-800 text-xs">
                                            <TableCell className="p-4">
                                                <Badge className="bg-slate-100 text-slate-900 border-none font-bold text-[9px]">
                                                    {row.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-4 font-bold">
                                                <button 
                                                    onClick={() => handleViewDetails(row.type, row.number)}
                                                    className="hover:text-rose-600 hover:underline flex items-center gap-1 transition-colors"
                                                >
                                                    {row.number}
                                                    <Eye className="w-3 h-3 opacity-50" />
                                                </button>
                                            </TableCell>
                                            <TableCell className="p-4 font-semibold">{row.party}</TableCell>
                                            <TableCell className="p-4 text-muted-foreground">
                                                {new Date(row.cancelled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </TableCell>
                                            <TableCell className="p-4 text-rose-600 max-w-xs truncate font-medium" title={row.reason}>
                                                {row.reason}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        
                        <div className="p-4 border-t border-slate-50 dark:border-slate-900 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400">
                                Showing {history.length} of {totalRecords} records
                            </p>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 text-[10px] font-bold border-slate-100"
                                    disabled={currentPage === 1 || isLoadingHistory}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1 text-[10px] font-bold px-2">
                                    <span className="text-slate-900 dark:text-slate-200">{currentPage}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-slate-500">{totalPages}</span>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 text-[10px] font-bold border-slate-100"
                                    disabled={currentPage >= totalPages || isLoadingHistory}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Summary View Dialog */}
            <Dialog open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none rounded-3xl">
                    {viewDoc && (
                        <>
                            <div className="bg-slate-900 p-8 text-white relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <FileText className="w-24 h-24 rotate-12" />
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-rose-600 text-white border-none font-bold text-[10px] uppercase px-2 py-0.5">
                                            {viewDoc.type} Summary
                                        </Badge>
                                        <Badge className="bg-slate-800 text-slate-400 border-none font-bold text-[10px] uppercase px-2 py-0.5">
                                            {viewDoc.status}
                                        </Badge>
                                    </div>
                                    <h2 className="text-4xl font-bold tracking-tight">{viewDoc.number}</h2>
                                    <div className="pt-4 grid grid-cols-2 gap-8 border-t border-white/10">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-slate-500">Party / Name</p>
                                            <p className="text-lg font-semibold">{viewDoc.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-slate-500">Amount</p>
                                            <p className="text-lg font-black">LKR {Number(viewDoc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-white space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Dialog Line Items */}
                                {viewDoc.items && viewDoc.items.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                            <Layers className="w-3 h-3" /> Breakdown
                                        </p>
                                        <div className="border border-slate-50 rounded-2xl overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow className="hover:bg-transparent border-slate-50">
                                                        <TableHead className="text-[9px] font-bold uppercase h-8 py-0">Description</TableHead>
                                                        <TableHead className="text-[9px] font-bold uppercase h-8 py-0 text-center">Qty</TableHead>
                                                        <TableHead className="text-[9px] font-bold uppercase h-8 py-0 text-right">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {viewDoc.items.map((item: any, i: number) => (
                                                        <TableRow key={i} className="border-slate-50 text-[11px] h-10">
                                                            <TableCell className="py-1 font-medium">{item.description}</TableCell>
                                                            <TableCell className="py-1 text-center font-bold">{item.quantity}</TableCell>
                                                            <TableCell className="py-1 text-right font-black">
                                                                {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                        <p className="text-[10px] font-bold uppercase text-rose-500 mb-1 flex items-center gap-1">
                                            <History className="w-3 h-3" /> Cancellation Reason
                                        </p>
                                        <p className="text-sm font-semibold text-rose-900 italic leading-relaxed">
                                            "{viewDoc.cancellation_reason || 'No reason provided'}"
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between px-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Processed At</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {viewDoc.cancelled_at ? new Date(viewDoc.cancelled_at).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Document Date</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {viewDoc.date ? new Date(viewDoc.date).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl font-bold border-slate-200">
                                        <Link href={getDocUrl(viewDoc.type, viewDoc.id)}>
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            View Full Document
                                        </Link>
                                    </Button>
                                    <Button className="flex-1 h-12 rounded-xl bg-slate-900 font-bold" onClick={() => setViewDoc(null)}>
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

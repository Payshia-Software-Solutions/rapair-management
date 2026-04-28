"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api, fetchCompany } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft, FileText, CreditCard, ArrowUpRight } from "lucide-react";
import { amountToWords } from "@/lib/utils/number-to-words";
import { format } from "date-fns";

function money(n: number | string) {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return (Number.isFinite(v) ? v : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ExpensePrintPage() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = params?.id;
    const formatType = searchParams?.get("format") || "voucher";
    const autoPrint = searchParams?.get("autoprint") === "1";

    const [loading, setLoading] = useState(true);
    const [expense, setExpense] = useState<any>(null);
    const [company, setCompany] = useState<any>(null);
    const printedRef = useRef(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [expRes, compRes] = await Promise.all([
                    api(`/api/expense/get/${id}`),
                    fetchCompany()
                ]);
                const expData = await expRes.json();
                if (expData.status === 'success') setExpense(expData.data);
                setCompany(compRes);
            } catch (error) {
                console.error("Failed to load print data", error);
            } finally {
                setLoading(false);
            }
        };
        if (id) loadData();
    }, [id]);

    useEffect(() => {
        if (autoPrint && !loading && expense && !printedRef.current) {
            printedRef.current = true;
            setTimeout(() => window.print(), 500);
        }
    }, [autoPrint, loading, expense]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-semibold">Loading Document...</span>
            </div>
        );
    }

    if (!expense) {
        return <div className="p-20 text-center font-bold text-rose-500">Voucher not found</div>;
    }

    const words = amountToWords(expense.amount);

    const pageSizeCss = formatType === 'voucher'
        ? '@page { size: A5 landscape; margin: 8mm; }'
        : formatType === 'cheque'
            ? '@page { size: 8.5in 3.67in; margin: 0; }'
            : '@page { size: A4 portrait; margin: 10mm; }';

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white">
            <style jsx global>{`
                @media print {
                    ${pageSizeCss}
                    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* ── Screen Toolbar ── */}
            <div className="no-print sticky top-0 z-50 bg-white/90 backdrop-blur border-b px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-xs">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </Button>
                    <span className="text-[10px] text-muted-foreground">|</span>
                    <div className="flex items-center gap-1.5">
                        {formatType === 'voucher' && <FileText className="w-4 h-4 text-primary" />}
                        {formatType === 'cheque' && <CreditCard className="w-4 h-4 text-rose-500" />}
                        {formatType === 'tt' && <ArrowUpRight className="w-4 h-4 text-blue-500" />}
                        <span className="font-bold text-sm">
                            {formatType === 'voucher' ? 'Payment Voucher' : formatType === 'cheque' ? 'Bank Cheque' : 'TT Instruction Letter'}
                        </span>
                    </div>
                </div>
                <Button size="sm" onClick={() => window.print()} className="gap-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-black">
                    <Printer className="w-3.5 h-3.5" /> Print
                </Button>
            </div>

            {/* ── Content Area ── */}
            <div className="flex justify-center p-6 print:p-0">

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    PAYMENT VOUCHER — A5 Landscape (210mm × 148mm)
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {formatType === 'voucher' && (
                    <div className="bg-white w-[210mm] h-[148mm] shadow-xl print:shadow-none overflow-hidden flex flex-col">

                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-3 bg-slate-50 border-b-2 border-slate-200 shrink-0">
                            <div>
                                <div className="text-base font-extrabold uppercase tracking-tight leading-none text-slate-800">{company?.name || 'Company'}</div>
                                <div className="text-[9px] text-slate-400 mt-1 max-w-[260px] leading-snug">{company?.address}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-1">Payment Voucher</div>
                                <div className="text-xl font-extrabold tracking-tight leading-none text-primary">{expense.voucher_no}</div>
                            </div>
                        </div>

                        {/* Body — 2 column layout */}
                        <div className="flex-1 flex flex-col">

                            {/* Main content area: 2 columns */}
                            <div className="flex-1 grid grid-cols-2 divide-x divide-slate-200">

                                {/* LEFT COLUMN — Payee & Details */}
                                <div className="px-7 py-5 flex flex-col gap-4">
                                    <VField label="Date" value={format(new Date(expense.payment_date), "dd MMM yyyy")} size="lg" />
                                    <VField label="Payee / Recipient" value={expense.payee_name} bold size="lg" />
                                    <VField label="Expense Account" value={expense.expense_account_name} size="lg" />
                                    <div className="flex-1">
                                        <div className="text-[9px] font-bold text-slate-400 tracking-wider leading-none mb-1.5">Description / Notes</div>
                                        <div className="text-[12px] text-slate-600 leading-relaxed italic border border-slate-100 rounded-lg px-3 py-2 h-[calc(100%-20px)]">
                                            {expense.notes || '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN — Amount & Payment */}
                                <div className="px-7 py-5 flex flex-col gap-4">
                                    <div className="bg-slate-50 rounded-xl px-5 py-4 text-center border border-dashed border-slate-200">
                                        <div className="text-[9px] font-bold text-slate-400 tracking-wider mb-1">Amount (LKR)</div>
                                        <div className="text-3xl font-extrabold text-slate-900 leading-tight">{money(expense.amount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 tracking-wider mb-1">Amount in Words</div>
                                        <div className="text-[12px] font-bold text-slate-700 italic leading-snug bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{words}</div>
                                    </div>
                                    <VField label="Payment Method" value={expense.payment_method || 'Cash'} size="lg" />
                                    {(expense.reference_no || expense.cheque_no || expense.tt_ref_no) && (
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 tracking-wider leading-none mb-1.5">References</div>
                                            <div className="flex flex-wrap gap-2">
                                                {expense.reference_no && <Tag label="Ref" value={expense.reference_no} />}
                                                {expense.cheque_no && <Tag label="Cheque #" value={expense.cheque_no} color="rose" />}
                                                {expense.tt_ref_no && <Tag label="TT Ref" value={expense.tt_ref_no} color="blue" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Signatures — full width */}
                            <div className="grid grid-cols-3 gap-10 px-8 py-3 border-t border-slate-200 shrink-0">
                                <SigLine label="Prepared By" />
                                <SigLine label="Authorized By" />
                                <SigLine label="Received By" />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-1 bg-slate-50 text-center text-[8px] text-slate-300 font-semibold tracking-wider shrink-0 border-t border-slate-100">
                            Generated: {format(new Date(), "yyyy-MM-dd HH:mm")} • BizFlow ERP
                        </div>
                    </div>
                )}

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    CHEQUE — Standard cheque leaf
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {formatType === 'cheque' && (
                    <div className="relative w-[8.5in] h-[3.5in] bg-white border border-slate-200 shadow-xl print:border-none print:shadow-none overflow-hidden font-mono">
                        <div className="no-print absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-slate-200 text-xs font-bold text-center -rotate-12 border-4 border-dashed border-slate-100 px-8 py-4">CHEQUE ALIGNMENT PREVIEW</div>
                        </div>
                        <div className="absolute top-[30px] right-[45px] text-base font-bold tracking-[8px] uppercase">
                            {format(new Date(expense.payment_date), "ddMMyyyy")}
                        </div>
                        <div className="absolute top-[100px] left-[95px] text-lg font-bold uppercase">
                            {expense.payee_name}
                        </div>
                        <div className="absolute top-[148px] left-[105px] text-[13px] font-bold max-w-[480px] leading-snug uppercase">
                            *** {words} ***
                        </div>
                        <div className="absolute top-[138px] right-[55px] text-xl font-extrabold">
                            **{money(expense.amount)}**
                        </div>
                        <div className="absolute bottom-[18px] left-[140px] text-[9px] font-bold opacity-20 uppercase tracking-wider">
                            A/C Payee Only
                        </div>
                    </div>
                )}

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    TT INSTRUCTION LETTER — A4 Portrait (single page)
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {formatType === 'tt' && (
                    <div className="bg-white w-[210mm] h-[297mm] shadow-xl print:shadow-none overflow-hidden flex flex-col" style={{ fontSize: '11pt' }}>

                        {/* Company header */}
                        <div className="px-10 pt-8 pb-4 border-b-2 border-slate-800 shrink-0">
                            <div className="text-base font-extrabold uppercase tracking-tight">{company?.name || 'Company'}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5 max-w-sm leading-snug">{company?.address}</div>
                            <div className="flex gap-4 mt-0.5 text-[9px] text-slate-400">
                                {company?.phone && <span>Tel: {company.phone}</span>}
                                {company?.email && <span>Email: {company.email}</span>}
                            </div>
                        </div>

                        <div className="px-10 py-6 flex-1 flex flex-col leading-normal">

                            {/* Date */}
                            <div className="text-right mb-5">{format(new Date(), "MMMM dd, yyyy")}</div>

                            {/* Addressee */}
                            <div className="mb-4 leading-relaxed">
                                <div>To:</div>
                                <div>The Manager,</div>
                                <div className="font-bold">{expense.payment_account_name}</div>
                                <div>Colombo, Sri Lanka.</div>
                            </div>

                            {/* Subject */}
                            <div className="text-center font-extrabold uppercase underline underline-offset-4 mb-5 tracking-tight">
                                Re: Instruction to Effect Telegraphic Transfer (TT)
                            </div>

                            {/* Salutation + Body */}
                            <p className="mb-3">Dear Sir / Madam,</p>
                            <p className="mb-4 text-justify leading-relaxed">
                                We hereby authorize and instruct you to debit our account maintained with your bank and
                                effect a Telegraphic Transfer in favour of the beneficiary detailed below. Kindly process
                                the transfer at the earliest and acknowledge once the transaction has been executed.
                            </p>

                            {/* Details table */}
                            <table className="w-full border border-slate-200 mb-4">
                                <tbody>
                                    <TRow label="Beneficiary Name" value={expense.payee_name} />
                                    <TRow label="Beneficiary Address" value={expense.payee_address || 'As per invoice / contract'} />
                                    <TRow label="Transfer Amount" value={`LKR ${money(expense.amount)}`} bold />
                                    <TRow label="Amount in Words" value={words} italic />
                                    <TRow label="TT Reference / Swift" value={expense.tt_ref_no || expense.voucher_no} />
                                    <TRow label="Purpose of Payment" value={`${expense.expense_account_name} — Voucher ${expense.voucher_no}`} />
                                    <TRow label="Voucher Date" value={format(new Date(expense.payment_date), "dd MMMM yyyy")} />
                                </tbody>
                            </table>

                            <p className="mb-3 text-justify leading-relaxed">
                                We confirm that all information provided above is accurate and complete. The bank is hereby
                                authorized to effect the necessary currency conversions, if applicable, at the prevailing rate.
                            </p>

                            <p className="mt-6 mb-0.5">Thanking you,</p>
                            <p className="font-bold">Yours faithfully,</p>
                            <p className="font-extrabold mt-0.5">{company?.name}</p>

                            {/* Director Signature */}
                            <div className="mt-6 flex items-end justify-between">
                                <div className="w-64">
                                    <div className="h-10" />
                                    <div className="border-t border-slate-800 pt-1.5 font-extrabold text-slate-800">Director</div>
                                </div>

                                {/* Company Seal */}
                                <div className="border-2 border-dashed border-slate-200 rounded-lg w-36 h-24 flex items-center justify-center">
                                    <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Company Seal</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function VField({ label, value, bold, size }: { label: string; value: string; bold?: boolean; size?: string }) {
    return (
        <div>
            <div className="text-[9px] font-bold text-slate-400 tracking-wider leading-none mb-1">{label}</div>
            <div className={`${size === 'lg' ? 'text-[14px]' : 'text-[13px]'} ${bold ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'} leading-snug`}>{value}</div>
        </div>
    );
}

function Tag({ label, value, color }: { label: string; value: string; color?: string }) {
    const c = color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100';
    return <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded border ${c}`}>{label}: {value}</span>;
}

function SigLine({ label }: { label: string }) {
    return (
        <div className="text-center">
            <div className="border-b border-dotted border-slate-300 h-7 mb-1" />
            <div className="text-[9px] font-bold text-slate-400 tracking-wider">{label}</div>
        </div>
    );
}

function TRow({ label, value, bold, italic }: { label: string; value: string; bold?: boolean; italic?: boolean }) {
    return (
        <tr className="border-b border-slate-100">
            <td className="py-2 px-3 text-[11pt] font-bold text-slate-500 tracking-wider w-[220px] whitespace-nowrap bg-slate-50/50">{label}</td>
            <td className={`py-2 px-3 ${bold ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'} ${italic ? 'italic font-medium' : ''}`}>{value}</td>
        </tr>
    );
}

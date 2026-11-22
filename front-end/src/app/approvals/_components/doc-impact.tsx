"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { CancelImpact } from "@/lib/api/cancellation";

export const money = (v: any) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString() : "—";

export const getDocUrl = (type: string, id: number) => {
    switch (type) {
        case "Invoice": return `/cms/invoices/${id}/view`;
        case "PaymentReceipt": return `/cms/payment-receipts/${id}/print`;
        case "Reservation": return `/front-office/reservations/${id}`;
        case "GRN": return `/inventory/grn/print/${id}`;
        case "Expense": return `/accounting/expenses/print/${id}`;
        case "VendorPayment": return `/vendors/payments/print/${id}`;
        default: return "#";
    }
};

export function ItemsTable({ items }: { items: any[] }) {
    return (
        <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
                        <th className="px-3 py-2 text-right font-medium w-32">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {items.map((it, i) => (
                        <tr key={i}>
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(it.quantity)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(it.line_total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const qty = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

/** Payments, stock and journal entries that get reversed with an invoice. */
export function ImpactPanel({ impact }: { impact: CancelImpact }) {
    const [tab, setTab] = useState<"payments" | "stock" | "journals">("payments");
    const activePays = impact.payments.filter(p => String(p.status || "").toLowerCase() !== "cancelled");
    const sales = impact.stock.filter(s => Number(s.qty_change) < 0);
    const tabs = [
        { key: "payments" as const, label: "Payments", n: activePays.length },
        { key: "stock" as const, label: "Stock", n: sales.length },
        { key: "journals" as const, label: "Journal entries", n: impact.journals.length },
    ];
    const empty = (t: string) => <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t}</p>;

    return (
        <section className="space-y-2" aria-labelledby="impact-h">
            <div>
                <h3 id="impact-h" className="font-semibold">What gets reversed</h3>
                <p className="text-xs text-muted-foreground">Approving cancels all of this along with the invoice.</p>
            </div>
            {impact.blocker && (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {impact.blocker}
                </div>
            )}
            <div className="rounded-md border overflow-hidden">
                <div className="flex border-b bg-muted/30 overflow-x-auto" role="tablist">
                    {tabs.map(t => (
                        <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                            {t.label} <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">{t.n}</span>
                        </button>
                    ))}
                </div>

                {tab === "payments" && (impact.payments.length === 0 ? empty("No payments recorded on this invoice.") : (
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground"><tr>
                            <th className="px-3 py-2 text-left font-medium">Receipt</th>
                            <th className="px-3 py-2 text-left font-medium">Method</th>
                            <th className="px-3 py-2 text-left font-medium">Date</th>
                            <th className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr></thead>
                        <tbody className="divide-y">
                            {impact.payments.map(p => {
                                const done = String(p.status || "").toLowerCase() === "cancelled";
                                return (
                                    <tr key={p.id} className={done ? "text-muted-foreground" : ""}>
                                        <td className="px-3 py-2 font-medium">{p.receipt_no}{done && <span className="ml-2 text-xs">(already cancelled)</span>}</td>
                                        <td className="px-3 py-2">{p.payment_method}</td>
                                        <td className="px-3 py-2">{fmtDate(p.payment_date)}</td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${done ? "line-through" : ""}`}>{money(p.amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot><tr className="border-t font-semibold">
                            <td colSpan={3} className="px-3 py-2">Refund / reverse</td>
                            <td className="px-3 py-2 text-right tabular-nums">LKR {money(activePays.reduce((s, p) => s + Number(p.amount || 0), 0))}</td>
                        </tr></tfoot>
                    </table>
                ))}

                {tab === "stock" && (sales.length === 0 ? empty("No stock was taken by this invoice.") : (
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground"><tr>
                            <th className="px-3 py-2 text-left font-medium">Item</th>
                            <th className="px-3 py-2 text-left font-medium">Location</th>
                            <th className="px-3 py-2 text-left font-medium">Batch</th>
                            <th className="px-3 py-2 text-right font-medium">Back to stock</th>
                        </tr></thead>
                        <tbody className="divide-y">
                            {sales.map(s => (
                                <tr key={s.id}>
                                    <td className="px-3 py-2">{s.part_name || "—"}{s.movement_type !== "SALE" && <span className="ml-2 text-xs text-muted-foreground">{s.movement_type}</span>}</td>
                                    <td className="px-3 py-2">{s.location_name || "—"}</td>
                                    <td className="px-3 py-2">{s.batch_number || "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">+{qty(-Number(s.qty_change))} {s.unit || ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}

                {tab === "journals" && (impact.journals.length === 0 ? empty("No journal entries were posted for this invoice.") : (
                    <div className="divide-y">
                        {impact.journals.map(j => (
                            <div key={j.id} className="p-3 space-y-1.5">
                                <div className="flex flex-wrap justify-between gap-2 text-sm">
                                    <span className="font-medium">#{j.id} · {j.description}</span>
                                    <span className="text-muted-foreground">{fmtDate(j.entry_date)}</span>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-muted-foreground"><tr>
                                        <th className="py-1 text-left font-medium">Account</th>
                                        <th className="py-1 text-right font-medium w-28">Debit</th>
                                        <th className="py-1 text-right font-medium w-28">Credit</th>
                                    </tr></thead>
                                    <tbody>
                                        {j.lines.map((l, i) => (
                                            <tr key={i}>
                                                <td className="py-1">{l.account_code} · {l.account_name}</td>
                                                <td className="py-1 text-right tabular-nums">{Number(l.debit) ? money(l.debit) : ""}</td>
                                                <td className="py-1 text-right tabular-nums">{Number(l.credit) ? money(l.credit) : ""}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                        <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/20">A reversing entry (debits and credits swapped) is posted for each of these.</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

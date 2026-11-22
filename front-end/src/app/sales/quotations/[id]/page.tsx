"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchQuotationDetails, updateQuotationStatus, convertQuotationToInvoice } from "@/lib/api/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, LoadingState, EmptyState, SectionCard } from "@/components/page-shell";
import { ChevronLeft, Printer, CheckCircle2, XCircle, Loader2, Send, ArrowRight, Globe, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { format } from "date-fns";

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  Expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Converted: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};
const money = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeDate = (d: any) => { try { return d ? format(new Date(d), "dd MMM yyyy") : null; } catch { return null; } };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default function QuotationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setQuotation(await fetchQuotationDetails(id));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string) => {
    try {
      await updateQuotationStatus(id, status);
      toast({ title: "Updated", description: `Quotation marked as ${status}` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await convertQuotationToInvoice(id);
      toast({ title: "Invoice created", description: "The quotation was converted to an invoice." });
      router.push(`/cms/invoices/${res.data.invoice_id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <DashboardLayout><div><LoadingState label="Loading quotation…" /></div></DashboardLayout>;
  }

  if (!quotation) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <EmptyState title="Quotation not found" action={<Button asChild variant="outline"><Link href="/sales/quotations">Back to quotations</Link></Button>} />
        </div>
      </DashboardLayout>
    );
  }

  const status = quotation.status;
  const isIntl = Number(quotation.is_international) === 1;
  const expired = quotation.expiry_date && new Date(quotation.expiry_date) < new Date() && !["Accepted", "Converted"].includes(status);

  // The single next step that makes sense for this status, shown as the main button.
  const nextStep =
    status === "Accepted" ? (
      <Button onClick={handleConvert} disabled={converting}>
        {converting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />} Convert to invoice
      </Button>
    ) : status === "Draft" ? (
      <Button onClick={() => handleStatusChange("Sent")}><Send className="w-4 h-4 mr-2" /> Mark as sent</Button>
    ) : status === "Sent" ? (
      <Button onClick={() => handleStatusChange("Accepted")}><CheckCircle2 className="w-4 h-4 mr-2" /> Customer accepted</Button>
    ) : null;

  return (
    <DashboardLayout fullWidth={true}>
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/sales/quotations"><ChevronLeft className="w-4 h-4 mr-1" /> Quotations</Link>
        </Button>

        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              {quotation.quotation_no}
              <Badge variant="outline" className={`border-transparent ${STATUS_STYLE[status] || STATUS_STYLE.Draft}`}>{status}</Badge>
              {expired && <Badge variant="outline" className={`border-transparent ${STATUS_STYLE.Expired}`}>Past expiry</Badge>}
            </span>
          }
          description={`${quotation.customer_name || "Customer"} · issued ${safeDate(quotation.issue_date) || "—"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.open(`/sales/quotations/print/${id}`, "_blank")}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
              {nextStep}
              {status !== "Converted" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {status !== "Sent" && <DropdownMenuItem onClick={() => handleStatusChange("Sent")}><Send className="w-4 h-4 mr-2" /> Mark as sent</DropdownMenuItem>}
                    {status !== "Accepted" && <DropdownMenuItem onClick={() => handleStatusChange("Accepted")}><CheckCircle2 className="w-4 h-4 mr-2" /> Mark as accepted</DropdownMenuItem>}
                    {status !== "Rejected" && <DropdownMenuItem onClick={() => handleStatusChange("Rejected")}><XCircle className="w-4 h-4 mr-2" /> Mark as rejected</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          }
        />

        {status === "Converted" && (
          <div className="rounded-lg border bg-violet-500/10 px-4 py-3 text-sm">This quotation is already an invoice. Find it under Invoices.</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 space-y-5">
            <SectionCard title="Items" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                      <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(quotation.items || []).map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.description}</div>
                          {item.item_type && <div className="text-xs text-muted-foreground">{item.item_type}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{Number(item.quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{money(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Notes & terms">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{quotation.notes || "No notes."}</p>
            </SectionCard>
          </div>

          <div className="space-y-5 lg:sticky lg:top-4">
            <SectionCard title="Summary">
              <div className="divide-y">
                <Field label="Subtotal"><span className="tabular-nums">{money(quotation.subtotal)}</span></Field>
                {isIntl && (
                  <Field label={`Shipping${quotation.shipping_provider_name || quotation.provider_name ? ` (${quotation.shipping_provider_name || quotation.provider_name})` : ""}`}>
                    <span className="tabular-nums">{money(quotation.shipping_cost)}</span>
                  </Field>
                )}
                {(quotation.taxes || []).map((tax: any) => (
                  <Field key={tax.id} label={`${tax.tax_name} (${Number(tax.rate_percent)}%)`}><span className="tabular-nums">{money(tax.amount)}</span></Field>
                ))}
                <div className="flex justify-between items-baseline pt-3">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold tabular-nums">LKR {money(quotation.grand_total)}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Customer">
              <div className="space-y-1 text-sm">
                <div className="font-semibold text-base">{quotation.customer_name}</div>
                {quotation.customer_address && <div className="text-muted-foreground">{quotation.customer_address}</div>}
                {quotation.customer_phone && <div>{quotation.customer_phone}</div>}
                {quotation.customer_tax_no && <div className="text-muted-foreground">Tax no. {quotation.customer_tax_no}</div>}
              </div>
            </SectionCard>

            <SectionCard title="Details">
              <div className="divide-y">
                <Field label="Issued">{safeDate(quotation.issue_date) || "—"}</Field>
                <Field label="Valid until">
                  <span className={expired ? "text-red-600 dark:text-red-400" : ""}>{safeDate(quotation.expiry_date) || "No expiry"}</span>
                </Field>
                <Field label="Location">{quotation.location_name || "Main"}</Field>
              </div>
            </SectionCard>

            {isIntl && (
              <SectionCard title={<span className="flex items-center gap-2"><Globe className="w-4 h-4" /> International delivery</span>}>
                <div className="divide-y">
                  <Field label="Carrier">{quotation.shipping_provider_name || quotation.provider_name || "Standard"}</Field>
                  {quotation.shipping_costing_template_id && <Field label="Costing template">{quotation.costing_template_name || "Applied"}</Field>}
                  <Field label="Country">{quotation.shipping_country || "—"}</Field>
                  <div className="py-2 text-sm">
                    <div className="text-muted-foreground">Ship to</div>
                    <div className="mt-1 whitespace-pre-wrap">{quotation.shipping_address || "No address"}</div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

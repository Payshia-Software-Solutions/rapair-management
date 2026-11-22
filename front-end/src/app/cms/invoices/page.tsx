"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { FileText, Plus, Search, Eye, MoreHorizontal, Printer, RefreshCw, Wallet, AlertCircle, CheckCircle2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchInvoices } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table-pagination";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/page-shell";

const STATUS_STYLE: Record<string, string> = {
  Paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Unpaid: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const money = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadInvoices = async () => {
    setLoading(true);
    try {
      setInvoices(await fetchInvoices());
    } catch {
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadInvoices(); }, []);

  const balance = (inv: any) => Math.max(0, Number(inv.grand_total || 0) - Number(inv.paid_amount || 0));
  const isOverdue = (inv: any) => inv.status !== "Paid" && inv.status !== "Cancelled" && inv.due_date && String(inv.due_date).slice(0, 10) < today() && balance(inv) > 0.005;

  const stats = useMemo(() => {
    const live = invoices.filter(i => i.status !== "Cancelled");
    const owing = live.filter(i => balance(i) > 0.005);
    return {
      count: live.length,
      owingCount: owing.length,
      owing: owing.reduce((s, i) => s + balance(i), 0),
      overdue: live.filter(isOverdue),
      paid: live.filter(i => i.status === "Paid").length,
    };
  }, [invoices]);

  const filtered = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || [inv.invoice_no, inv.customer_name, inv.order_customer_name, inv.online_order_no].some(v => String(v || "").toLowerCase().includes(q));
    const matchS = status === "all" ? true
      : status === "Overdue" ? isOverdue(inv)
      : inv.status === status;
    return matchQ && matchS;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, status]);

  const chips: [string, number][] = [
    ["all", invoices.length],
    ["Unpaid", invoices.filter(i => i.status === "Unpaid").length],
    ["Partial", invoices.filter(i => i.status === "Partial").length],
    ["Overdue", stats.overdue.length],
    ["Paid", stats.paid],
    ["Cancelled", invoices.filter(i => i.status === "Cancelled").length],
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          title="Invoices"
          description="Bills raised to customers. Click a row to see it, take a payment or print."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/cms/invoices/recurring")}><Repeat className="w-4 h-4 mr-2" /> Recurring</Button>
              <Button onClick={() => router.push("/cms/invoices/new")}><Plus className="w-4 h-4 mr-2" /> New invoice</Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Invoices" value={stats.count} hint="Excluding cancelled" icon={<FileText className="w-4 h-4" />} />
          <StatCard label="Customers owe (LKR)" value={money(stats.owing)} hint={`${stats.owingCount} invoice(s)`} icon={<Wallet className="w-4 h-4" />} />
          <StatCard label="Overdue" value={stats.overdue.length} hint={`LKR ${money(stats.overdue.reduce((s, i) => s + balance(i), 0))}`} icon={<AlertCircle className="w-4 h-4" />} />
          <StatCard label="Fully paid" value={stats.paid} icon={<CheckCircle2 className="w-4 h-4" />} />
        </div>

        <Card className="p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search invoice no., customer or web order" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map(([s, n]) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`h-8 px-3 rounded-full border text-sm ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                {s === "all" ? "All" : s} <span className="ml-1 tabular-nums opacity-70">{n}</span>
              </button>
            ))}
          </div>
        </Card>

        {loading ? (
          <LoadingState label="Loading invoices…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={invoices.length ? "No invoices match" : "No invoices yet"}
            description={invoices.length ? "Try another search or status." : "Create an invoice, or convert a quotation."}
            action={!invoices.length ? <Button variant="outline" onClick={() => router.push("/cms/invoices/new")}>New invoice</Button> : undefined}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Invoice</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Due</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total</th>
                    <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((inv) => {
                    const overdue = isOverdue(inv);
                    const bal = balance(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/cms/invoices/${inv.id}/view`)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{inv.invoice_no}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.online_order_id ? `Web order ${inv.online_order_no || "#" + inv.online_order_id}` : inv.order_id ? `Repair order #${inv.order_id}` : "Counter"}
                          </div>
                        </td>
                        <td className="px-4 py-3">{inv.customer_name || inv.order_customer_name || "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-muted-foreground">{inv.issue_date || "—"}</td>
                        <td className={`px-4 py-3 hidden md:table-cell whitespace-nowrap ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>{inv.due_date || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className={`border-transparent ${STATUS_STYLE[inv.status] || STATUS_STYLE.Unpaid}`}>{inv.status}</Badge>
                          {overdue && <Badge variant="outline" className="ml-1 border-transparent bg-red-500/15 text-red-700 dark:text-red-300">Overdue</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(inv.grand_total)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium ${bal > 0.005 && inv.status !== "Cancelled" ? "" : "text-muted-foreground"}`}>
                          {inv.status === "Cancelled" ? "—" : money(bal)}
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => router.push(`/cms/invoices/${inv.id}/view`)}><Eye className="w-4 h-4 mr-2" /> Open</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/cms/invoices/${inv.id}/print?autoprint=1`, "_blank")}><Printer className="w-4 h-4 mr-2" /> Print invoice</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/cms/invoices/${inv.id}/tax-invoice?autoprint=1`, "_blank")}><FileText className="w-4 h-4 mr-2" /> Print tax invoice</DropdownMenuItem>
                              {inv.online_order_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => router.push(`/ecommerce/orders/view/${inv.online_order_id}`)}>Open web order</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

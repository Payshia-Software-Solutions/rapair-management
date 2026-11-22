"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchQuotations, updateQuotationStatus } from "@/lib/api/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/page-shell";
import {
  Search, FileText, Plus, MoreHorizontal, Printer, CheckCircle2, XCircle, Send, RefreshCw,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

// Status badge colours (theme-safe: tinted background + readable text).
const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  Expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Converted: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};
const STATUSES = Object.keys(STATUS_STYLE);

const money = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeDate = (d: any) => { try { return d ? format(new Date(d), "dd MMM yyyy") : "—"; } catch { return "—"; } };

export default function QuotationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const load = async () => {
    setLoading(true);
    try {
      setQuotations(await fetchQuotations());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateQuotationStatus(id, status);
      toast({ title: "Updated", description: `Quotation marked as ${status}` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    quotations.forEach(q => { c[q.status] = (c[q.status] || 0) + 1; });
    return c;
  }, [quotations]);
  const openValue = useMemo(() => quotations
    .filter(q => q.status === "Draft" || q.status === "Sent")
    .reduce((s, q) => s + Number(q.grand_total || 0), 0), [quotations]);

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase();
    const matchesSearch = !s || String(q.quotation_no || "").toLowerCase().includes(s) || String(q.customer_name || "").toLowerCase().includes(s);
    return matchesSearch && (statusFilter === "all" || q.status === statusFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  return (
    <DashboardLayout fullWidth={true}>
      <div className="space-y-5">
        <PageHeader
          title="Quotations"
          description="Price quotes sent to customers. Open one to print, email or turn it into an invoice."
          actions={
            <Button asChild>
              <Link href="/sales/quotations/create"><Plus className="w-4 h-4 mr-2" /> New quotation</Link>
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="All quotations" value={quotations.length} icon={<FileText className="w-4 h-4" />} />
          <StatCard label="Waiting on customer" value={(counts.Draft || 0) + (counts.Sent || 0)} hint={`LKR ${money(openValue)}`} icon={<Send className="w-4 h-4" />} />
          <StatCard label="Accepted" value={counts.Accepted || 0} icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="Converted to invoice" value={counts.Converted || 0} icon={<ChevronRight className="w-4 h-4" />} />
        </div>

        <Card className="p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search quotation no. or customer" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {/* Status chips: one tap filter, with counts */}
          <div className="flex flex-wrap gap-2">
            {["all", ...STATUSES].map(s => {
              const n = s === "all" ? quotations.length : (counts[s] || 0);
              const active = statusFilter === s;
              return (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className={`h-8 px-3 rounded-full border text-sm transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                  {s === "all" ? "All" : s} <span className={`ml-1 tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {loading ? (
          <LoadingState label="Loading quotations…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search || statusFilter !== "all" ? "No quotations match" : "No quotations yet"}
            description={search || statusFilter !== "all" ? "Try another search or status." : "Create your first quotation for a customer."}
            action={!search && statusFilter === "all" ? <Button asChild variant="outline"><Link href="/sales/quotations/create">New quotation</Link></Button> : undefined}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Quotation</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                    <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Valid until</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total (LKR)</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map(q => (
                    <tr key={q.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/sales/quotations/${q.id}`)}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{q.quotation_no}</td>
                      <td className="px-4 py-3">{q.customer_name || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-muted-foreground">{safeDate(q.issue_date)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap text-muted-foreground">{safeDate(q.expiry_date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`border-transparent ${STATUS_STYLE[q.status] || STATUS_STYLE.Draft}`}>{q.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">{money(q.grand_total)}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem asChild><Link href={`/sales/quotations/${q.id}`}><FileText className="w-4 h-4 mr-2" /> Open</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/sales/quotations/print/${q.id}`, "_blank")}><Printer className="w-4 h-4 mr-2" /> Print</DropdownMenuItem>
                            {q.status !== "Converted" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mark as</DropdownMenuLabel>
                                {q.status !== "Sent" && <DropdownMenuItem onClick={() => handleStatusChange(q.id, "Sent")}><Send className="w-4 h-4 mr-2" /> Sent</DropdownMenuItem>}
                                {q.status !== "Accepted" && <DropdownMenuItem onClick={() => handleStatusChange(q.id, "Accepted")}><CheckCircle2 className="w-4 h-4 mr-2" /> Accepted</DropdownMenuItem>}
                                {q.status !== "Rejected" && <DropdownMenuItem onClick={() => handleStatusChange(q.id, "Rejected")}><XCircle className="w-4 h-4 mr-2" /> Rejected</DropdownMenuItem>}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <span className="tabular-nums">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

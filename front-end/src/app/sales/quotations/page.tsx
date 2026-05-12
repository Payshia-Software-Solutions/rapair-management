"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchQuotations, updateQuotationStatus } from "@/lib/api/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  FileText, 
  Plus, 
  Loader2, 
  Filter, 
  MoreVertical, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { color: string, icon: any }> = {
  Draft: { color: "bg-slate-500", icon: Clock },
  Sent: { color: "bg-blue-500", icon: FileText },
  Accepted: { color: "bg-green-500", icon: CheckCircle2 },
  Rejected: { color: "bg-red-500", icon: XCircle },
  Expired: { color: "bg-orange-500", icon: Clock },
  Converted: { color: "bg-purple-500", icon: ArrowRightLeft },
};

export default function QuotationsPage() {
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchQuotations();
      setQuotations(data);
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

  const filtered = quotations.filter(q => {
    const matchesSearch = 
      q.quotation_no.toLowerCase().includes(search.toLowerCase()) ||
      q.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  return (
    <DashboardLayout fullWidth={true}>
      <div className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <FileText className="w-8 h-8 text-primary" /> Sales Quotations
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Manage and track your customer estimates</p>
          </div>
          <Link href="/sales/quotations/create">
            <Button className="h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Plus className="w-5 h-5 mr-2" /> New Quotation
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-2xl border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by number or customer..." 
              className="pl-10 h-11 border-none bg-muted/50 focus-visible:ring-primary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              className="h-11 px-4 rounded-md border bg-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button variant="outline" className="h-11" onClick={load}>
              <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Loading quotations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed py-20 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-primary/30" />
              </div>
              <h3 className="text-xl font-bold">No Quotations Found</h3>
              <p className="text-muted-foreground max-w-xs mt-2">
                {search || statusFilter !== "all" 
                  ? "No results match your filters. Try adjusting them." 
                  : "Start by creating your first quotation for a customer."}
              </p>
              {!search && statusFilter === "all" && (
                <Link href="/sales/quotations/create" className="mt-6">
                  <Button variant="outline">Create New Quotation</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3">
              {paginated.map((q) => {
              const status = STATUS_CONFIG[q.status] || STATUS_CONFIG.Draft;
              const StatusIcon = status.icon;
              return (
                <Card key={q.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                  <div className={`w-1 absolute left-0 top-0 bottom-0 ${status.color}`} />
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${status.color}/10 flex items-center justify-center`}>
                          <StatusIcon className={`w-6 h-6 ${status.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg tracking-tight">#{q.quotation_no}</h3>
                            <Badge className={`${status.color} hover:${status.color} border-none`}>
                              {q.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-bold text-muted-foreground">{q.customer_name}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:flex items-center gap-8 md:gap-12">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Total Amount</p>
                          <p className="font-black text-lg">LKR {Number(q.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Issue Date</p>
                          <p className="font-bold">{format(new Date(q.issue_date), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2 border-l pl-8 hidden md:flex">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-full">
                                <MoreVertical className="w-5 h-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2">
                              <DropdownMenuLabel>Quotation Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <Link href={`/sales/quotations/${q.id}`}>
                                <DropdownMenuItem className="gap-2 cursor-pointer">
                                  <FileText className="w-4 h-4 text-blue-500" /> View Details
                                </DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.open(`/sales/quotations/print/${q.id}`, '_blank')}>
                                <Printer className="w-4 h-4 text-orange-500" /> Print Quotation
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[10px] uppercase opacity-50">Change Status</DropdownMenuLabel>
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(q.id, 'Sent')}>
                                <FileText className="w-4 h-4 text-blue-500" /> Mark as Sent
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(q.id, 'Accepted')}>
                                <CheckCircle2 className="w-4 h-4 text-green-500" /> Mark as Accepted
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(q.id, 'Rejected')}>
                                <XCircle className="w-4 h-4 text-red-500" /> Mark as Rejected
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Link href={`/sales/quotations/${q.id}`}>
                            <Button size="icon" variant="secondary" className="rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          }
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-card p-4 rounded-2xl border shadow-sm mt-6">
              <p className="text-sm text-muted-foreground font-medium">
                Showing <span className="text-foreground font-bold">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-foreground font-bold">{Math.min(currentPage * pageSize, filtered.length)}</span> of <span className="text-foreground font-bold">{filtered.length}</span> entries
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Only show first, last, and pages around current
                    if (
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    } else if (
                      pageNum === currentPage - 2 || 
                      pageNum === currentPage + 2
                    ) {
                      return <span key={pageNum} className="px-1 text-muted-foreground text-xs">...</span>;
                    }
                    return null;
                  })}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-3"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
            )}
          </div>
        )
      }
    </div>
  </DashboardLayout>
);
}

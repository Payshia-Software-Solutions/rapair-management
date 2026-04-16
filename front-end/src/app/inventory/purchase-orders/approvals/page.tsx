"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchPurchaseOrders, 
  updatePurchaseOrderStatus, 
  type PurchaseOrderRow 
} from "@/lib/api";
import { 
  CheckCircle2, 
  FileText, 
  Search, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  Filter
} from "lucide-react";

export default function POApprovalsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPurchaseOrders("");
      // Only show Draft orders for approval
      const drafts = Array.isArray(data) 
        ? (data as PurchaseOrderRow[]).filter(po => String(po.status).toLowerCase() === "draft")
        : [];
      setRows(drafts);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load approval queue", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await updatePurchaseOrderStatus(String(id), "Approved");
      toast({ title: "Success", description: `Purchase Order #${id} has been approved.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Approval failed", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => 
      (r.po_number ?? "").toLowerCase().includes(q) || 
      (r.supplier_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.push("/inventory/purchase-orders")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                PO Approvals
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Review and approve pending purchase order drafts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Badge variant="secondary" className="px-3 py-1 bg-amber-100 text-amber-700 border-amber-200">
               {rows.length} Pending
             </Badge>
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by PO # or supplier..."
                  className="pl-9 h-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                  <Filter className="w-4 h-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Fetching approval queue...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold">No Pending Approvals</h3>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                  {query ? "No orders match your search criteria." : "All purchase orders are either approved, received, or cancelled."}
                </p>
                {query && (
                  <Button variant="outline" onClick={() => setQuery("")} className="mt-4">
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[120px]">PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((po) => (
                      <TableRow key={po.id} className="group hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary opacity-60" />
                            <span className="font-bold tabular-nums">{po.po_number}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{po.supplier_name}</TableCell>
                        <TableCell className="text-muted-foreground">{po.location_name}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {po.created_at ? new Date(po.created_at.replace(' ', 'T')).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              asChild
                            >
                              <Link href={`/inventory/purchase-orders/${po.id}`}>View Details</Link>
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                              onClick={() => onApprove(po.id)}
                              disabled={processingId === po.id}
                            >
                              {processingId === po.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

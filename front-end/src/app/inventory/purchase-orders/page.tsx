"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createPurchaseOrder,
  fetchParts,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchPartsForSupplier,
  fetchSuppliers,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  type PartRow,
  type PurchaseOrderItemRow,
  type PurchaseOrderRow,
  type SupplierRow,
} from "@/lib/api";
import { Search, Loader2, AlertCircle, FileText, Pencil, Printer, PackageCheck, Plus, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";



export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);


  const onPrint = (id: number) => {
    const url = `/inventory/purchase-orders/print/${encodeURIComponent(String(id))}?autoprint=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onReceive = (id: number) => {
    router.push(`/inventory/grn/new?po=${encodeURIComponent(String(id))}`);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [poRows, supRows] = await Promise.all([fetchPurchaseOrders(), fetchSuppliers()]);
      setRows(Array.isArray(poRows) ? poRows : []);
      setSuppliers(Array.isArray(supRows) ? supRows : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load purchase orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem("auth_token");
      if (!token) return;
      const part = token.split(".")[1];
      const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      setIsAdmin(String(json?.role ?? "") === "Admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const onApprove = async (id: number) => {
    try {
      await updatePurchaseOrderStatus(String(id), "Approved");
      toast({ title: "Approved", description: "Purchase order has been approved." });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Approval failed", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.po_number ?? "").toLowerCase().includes(q) || (r.supplier_name ?? "").toLowerCase().includes(q));
  }, [rows, query]);



  const quickStatus = async (id: number, status: string) => {
    if (!isAdmin) {
      toast({ title: "Forbidden", description: "Only Admin can update purchase order status.", variant: "destructive" });
      return;
    }
    try {
      await setPurchaseOrderStatus(String(id), status);
      toast({ title: "Updated", description: `Status set to ${status}` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update status", variant: "destructive" });
    }
  };



  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Create POs and receive items with GRN</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Link href="/inventory/purchase-orders/approvals">
                <CheckCircle2 className="w-4 h-4" />
                Approvals
              </Link>
            </Button>
          )}
          <Button asChild className="gap-2 bg-primary">
            <Link href="/inventory/purchase-orders/new">
              <Plus className="w-4 h-4" />
              New PO
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by PO number or supplier..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading purchase orders...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No purchase orders</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Create a PO to start purchasing inventory."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">GRN</TableHead>
                    <TableHead className="hidden md:table-cell">Ordered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po) => (
                    <TableRow key={po.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">{po.po_number}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">PO ID: #{po.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{po.supplier_name ?? po.supplier_id}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={po.status === 'Draft' ? 'secondary' : 'outline'}
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                            po.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            po.status === 'Received' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            po.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            po.status === 'Sent' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                            ''
                          }`}
                        >
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {po.last_grn_number ? (
                          <Badge variant="outline" className="text-[10px]">{po.last_grn_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {po.ordered_at ? new Date(po.ordered_at.replace(" ", "T")).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                           {isAdmin && String(po.status).toLowerCase() === "draft" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              asChild
                              title="Edit Draft PO"
                            >
                              <Link href={`/inventory/purchase-orders/${po.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onPrint(po.id)} title="Print">
                            <Printer className="w-4 h-4" />
                          </Button>
                           {isAdmin && po.status === 'Approved' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => onReceive(po.id)}
                              title="Receive Inventory (GRN)"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </Button>
                          ) : isAdmin && po.status === 'Draft' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => onApprove(po.id)}
                              title="Quick Approve"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          ) : isAdmin && po.status === 'Partially Received' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => onReceive(po.id)}
                              title="Continue Receiving"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </Button>
                          ) : null}

                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

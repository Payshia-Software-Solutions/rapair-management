"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Search, CheckCircle2, Car, ChevronRight, ArrowRight,
  Loader2, FileText, User, Hash, Gauge, CalendarDays, Tag, Phone,
  Building2, Plus, Fingerprint, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchOrders } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NewInvoiceSelectionPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => { loadCompletedOrders(); }, []);

  const loadCompletedOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data.filter((o: any) => o.status === "Completed"));
    } catch {
      toast({ title: "Error", description: "Failed to load eligible orders.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const customerName = o.customer_real_name || o.customer_name || "";
    const vehicleModel = o.vehicle_model_v || o.vehicle_model || "";
    return (
      String(o.id).includes(q) ||
      customerName.toLowerCase().includes(q) ||
      vehicleModel.toLowerCase().includes(q) ||
      o.vehicle_identifier?.toLowerCase().includes(q) ||
      o.vehicle_vin?.toLowerCase().includes(q)
    );
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleProceed = () => {
    if (!selectedOrderId) return;
    router.push(`/cms/invoices/create/${selectedOrderId}`);
  };

  const priorityBadge = (p: string) => {
    if (p === "High" || p === "Urgent") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30";
    if (p === "Medium") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30";
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-white/70 dark:border-white/10";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>CMS</span>
          <ChevronRight className="w-4 h-4" />
          <span>Invoices</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-foreground">Select Order</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-amber-500" />
              <span className="text-amber-600 text-sm font-semibold tracking-widest uppercase">Invoice Selection</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Create Invoice</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Select a completed repair order to generate an invoice.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/cms/invoices/create/standalone')}
              className="h-12 px-6 rounded-xl border-amber-200 dark:border-amber-400/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-bold transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Direct Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">

          {/* ── Order List ── */}
          <Card className="shadow-md border-0 bg-card flex flex-col h-[600px]">
            <CardHeader className="pb-4">
              <CardTitle>Completed Orders</CardTitle>
              <CardDescription>Only orders marked as 'Completed' are eligible for invoicing.</CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, Customer, or Vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span>Loading orders...</span>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                      <FileText className="w-8 h-8 opacity-20 mx-auto mb-3" />
                      <p>No completed orders found.</p>
                      <p className="text-xs mt-1 opacity-70">Complete an active job to invoice it.</p>
                    </div>
                  ) : (
                    filteredOrders.map((order) => {
                      const displayCustomerName = order.customer_real_name || order.customer_name || "—";
                      const displayVehicleModel = order.vehicle_model_v || order.vehicle_model || "Unknown Vehicle";
                      
                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedOrderId === order.id
                              ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                              : "hover:bg-muted/40 hover:border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
                                <Car className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">
                                  {displayCustomerName}
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5 truncate">
                                  {displayVehicleModel}
                                  {order.vehicle_identifier && (
                                    <span className="ml-2 font-mono text-xs opacity-70">
                                      · {order.vehicle_identifier}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground font-mono">ORDER #{order.id}</span>
                                  {order.priority && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityBadge(order.priority)}`}>
                                      {order.priority}
                                    </span>
                                  )}
                                  {order.department_name && (
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 px-1.5 py-0.5 rounded border flex items-center gap-1">
                                      <Building2 className="w-2.5 h-2.5" /> {order.department_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {selectedOrderId === order.id && (
                              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ── Selection Summary ── */}
          <div className="flex flex-col gap-6">
            <Card className="shadow-md border-0 bg-primary text-white flex-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <FileText className="w-64 h-64" />
              </div>
              <CardHeader>
                <CardTitle className="text-white text-2xl">Selection Summary</CardTitle>
                <CardDescription className="text-white/70">
                  Review the order details before proceeding to the invoice builder.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 relative z-10 pt-2">
                {selectedOrder ? (
                  <>
                    {/* Customer block */}
                    <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                      <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Customer
                      </div>
                      <div className="text-xl font-bold text-white leading-tight">
                        {selectedOrder.customer_real_name || selectedOrder.customer_name || "—"}
                      </div>
                      {(selectedOrder.customer_real_phone || selectedOrder.customer_phone) && (
                        <div className="flex items-center gap-1.5 text-white/70 text-sm mt-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {selectedOrder.customer_real_phone || selectedOrder.customer_phone}
                        </div>
                      )}
                    </div>

                    {/* Vehicle block */}
                    <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                      <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Car className="w-3 h-3" /> Vehicle Information
                      </div>
                      <div className="text-lg font-semibold text-white leading-tight">
                        {selectedOrder.vehicle_model_v || selectedOrder.vehicle_model || "Unknown Vehicle"}
                        {selectedOrder.vehicle_make && <span className="text-white/60 font-normal ml-2 text-sm">{selectedOrder.vehicle_make}</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-white/70 text-sm">
                          <Hash className="w-3.5 h-3.5" />
                          <span className="font-mono">
                            Vehicle Number: {selectedOrder.vehicle_identifier || "—"}
                          </span>
                        </div>
                        {selectedOrder.vehicle_vin && selectedOrder.vehicle_vin !== selectedOrder.vehicle_identifier && (
                          <div className="flex items-center gap-1.5 text-white/70 text-sm">
                            <Fingerprint className="w-3.5 h-3.5" />
                            <span className="font-mono">VIN: {selectedOrder.vehicle_vin}</span>
                          </div>
                        )}
                        {!!selectedOrder.mileage && (
                          <div className="flex items-center gap-1.5 text-white/70 text-sm">
                            <Gauge className="w-3.5 h-3.5" />
                            {Number(selectedOrder.mileage).toLocaleString()} km
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Department block */}
                    <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                      <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> Department
                      </div>
                      <div className="text-lg font-semibold text-white leading-tight">
                        {selectedOrder.department_name || "—"}
                      </div>
                    </div>

                    {/* Order meta block */}
                    <div className="rounded-xl bg-white/10 border border-white/10 p-4 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <Tag className="w-3 h-3" /> Order Info
                        </div>
                        <Badge className="bg-green-500/20 text-green-100 hover:bg-green-500/20 border-green-500/30">
                          {selectedOrder.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs">Order</span>
                        <span className="text-white font-mono font-bold text-sm">#{selectedOrder.id}</span>
                        {selectedOrder.priority && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ml-1 ${priorityBadge(selectedOrder.priority)}`}>
                            {selectedOrder.priority}
                          </span>
                        )}
                      </div>
                      {selectedOrder.completed_at && (
                        <div className="flex items-center gap-1.5 text-white/60 text-xs">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Completed: {new Date(selectedOrder.completed_at).toLocaleDateString()}
                        </div>
                      )}
                      {selectedOrder.problem_description && (
                        <div className="text-sm text-white/60 leading-relaxed line-clamp-2 pt-2 border-t border-white/10">
                          <span className="font-semibold text-white/80">Notes: </span>
                          {selectedOrder.problem_description}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-white/50 gap-3">
                    <FileText className="w-10 h-10 opacity-30" />
                    <p>Select an order from the list to preview its details.</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="relative z-10">
                <Button
                  onClick={handleProceed}
                  disabled={!selectedOrderId}
                  className="w-full h-14 text-lg font-bold bg-white text-primary hover:bg-white/90 shadow-xl transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  Proceed to Invoicing
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </CardFooter>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
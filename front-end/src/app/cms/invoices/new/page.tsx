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
import { PageHeader, SectionCard, LoadingState, EmptyState } from "@/components/page-shell";

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
    return "bg-muted text-muted-foreground border-transparent";
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5 w-full">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => router.push("/cms/invoices")}>
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Invoices
        </Button>

        <PageHeader
          title="New invoice"
          description="Pick a finished repair order to bill, or make a direct invoice for walk-in sales."
          actions={
            <Button variant="outline" onClick={() => router.push("/cms/invoices/create/standalone")}>
              <Plus className="w-4 h-4 mr-2" /> Direct invoice (no order)
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          <SectionCard
            className="lg:col-span-3"
            title="Completed repair orders"
            description="Only orders marked Completed can be invoiced."
            bodyClassName="p-0"
          >
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search order no., customer, vehicle no. or VIN" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" autoFocus />
              </div>
            </div>
            <ScrollArea className="h-[520px]">
              {loading ? (
                <LoadingState label="Loading orders…" />
              ) : filteredOrders.length === 0 ? (
                <div className="p-4">
                  <EmptyState title={orders.length ? "No orders match" : "No completed orders"} description={orders.length ? "Try another search." : "Finish a job first, or use Direct invoice."} />
                </div>
              ) : (
                <div className="divide-y">
                  {filteredOrders.map((order) => {
                    const active = selectedOrderId === order.id;
                    return (
                      <button
                        type="button"
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        onDoubleClick={() => router.push(`/cms/invoices/create/${order.id}`)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}
                      >
                        <div className="p-2 rounded-md bg-muted shrink-0"><Car className="w-4 h-4 text-muted-foreground" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{order.customer_real_name || order.customer_name || "—"}</span>
                            <span className="text-xs text-muted-foreground shrink-0">Order #{order.id}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {order.vehicle_model_v || order.vehicle_model || "Vehicle"}
                            {order.vehicle_identifier && <span className="font-mono"> · {order.vehicle_identifier}</span>}
                          </div>
                          {(order.priority || order.department_name) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {order.priority && <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityBadge(order.priority)}`}>{order.priority}</span>}
                              {order.department_name && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{order.department_name}</span>}
                            </div>
                          )}
                        </div>
                        {active && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </SectionCard>

          <div className="lg:col-span-2 lg:sticky lg:top-4">
            <SectionCard title="Selected order">
              {selectedOrder ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold">{selectedOrder.customer_real_name || selectedOrder.customer_name || "—"}</div>
                    {(selectedOrder.customer_real_phone || selectedOrder.customer_phone) && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5" />{selectedOrder.customer_real_phone || selectedOrder.customer_phone}</div>
                    )}
                  </div>
                  <div className="divide-y border-t">
                    {row("Order", `#${selectedOrder.id}`)}
                    {row("Vehicle", `${selectedOrder.vehicle_model_v || selectedOrder.vehicle_model || "—"}${selectedOrder.vehicle_make ? ` (${selectedOrder.vehicle_make})` : ""}`)}
                    {row("Vehicle no.", <span className="font-mono">{selectedOrder.vehicle_identifier || "—"}</span>)}
                    {selectedOrder.vehicle_vin && selectedOrder.vehicle_vin !== selectedOrder.vehicle_identifier && row("VIN", <span className="font-mono">{selectedOrder.vehicle_vin}</span>)}
                    {!!selectedOrder.mileage && row("Mileage", `${Number(selectedOrder.mileage).toLocaleString()} km`)}
                    {selectedOrder.department_name && row("Department", selectedOrder.department_name)}
                    {selectedOrder.completed_at && row("Completed", new Date(selectedOrder.completed_at).toLocaleDateString())}
                  </div>
                  {selectedOrder.problem_description && (
                    <p className="text-sm text-muted-foreground line-clamp-3"><span className="font-medium text-foreground">Job notes: </span>{selectedOrder.problem_description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Pick an order on the left. Double-click to go straight to the invoice.</p>
              )}
              <Button onClick={handleProceed} disabled={!selectedOrderId} className="w-full mt-4">
                Continue to invoice <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </SectionCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

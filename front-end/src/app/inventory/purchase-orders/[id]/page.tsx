"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { PurchaseOrderForm } from "@/components/inventory/PurchaseOrderForm";
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react";
import { fetchPurchaseOrder, type PurchaseOrderItemRow } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function EditPurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [poData, setPoData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const data: any = await fetchPurchaseOrder(id);
        const po = data?.purchase_order;
        const items = Array.isArray(data?.items) ? data.items : [];

        // Check status - only Draft can be edited
        if (String(po?.status ?? "").toLowerCase() !== "draft") {
          toast({ 
            title: "Access Denied", 
            description: `This Purchase Order is in '${po?.status}' status and cannot be edited.`, 
            variant: "destructive" 
          });
          router.push("/inventory/purchase-orders");
          return;
        }

        setPoData({
          supplier_id: String(po?.supplier_id ?? ""),
          notes: String(po?.notes ?? ""),
          ordered_at: po?.ordered_at ? po.ordered_at.split(' ')[0] : "",
          expected_at: po?.expected_at ? po.expected_at.split(' ')[0] : "",
          items: items.map((it: any) => ({
            id: Number(it.id),
            part_id: Number(it.part_id),
            qty_ordered: Number(it.qty_ordered ?? 0),
            unit_cost: Number(it.unit_cost ?? 0),
          })),
        });
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load Purchase Order", variant: "destructive" });
        router.push("/inventory/purchase-orders");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, router, toast]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Edit Purchase Order
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Update draft purchase order #{id}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-xl border border-dashed">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Loading PO details...</p>
          </div>
        ) : poData ? (
          <PurchaseOrderForm editId={id} initialData={poData} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-xl font-bold">Purchase Order Not Found</h3>
            <p className="text-muted-foreground mt-2">Could not retrieve details for PO #{id}</p>
            <Button onClick={() => router.push("/inventory/purchase-orders")} className="mt-6">
              Back to List
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

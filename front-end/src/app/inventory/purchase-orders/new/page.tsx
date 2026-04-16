"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { PurchaseOrderForm } from "@/components/inventory/PurchaseOrderForm";
import { ArrowLeft, FileText } from "lucide-react";

export default function NewPurchaseOrderPage() {
  const router = useRouter();

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
                New Purchase Order
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Create a purchase order with supplier and line items</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/purchase-orders">View All POs</Link>
          </Button>
        </div>

        <PurchaseOrderForm />
      </div>
    </DashboardLayout>
  );
}

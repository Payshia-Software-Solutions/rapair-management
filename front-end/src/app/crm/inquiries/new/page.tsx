"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { createInquiry } from "@/lib/api";
import { InquiryForm } from "@/components/crm/inquiry-form";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function NewInquiryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = async (data: any) => {
    try {
      const res = await createInquiry(data);
      if (res.status === 'success') {
        toast({ title: "Success", description: "Inquiry created successfully" });
        router.push("/crm/inquiries");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create inquiry", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Inquiry</h1>
            <p className="text-muted-foreground">Capture details for a new lead</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <InquiryForm 
            onSuccess={handleSuccess} 
            onCancel={() => router.push("/crm/inquiries")} 
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

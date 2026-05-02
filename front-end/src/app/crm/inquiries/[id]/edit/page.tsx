"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchInquiry, updateInquiry, Inquiry } from "@/lib/api";
import { InquiryForm } from "@/components/crm/inquiry-form";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";

export default function EditInquiryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInquiry = async () => {
      try {
        const res = await fetchInquiry(Number(id));
        if (res.status === 'success') {
          setInquiry(res.data);
        } else {
          toast({ title: "Error", description: "Inquiry not found", variant: "destructive" });
          router.push("/crm/inquiries");
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to load inquiry", variant: "destructive" });
        router.push("/crm/inquiries");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadInquiry();
  }, [id]);

  const handleSuccess = async (data: any) => {
    try {
      const res = await updateInquiry(Number(id), data);
      if (res.status === 'success') {
        toast({ title: "Success", description: "Inquiry updated successfully" });
        router.push("/crm/inquiries");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update inquiry", variant: "destructive" });
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
            <h1 className="text-3xl font-bold tracking-tight">Edit Inquiry</h1>
            <p className="text-muted-foreground">Update lead details: {inquiry?.inquiry_number}</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : inquiry ? (
            <InquiryForm 
              initialData={inquiry}
              onSuccess={handleSuccess} 
              onCancel={() => router.push("/crm/inquiries")} 
            />
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

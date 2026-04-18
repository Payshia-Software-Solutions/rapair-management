"use client"

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { LocationForm } from "@/components/admin/location-form";
import { fetchLocation, ServiceLocation } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EditLocationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [location, setLocation] = useState<ServiceLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    void (async () => {
      try {
        const data = await fetchLocation(id);
        setLocation(data);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        router.push("/admin/locations");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router, toast]);

  return (
    <DashboardLayout>
      <div className="py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground italic">Fetching location details...</p>
          </div>
        ) : location ? (
          <LocationForm initialData={location} isEdit={true} />
        ) : (
          <div className="text-center py-20">
             <p className="text-destructive font-bold">Location not found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

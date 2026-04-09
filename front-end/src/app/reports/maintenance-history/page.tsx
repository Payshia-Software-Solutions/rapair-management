"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReportShell } from "../_components/report-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { fetchVehicles } from "@/lib/api";
import { ArrowRight, Loader2 } from "lucide-react";

export default function MaintenanceHistoryLanding() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const rows = await fetchVehicles();
        setVehicles(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        setVehicles([]);
        toast({ title: "Error", description: e?.message || "Failed to load vehicles", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const options = useMemo(() => {
    return (vehicles ?? []).map((v: any) => ({
      value: String(v.id),
      label: `${v.make ?? ""} ${v.model ?? ""} (${v.vin ?? "VIN"})`,
      keywords: `${v.make ?? ""} ${v.model ?? ""} ${v.vin ?? ""}`,
    }));
  }, [vehicles]);

  const printHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("print", "1");
    qs.set("autoprint", "1");
    return `/reports/maintenance-history?${qs.toString()}`;
  }, []);

  return (
    <ReportShell
      title="Vehicle Maintenance History"
      subtitle="Pick a vehicle to view its job and parts history."
      actions={
        <>
          <Button asChild variant="outline"><Link href={printHref} target="_blank">Print</Link></Button>
          <Button asChild><Link href={printHref} target="_blank">Export PDF</Link></Button>
        </>
      }
    >
      {!isPrint ? (
        <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Select Vehicle</CardTitle>
          <CardDescription>Search by make/model/VIN</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 inline-block animate-spin mr-2" />
              Loading vehicles...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-9">
                <div className="text-xs text-muted-foreground mb-1">Vehicle</div>
                <SearchableSelect
                  value={vehicleId}
                  onValueChange={setVehicleId}
                  options={options}
                  placeholder="Search and select vehicle..."
                  searchPlaceholder="Search vehicles..."
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button asChild disabled={!vehicleId} className="w-full gap-2">
                  <Link href={vehicleId ? `/reports/vehicles/${encodeURIComponent(vehicleId)}/history` : "#"}>
                    Open History
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      ) : (
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">How To Use</CardTitle>
            <CardDescription>This report is printed per vehicle.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Open a specific vehicle history and print that page.
          </CardContent>
        </Card>
      )}
    </ReportShell>
  );
}

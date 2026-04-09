"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchOrders } from "@/lib/api";
import type { RepairOrder } from "@/lib/types";
import { CheckCircle2, ExternalLink, Loader2, Printer, Search } from "lucide-react";

function fmt(value?: string) {
  if (!value) return "-";
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function CompletedOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      const msg = (err as Error).message || "Failed to load completed orders";
      setLoadError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const completed = useMemo(() => orders.filter((o) => o.status === "Completed"), [orders]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return completed;
    return completed.filter((o) => {
      const hay = `${o.id} ${o.vehicleId ?? ""} ${o.problemDescription ?? ""} ${o.location ?? ""} ${o.technician ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [completed, q]);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-300" />
            Completed Orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Finished jobs are shown here (queue shows pending only)</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {completed.length} Completed
        </Badge>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>Vehicle, bay, technician, id</CardDescription>
          <div className="pt-3 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search completed orders..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Loading completed orders...</p>
            </div>
          ) : loadError ? (
            <div className="p-10 text-center">
              <div className="text-sm text-muted-foreground">{loadError}</div>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" onClick={() => void load()}>Retry</Button>
                <Button onClick={() => router.push("/orders")}>Go to Queue</Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No completed orders.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((o) => (
                <div key={o.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate">{o.vehicleId || `Order #${o.id}`}</div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300">Completed</Badge>
                      <span className="text-xs text-muted-foreground font-mono">#{o.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {o.problemDescription || "No description"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Completed: <span className="text-foreground">{fmt((o as any).completedAt || (o as any).updatedAt || "")}</span>
                      {o.location ? <span> · Bay: <span className="text-foreground">{o.location}</span></span> : null}
                      {o.technician ? <span> · Tech: <span className="text-foreground">{o.technician}</span></span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" className="gap-2" onClick={() => router.push(`/orders/${o.id}`)}>
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Button>
                    <Button variant="outline" className="gap-2" asChild>
                      <Link href={`/orders/print/${o.id}`} target="_blank">
                        <Printer className="w-4 h-4" />
                        Print
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}


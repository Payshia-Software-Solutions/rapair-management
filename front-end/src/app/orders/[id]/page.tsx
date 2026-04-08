"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchOrder, contentUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CalendarDays,
  Car,
  ChevronLeft,
  ClipboardList,
  Clock,
  Gauge,
  Hash,
  Loader2,
  Printer,
  Tag,
} from "lucide-react";
import { format } from "date-fns";

function parseMysqlDatetime(value: any): Date | null {
  if (!value || typeof value !== "string") return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const statusStyles: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-700",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

const priorityStyles: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-blue-100 text-blue-800",
  High: "bg-amber-100 text-amber-900",
  Urgent: "bg-red-100 text-red-800",
};

function timeRemaining(expectedAt: Date | null) {
  if (!expectedAt) return null;
  const ms = expectedAt.getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  const sign = ms < 0 ? -1 : 1;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return sign < 0 ? `Overdue by ${label}` : `${label} remaining`;
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const o = await fetchOrder(String(id));
        setOrder(o);
      } catch (e: any) {
        setOrder(null);
        setError(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const data = useMemo(() => {
    const o: any = order || {};
    const createdAt = parseMysqlDatetime(o.created_at);
    const expectedAt = parseMysqlDatetime(o.expected_time);

    return {
      id: o.id ?? id,
      status: String(o.status || "Pending"),
      priority: String(o.priority || "Medium"),
      vehicleModel: String(o.vehicle_model || "Repair Order"),
      vehicleIdentifier: String(o.vehicle_identifier || ""),
      mileage: o.mileage ?? null,
      problem: String(o.problem_description || ""),
      comments: String(o.comments || ""),
      createdAt,
      expectedAt,
      categories: safeJsonArray(o.categories_json),
      checklist: safeJsonArray(o.checklist_json),
      attachments: safeJsonArray(o.attachments_json),
    };
  }, [order, id]);

  const remaining = useMemo(() => timeRemaining(data.expectedAt), [data.expectedAt]);

  const onPrint = () => {
    const url = `/orders/print/${encodeURIComponent(String(data.id))}?autoprint=1`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) router.push(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading order...
        </div>
      </DashboardLayout>
    );
  }

  if (!order || error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Order Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error ? error : `The repair order ID ${id} does not exist.`}
          </p>
          <Button onClick={() => router.push("/orders")}>Back to Queue</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onPrint}>
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="p-0">
                <div className="p-6 bg-gradient-to-br from-primary/10 via-background to-background border-b">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="p-3 bg-white rounded-2xl shadow-sm shrink-0">
                          <Car className="w-8 h-8 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight truncate">{data.vehicleModel}</h1>
                            <Badge
                              variant="secondary"
                              className={cn(priorityStyles[data.priority] || "bg-slate-100 text-slate-700", "border-none")}
                            >
                              {data.priority}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-widest">
                            <span>Order</span>
                            <span>#{data.id}</span>
                          </div>
                          {data.vehicleIdentifier ? (
                            <div className="mt-1 text-xs text-muted-foreground truncate">{data.vehicleIdentifier}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className={cn(statusStyles[data.status] || "bg-slate-100 text-slate-700", "px-4 py-1 text-sm font-bold")}
                        >
                          {data.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div className="rounded-xl bg-white/70 border p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <Gauge className="w-3.5 h-3.5" />
                          Mileage
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {data.mileage ? `${Number(data.mileage).toLocaleString()} km` : "-"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/70 border p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Created
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {data.createdAt ? format(data.createdAt, "MMM d, yyyy HH:mm") : "-"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/70 border p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <Clock className="w-3.5 h-3.5" />
                          Expected
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {data.expectedAt ? format(data.expectedAt, "MMM d, yyyy HH:mm") : "-"}
                        </div>
                        {remaining ? (
                          <div className={cn("mt-1 text-xs", remaining.startsWith("Overdue") ? "text-red-700" : "text-muted-foreground")}>
                            {remaining}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl bg-white/70 border p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <Hash className="w-3.5 h-3.5" />
                          Checklist
                        </div>
                        <div className="mt-1 text-sm font-bold">{data.checklist.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        Problem Description
                      </CardTitle>
                      <CardDescription>Reported issue for this repair order</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border bg-muted/10 p-4 whitespace-pre-wrap min-h-[92px]">
                        {data.problem || "-"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        Comments
                      </CardTitle>
                      <CardDescription>Optional notes captured during intake</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border bg-muted/10 p-4 whitespace-pre-wrap min-h-[92px]">
                        {data.comments || "-"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <Card className="border shadow-none lg:col-span-5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Categories</CardTitle>
                      <CardDescription>Tags for reporting and routing</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.categories.length ? (
                        <div className="flex flex-wrap gap-2">
                          {data.categories.map((c) => (
                            <Badge key={c} variant="secondary" className="rounded-full">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No categories</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border shadow-none lg:col-span-7">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Checklist</CardTitle>
                      <CardDescription>Items to verify for this repair</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.checklist.length ? (
                        <ScrollArea className="h-[200px] pr-3">
                          <div className="space-y-2">
                            {data.checklist.map((c) => (
                              <label key={c} className="flex items-start gap-3 rounded-lg border bg-muted/5 p-3">
                                <Checkbox checked={false} disabled />
                                <div className="text-sm leading-tight">{c}</div>
                              </label>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-sm text-muted-foreground">No checklist items</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Attachments</CardTitle>
                    <CardDescription>Files uploaded to the content provider</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.attachments.length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.attachments.map((fn) => (
                          <a
                            key={fn}
                            href={contentUrl('orders', fn)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border bg-muted/5 px-3 py-2 text-sm hover:bg-muted/20 transition-colors"
                          >
                            {fn}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No attachments</div>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg text-white">Expected Completion</CardTitle>
                <CardDescription className="text-white/70">Estimated deadline for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-bold leading-none">
                      {data.expectedAt ? format(data.expectedAt, "HH:mm") : "-"}
                    </p>
                    <p className="text-xs text-white/70 truncate mt-1">
                      {data.expectedAt ? format(data.expectedAt, "EEEE, MMM d") : "Not set"}
                    </p>
                    {remaining ? (
                      <p className="text-xs mt-2 text-white/80">{remaining}</p>
                    ) : null}
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Status</p>
                  <p className="text-sm font-medium">{data.status}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Print or go back to queue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full gap-2" onClick={onPrint}>
                  <Printer className="w-4 h-4" />
                  Print Thermal Receipt
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => router.push("/orders")}>
                  <ChevronLeft className="w-4 h-4" />
                  Back to Orders
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

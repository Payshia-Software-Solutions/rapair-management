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
import {
  addOrderPart,
  contentUrl,
  deleteOrderPart,
  fetchOrder,
  fetchOrderParts,
  fetchParts,
  completeOrder,
  updateOrder,
  updateOrderRelease,
  updateOrderPart,
  type OrderPartRow,
  type PartRow,
} from "@/lib/api";
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
  CheckCircle2,
  Plus,
  Printer,
  Tag,
  Trash2,
  Boxes,
  MapPin,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function parseMysqlDatetime(value: any): Date | null {
  if (!value || typeof value !== "string") return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInputDateTime(value: any): string {
  if (!value || typeof value !== "string") return "";
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

type ChecklistDoneItem = { item: string; checked: boolean; comment?: string };

function safeChecklistDone(value: any): ChecklistDoneItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => ({
        item: String((v as any)?.item ?? ""),
        checked: Boolean((v as any)?.checked ?? false),
        comment: (v as any)?.comment ? String((v as any).comment) : "",
      }))
      .filter((v) => v.item);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return safeChecklistDone(parsed);
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [partsUsed, setPartsUsed] = useState<OrderPartRow[]>([]);
  const [partsMaster, setPartsMaster] = useState<PartRow[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPartId, setAddPartId] = useState<string>("");
  const [addQty, setAddQty] = useState<string>("1");
  const [savingPart, setSavingPart] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [checklistState, setChecklistState] = useState<ChecklistDoneItem[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [releaseTime, setReleaseTime] = useState("");
  const [savingRelease, setSavingRelease] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<string>("");

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

  const loadParts = async () => {
    if (!id) return;
    setPartsLoading(true);
    try {
      const [lines, master] = await Promise.all([fetchOrderParts(String(id)), fetchParts("")]);
      setPartsUsed(Array.isArray(lines) ? lines : []);
      setPartsMaster(Array.isArray(master) ? master : []);
    } catch (e: any) {
      setPartsUsed([]);
      toast({ title: "Inventory", description: e?.message || "Failed to load parts", variant: "destructive" });
    } finally {
      setPartsLoading(false);
    }
  };

  useEffect(() => {
    void loadParts();
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
      bay: String(o.location || ""),
      technician: String(o.technician || ""),
      createdAt,
      expectedAt,
      releaseAt: parseMysqlDatetime(o.release_time),
      releaseRaw: String(o.release_time || ""),
      categories: safeJsonArray(o.categories_json),
      checklist: safeJsonArray(o.checklist_json),
      checklistDone: safeChecklistDone(o.checklist_done_json),
      completionComments: String(o.completion_comments || ""),
      attachments: safeJsonArray(o.attachments_json),
    };
  }, [order, id]);

  const remaining = useMemo(() => timeRemaining(data.expectedAt), [data.expectedAt]);

  useEffect(() => {
    if (!order) return;
    const base = data.checklist.map((item) => ({
      item,
      checked: false,
      comment: "",
    }));
    if (data.checklistDone.length === 0) {
      setChecklistState(base);
    } else {
      const map = new Map(data.checklistDone.map((d) => [d.item, d]));
      const merged = base.map((b) => {
        const match = map.get(b.item);
        return match ? { ...b, checked: !!match.checked, comment: match.comment ?? "" } : b;
      });
      const extras = data.checklistDone.filter((d) => !data.checklist.includes(d.item));
      setChecklistState([...merged, ...extras]);
    }
    setCompletionNotes(data.completionComments || "");
    setReleaseTime(toInputDateTime(data.releaseRaw));
  }, [order, data.checklist, data.checklistDone, data.completionComments, data.releaseRaw]);

  const onPrint = () => {
    const url = `/orders/print/${encodeURIComponent(String(data.id))}?autoprint=1`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) router.push(url);
  };

  const handleStatusUpdate = async (nextStatus: string) => {
    if (!id) return;
    setSavingStatus(true);
    try {
      await updateOrder(String(id), { status: nextStatus });
      setOrder((prev: any) => ({ ...(prev || {}), status: nextStatus }));
      toast({ title: "Status updated", description: `Order marked ${nextStatus}.` });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Failed to update status", variant: "destructive" });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      await completeOrder(String(id), {
        status: "Completed",
        checklist_done: checklistState,
        completion_comments: completionNotes,
      });
      setOrder((prev: any) => ({
        ...(prev || {}),
        status: "Completed",
        checklist_done_json: JSON.stringify(checklistState),
        completion_comments: completionNotes,
      }));
      setCompleteOpen(false);
      toast({ title: "Completed", description: "Order marked Completed." });
      const url = `/orders/completion-print/${encodeURIComponent(String(id))}?autoprint=1`;
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) router.push(url);
    } catch (e: any) {
      toast({ title: "Complete failed", description: e?.message || "Failed to complete order", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const handleReleaseSave = async () => {
    if (!id) return;
    setSavingRelease(true);
    try {
      const payload = releaseTime ? releaseTime : null;
      await updateOrderRelease(String(id), payload);
      setOrder((prev: any) => ({ ...(prev || {}), release_time: payload }));
      toast({ title: "Release time updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Failed to update release time", variant: "destructive" });
    } finally {
      setSavingRelease(false);
    }
  };

  const totalParts = useMemo(() => {
    return partsUsed.reduce((sum, l) => sum + (l.line_total ? Number(l.line_total) : 0), 0);
  }, [partsUsed]);

  const checklistChecked = useMemo(() => checklistState.filter((c) => c.checked).length, [checklistState]);

  const openAddPart = () => {
    setAddPartId("");
    setAddQty("1");
    setAddOpen(true);
  };

  const submitAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(addPartId);
    const qty = Math.trunc(Number(addQty));
    if (!pid || qty <= 0) return;
    setSavingPart(true);
    try {
      await addOrderPart(String(id), { part_id: pid, quantity: qty });
      toast({ title: "Added", description: "Part issued to the order" });
      setAddOpen(false);
      await loadParts();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to add part", variant: "destructive" });
    } finally {
      setSavingPart(false);
    }
  };

  const startEditQty = (line: OrderPartRow) => {
    setEditingLineId(line.id);
    setEditQty(String(line.quantity ?? ""));
  };

  const saveEditQty = async () => {
    if (!editingLineId) return;
    const qty = Math.trunc(Number(editQty));
    if (qty <= 0) return;
    setSavingPart(true);
    try {
      await updateOrderPart(String(editingLineId), qty);
      toast({ title: "Updated", description: "Part quantity updated" });
      setEditingLineId(null);
      setEditQty("");
      await loadParts();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Update failed", variant: "destructive" });
    } finally {
      setSavingPart(false);
    }
  };

  const removeLine = async (line: OrderPartRow) => {
    if (!confirm(`Remove "${line.part_name ?? "item"}" from this order? Stock will be returned.`)) return;
    setSavingPart(true);
    try {
      await deleteOrderPart(String(line.id));
      toast({ title: "Removed", description: "Part removed from the order" });
      await loadParts();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Remove failed", variant: "destructive" });
    } finally {
      setSavingPart(false);
    }
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
            {data.status !== "Completed" && data.status !== "Cancelled" ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="w-4 h-4" />
                Complete Job
              </Button>
            ) : null}
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
                        <Select
                          value={data.status}
                          onValueChange={handleStatusUpdate}
                          disabled={savingStatus}
                        >
                          <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder="Update status" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Pending", "In Progress", "Completed", "Cancelled"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pt-2">
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
                          <MapPin className="w-3.5 h-3.5" />
                          Bay
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {data.bay ? data.bay : "Unassigned"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/70 border p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <User className="w-3.5 h-3.5" />
                          Technician
                        </div>
                        <div className="mt-1 text-sm font-bold">
                          {data.technician ? data.technician : "Unassigned"}
                        </div>
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
                      {checklistState.length ? (
                        <ScrollArea className="h-[240px] pr-3">
                          <div className="space-y-2">
                            {checklistState.map((c, idx) => (
                              <div key={`${c.item}-${idx}`} className="rounded-lg border bg-muted/5 p-3 space-y-2">
                                <label className="flex items-start gap-3">
                                  <Checkbox
                                    checked={c.checked}
                                    onCheckedChange={(v) => {
                                      const next = [...checklistState];
                                      next[idx] = { ...next[idx], checked: Boolean(v) };
                                      setChecklistState(next);
                                    }}
                                  />
                                  <div className="text-sm leading-tight font-medium">{c.item}</div>
                                </label>
                                <Input
                                  placeholder="Optional comment"
                                  value={c.comment ?? ""}
                                  onChange={(e) => {
                                    const next = [...checklistState];
                                    next[idx] = { ...next[idx], comment: e.target.value };
                                    setChecklistState(next);
                                  }}
                                />
                              </div>
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
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-muted-foreground" />
                        Parts Used
                      </CardTitle>
                      <CardDescription>Items issued to this repair order (stock is deducted)</CardDescription>
                    </div>
                    <Button onClick={openAddPart} className="gap-2" disabled={partsLoading || savingPart}>
                      <Plus className="w-4 h-4" />
                      Add Part
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {partsLoading ? (
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading parts...
                      </div>
                    ) : partsUsed.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No parts issued yet</div>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="w-[120px]">Qty</TableHead>
                              <TableHead className="hidden md:table-cell w-[140px]">Unit Price</TableHead>
                              <TableHead className="w-[140px]">Total</TableHead>
                              <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {partsUsed.map((l) => {
                              const isEditing = editingLineId === l.id;
                              return (
                                <TableRow key={l.id}>
                                  <TableCell>
                                    <div className="font-semibold">{l.part_name ?? `Part #${l.part_id}`}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                      {l.sku ? `SKU: ${l.sku}` : `LINE ID: #${l.id}`}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input value={editQty} onChange={(e) => setEditQty(e.target.value)} inputMode="numeric" />
                                    ) : (
                                      <div className="font-bold">
                                        {Number(l.quantity ?? 0).toLocaleString()} {l.unit ? <span className="text-xs text-muted-foreground font-normal">{l.unit}</span> : null}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    <span className="text-sm text-muted-foreground">{l.unit_price !== null ? Number(l.unit_price).toFixed(2) : "-"}</span>
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {l.line_total !== null ? Number(l.line_total).toFixed(2) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <div className="inline-flex items-center gap-2 justify-end">
                                        <Button size="sm" onClick={() => void saveEditQty()} disabled={savingPart}>Save</Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingLineId(null)} disabled={savingPart}>Cancel</Button>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-2 justify-end">
                                        <Button size="sm" variant="outline" onClick={() => startEditQty(l)} disabled={savingPart}>Edit</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void removeLine(l)} disabled={savingPart}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow>
                              <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="font-bold">{totalParts.toFixed(2)}</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

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
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Release Time</CardTitle>
                <CardDescription>Set the planned release time (can differ from expected time)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="datetime-local"
                  value={releaseTime}
                  onChange={(e) => setReleaseTime(e.target.value)}
                />
                <Button className="w-full" onClick={handleReleaseSave} disabled={savingRelease}>
                  {savingRelease ? "Saving..." : "Save Release Time"}
                </Button>
              </CardContent>
            </Card>

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
                    {data.releaseAt ? (
                      <p className="text-xs mt-2 text-white/80">
                        Release: {format(data.releaseAt, "MMM d, HH:mm")}
                      </p>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <form onSubmit={submitAddPart}>
            <DialogHeader>
              <DialogTitle>Add Part</DialogTitle>
              <DialogDescription>Select an item and quantity to issue to this order.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Item</Label>
                <div className="col-span-3">
                  <Select value={addPartId} onValueChange={setAddPartId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {partsMaster.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.sku ? `${p.part_name} (${p.sku})` : p.part_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="qty" className="text-right">Qty</Label>
                <Input
                  id="qty"
                  className="col-span-3"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  inputMode="numeric"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPart}>
                {savingPart && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
            <DialogDescription>Confirm completion details and generate the A4 completion document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-center justify-between">
              <span>Checklist checked</span>
              <span className="font-semibold">{checklistChecked} / {checklistState.length}</span>
            </div>
            <div className="space-y-2">
              <Label>Completion Notes</Label>
              <Textarea
                placeholder="Optional completion notes for the report..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleComplete} disabled={completing}>
              {completing ? "Completing..." : "Complete & Print"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

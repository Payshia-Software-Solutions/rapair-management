"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { createStockAdjustmentBatchForLocation, fetchLocations, fetchParts, type PartRow } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  MapPin,
  MinusCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Line = { key: string; part_id: number; physical_stock: number | ""; notes?: string; include_when_zero?: boolean };

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function newKey() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (globalThis as any)?.crypto?.randomUUID?.() ?? `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export default function NewStockAdjustmentPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<PartRow[]>([]);

  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [locationId, setLocationId] = useState<number | null>(null);

  const [adjustedAt, setAdjustedAt] = useState(nowLocalDatetime());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [activeLineKey, setActiveLineKey] = useState<string | null>(null);

  // Add-item picker (adds a new line)
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  // Row editor picker (changes item for an existing line)
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState("");

  const preselectPartId = useMemo(() => {
    const raw = sp?.get("part_id") ?? "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sp]);

  useEffect(() => {
    // Load allowed locations (admin: all locations; non-admin: allowed_locations from JWT)
    const LS_LOC_KEY = "stock_adj_location_id";
    const decodeJwtPayload = (token: string) => {
      try {
        const part = token.split(".")[1];
        return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      } catch {
        return null;
      }
    };

    void (async () => {
      try {
        const token = window.localStorage.getItem("auth_token") ?? "";
        const payload = token ? decodeJwtPayload(token) : null;
        const role = String(payload?.role ?? "");
        const lsLoc = Number(window.localStorage.getItem(LS_LOC_KEY) ?? "");
        const fallbackLoc = Number(window.localStorage.getItem("location_id") ?? "");

        if (role === "Admin") {
          const locs = await fetchLocations();
          const cleaned = Array.isArray(locs)
            ? locs.map((l: any) => ({ id: Number(l?.id), name: String(l?.name ?? "") })).filter((x: any) => x.id > 0 && x.name)
            : [];
          setLocations(cleaned);
          const init = Number.isFinite(lsLoc) && lsLoc > 0 ? lsLoc : (Number.isFinite(fallbackLoc) && fallbackLoc > 0 ? fallbackLoc : null);
          setLocationId(init && cleaned.some((l: any) => l.id === init) ? init : (cleaned[0]?.id ?? null));
          return;
        }

        const allowed = Array.isArray(payload?.allowed_locations)
          ? payload.allowed_locations
              .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
              .filter((x: any) => x.id > 0 && x.name)
          : [];
        const tokenLocId = payload?.location_id ? Number(payload.location_id) : 1;
        const tokenLocName = payload?.location_name ? String(payload.location_name) : "Main";
        const finalAllowed = allowed.length > 0 ? allowed : [{ id: tokenLocId, name: tokenLocName }];
        setLocations(finalAllowed);
        const init = Number.isFinite(lsLoc) && lsLoc > 0 ? lsLoc : (Number.isFinite(fallbackLoc) && fallbackLoc > 0 ? fallbackLoc : tokenLocId);
        setLocationId(finalAllowed.some((l: any) => l.id === init) ? init : finalAllowed[0].id);
      } catch {
        setLocations([]);
        setLocationId(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!locationId) return;
    try {
      window.localStorage.setItem("stock_adj_location_id", String(locationId));
    } catch {}
  }, [locationId]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const p = await fetchParts("");
        setParts(Array.isArray(p) ? p : []);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load items", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!preselectPartId) return;
    setLines([{ key: newKey(), part_id: preselectPartId, physical_stock: "", notes: "" }]);
  }, [preselectPartId]);

  const addEmptyLine = () => setLines((p) => [...p, { key: newKey(), part_id: 0, physical_stock: "", notes: "" }]);
  const removeLine = (key: string) => setLines((p) => p.filter((x) => x.key !== key));

  const setOtherItemsToZero = (keepKey?: string | null) => {
    // This is meant for full stock-take style adjustments:
    // keep the selected line's physical stock as-is, and ensure every other product exists with physical stock = 0.
    const fallbackKey =
      keepKey ??
      activeLineKey ??
      (lines.find((l) => Number(l.part_id) > 0)?.key ?? null) ??
      (lines[0]?.key ?? null);

    if (!fallbackKey) {
      toast({ title: "Add an item first", description: "Add at least 1 item before using this action.", variant: "destructive" });
      return;
    }

    const keep = lines.find((l) => l.key === fallbackKey) ?? null;
    if (!keep) return;

    // If the "keep" line doesn't have an item yet, fall back to the first item line.
    const keepFinalKey =
      Number(keep.part_id) > 0 ? keep.key : (lines.find((l) => Number(l.part_id) > 0)?.key ?? keep.key);

    const existingByPartId = new Map<number, (typeof lines)[number]>();
    for (const ln of lines) {
      if (Number(ln.part_id) > 0) existingByPartId.set(Number(ln.part_id), ln);
    }

    const keepLine = lines.find((l) => l.key === keepFinalKey) ?? keep;
    const keepPartId = Number(keepLine.part_id) > 0 ? Number(keepLine.part_id) : null;

    // Build the next lines list in one pass to avoid many state updates.
    const out: (typeof lines)[number][] = [];

    // 1) Ensure every part exists
    for (const p of parts) {
      const pid = Number((p as any)?.id);
      if (!Number.isFinite(pid) || pid <= 0) continue;

      const existing = existingByPartId.get(pid);
      if (existing) {
        if (keepPartId !== null && pid === keepPartId && existing.key === keepFinalKey) {
          out.push({ ...existing, include_when_zero: false });
        } else {
          out.push({ ...existing, physical_stock: 0, include_when_zero: true });
        }
      } else {
        out.push({
          key: newKey(),
          part_id: pid,
          physical_stock: 0,
          notes: "",
          include_when_zero: true,
        });
      }
    }

    // 2) Preserve any "empty" (part_id=0) lines the user added manually, but put them at the end.
    for (const ln of lines) {
      if (!(Number(ln.part_id) > 0)) out.push(ln);
    }

    // Keep selection stable.
    setActiveLineKey(keepFinalKey);
    setLines(out);
    toast({ title: "Updated", description: `Added ${Math.max(0, out.length - lines.length)} items and set others to 0` });
  };

  const filteredAddParts = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) => {
      const name = String(p.part_name ?? "").toLowerCase();
      const sku = String(p.sku ?? "").toLowerCase();
      const unit = String(p.unit ?? "").toLowerCase();
      return name.includes(q) || sku.includes(q) || unit.includes(q) || String(p.id).includes(q);
    });
  }, [parts, addQuery]);

  const filteredEditParts = useMemo(() => {
    const q = editQuery.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) => {
      const name = String(p.part_name ?? "").toLowerCase();
      const sku = String(p.sku ?? "").toLowerCase();
      const unit = String(p.unit ?? "").toLowerCase();
      return name.includes(q) || sku.includes(q) || unit.includes(q) || String(p.id).includes(q);
    });
  }, [parts, editQuery]);

  const openAddItem = () => {
    setAddQuery("");
    setAddOpen(true);
  };

  const addPart = (pid: number) => {
    if (pid <= 0) return;
    const exists = lines.some((l) => String(l.part_id) === String(pid));
    if (exists) {
      toast({ title: "Already added", description: "That item is already in this adjustment." });
      setAddOpen(false);
      return;
    }
    setLines((p) => [...p, { key: newKey(), part_id: pid, physical_stock: "", notes: "" }]);
    setAddOpen(false);
  };

  const changePart = (key: string, pid: number) => {
    if (pid <= 0) return;
    const exists = lines.some((l) => l.key !== key && String(l.part_id) === String(pid));
    if (exists) {
      toast({ title: "Already added", description: "That item is already in this adjustment." });
      setEditKey(null);
      return;
    }
    setLines((p) => p.map((x) => (x.key === key ? { ...x, part_id: pid } : x)));
    setEditKey(null);
  };

  const submit = async () => {
    const clean = lines
      .map((l) => ({
        part_id: Number(l.part_id),
        physical_stock:
          l.physical_stock === ""
            ? null
            : Math.round(Number(l.physical_stock) * 1000) / 1000,
        notes: l.notes?.trim() ? l.notes.trim() : undefined,
        include_when_zero: Boolean(l.include_when_zero),
      }))
      .filter((l) => l.part_id > 0 && l.physical_stock !== null)
      .map((l) => ({
        part_id: l.part_id,
        physical_stock: l.physical_stock as number,
        notes: l.notes,
        include_when_zero: l.include_when_zero,
      }));

    if (clean.length === 0) {
      toast({ title: "Validation", description: "Add at least 1 item and enter physical stock", variant: "destructive" });
      return;
    }

    // Open a placeholder tab synchronously (still part of the click event),
    // so browsers don't block it as a popup after the async API call.
    let printTab: Window | null = null;
    try {
      printTab = window.open("about:blank", "_blank", "noopener,noreferrer");
      if (printTab && printTab.document) {
        printTab.document.title = "Preparing Print...";
        printTab.document.body.innerHTML =
          "<div style='font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 20px; color: #334155'>Preparing print...</div>";
      }
    } catch {
      printTab = null;
    }

    setSaving(true);
    try {
      const res = await createStockAdjustmentBatchForLocation(
        {
        adjusted_at: adjustedAt ? adjustedAt : undefined,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        items: clean,
        },
        locationId ?? undefined
      );
      const id = (res as any)?.data?.id;
      toast({ title: "Created", description: "Stock adjustment created" });

      if (id) {
        const url = `/inventory/stock/adjustments/print/${encodeURIComponent(String(id))}?autoprint=1${
          locationId ? `&loc=${encodeURIComponent(String(locationId))}` : ""
        }`;
        if (printTab && !printTab.closed) {
          printTab.location.href = url;
        } else {
          const w = window.open(url, "_blank", "noopener,noreferrer");
          printTab = w ?? null;
        }
        if (!printTab) {
          toast({
            title: "Popup blocked",
            description: "Allow popups to auto-open the print page.",
            variant: "destructive",
          });
        }
      } else {
        if (printTab && !printTab.closed) {
          try {
            printTab.close();
          } catch {
            // ignore
          }
        }
      }

      router.push(`/inventory/stock/adjustments/${encodeURIComponent(String(id))}`);
    } catch (e: any) {
      if (printTab && !printTab.closed) {
        try {
          printTab.close();
        } catch {
          // ignore
        }
      }
      toast({ title: "Error", description: e?.message || "Create failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <ArrowLeftRight className="w-6 h-6 text-primary" />
                New Stock Adjustment
              </h1>
              <p className="text-muted-foreground mt-1">One adjustment number, multiple items</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/stock/adjustments">All Adjustments</Link>
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader>
            <CardTitle>Header</CardTitle>
            <CardDescription>Set reason and notes for audit</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Location</Label>
                <MapPin className="w-4 h-4 text-muted-foreground" />
              </div>
              <Select
                value={locationId ? String(locationId) : ""}
                onValueChange={(v) => {
                  const n = Number(v);
                  setLocationId(Number.isFinite(n) && n > 0 ? n : null);
                }}
                disabled={locations.length === 0 || saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">This adjustment will be saved under the selected location.</div>
            </div>
            <div className="space-y-2">
              <Label>Adjusted At</Label>
              <Input type="datetime-local" value={adjustedAt} onChange={(e) => setAdjustedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Stock count correction" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="md:col-span-3 text-xs text-muted-foreground">
              Adjustment number will be generated automatically when you create the batch.
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Lines</CardTitle>
              <CardDescription>Enter physical stock. Variance is calculated as Physical minus System.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setOtherItemsToZero(null)}
                disabled={saving || loading || parts.length === 0 || lines.length === 0}
                title="Keep the selected line, set all other item quantities to 0"
              >
                <MinusCircle className="w-4 h-4" />
                Set Other Items to 0
              </Button>
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" onClick={openAddItem} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Item
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[520px] p-3">
                  <div className="flex items-center gap-2 pb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        placeholder="Search item name, SKU, unit, or ID..."
                        className="pl-8 h-10"
                      />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => setAddQuery("")} className="h-10">
                      Clear
                    </Button>
                  </div>

                  <ScrollArea className="h-[320px] pr-2">
                    <div className="space-y-1">
                      {filteredAddParts.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-10 text-center">No items match your search.</div>
                      ) : (
                        filteredAddParts.map((p) => {
                          const label = p.sku ? `${p.part_name} (${p.sku})` : p.part_name;
                          const sub = [p.unit ? `Unit: ${p.unit}` : null]
                            .filter(Boolean)
                            .join("  ");
                          const selected = lines.some((l) => String(l.part_id) === String(p.id));
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addPart(Number(p.id))}
                              className={cn(
                                "w-full text-left rounded-xl border px-3 py-3 transition-colors",
                                selected ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40 border-transparent"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{label}</div>
                                  {sub ? <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div> : null}
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                                    ID: {p.id}
                                  </div>
                                </div>
                                {selected ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <Button variant="ghost" onClick={addEmptyLine} className="gap-2">
                <ChevronsUpDown className="w-4 h-4" />
                Empty Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[140px]">System Stock</TableHead>
                      <TableHead className="w-[160px]">Physical Stock</TableHead>
                      <TableHead className="w-[140px]">Variance</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          Add items to start this adjustment.
                        </TableCell>
                      </TableRow>
                    ) : null}

                    {lines.map((l) => {
                      const part = parts.find((p) => String(p.id) === String(l.part_id));
                      const label = part ? (part.sku ? `${part.part_name} (${part.sku})` : part.part_name) : null;
                      const sub = part ? [part.unit ? `Unit: ${part.unit}` : null].filter(Boolean).join("  ") : null;
                      const systemStock = Number(part?.stock_quantity ?? 0);
                      const physical = l.physical_stock === "" ? null : Number(l.physical_stock);
                      const variance = physical === null ? null : Number((physical - systemStock).toFixed(3));
                      return (
                        <TableRow
                          key={l.key}
                          className={cn(activeLineKey === l.key ? "bg-muted/20" : "")}
                          onClick={() => setActiveLineKey(l.key)}
                        >
                          <TableCell>
                            <Popover
                              open={editKey === l.key}
                              onOpenChange={(open) => {
                                setEditKey(open ? l.key : null);
                                if (open) setActiveLineKey(l.key);
                                if (open) setEditQuery("");
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn("w-full justify-between gap-2", !label && "border-dashed text-muted-foreground")}
                                >
                                  <span className="truncate">{label || "Select item..."}</span>
                                  <ChevronsUpDown className="w-4 h-4 opacity-70" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-[520px] p-3">
                                <div className="flex items-center gap-2 pb-3">
                                  <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      value={editQuery}
                                      onChange={(e) => setEditQuery(e.target.value)}
                                      placeholder="Search item name, SKU, unit, or ID..."
                                      className="pl-8 h-10"
                                    />
                                  </div>
                                  <Button type="button" variant="ghost" onClick={() => setEditQuery("")} className="h-10">
                                    Clear
                                  </Button>
                                </div>

                                <ScrollArea className="h-[320px] pr-2">
                                  <div className="space-y-1">
                                    {filteredEditParts.length === 0 ? (
                                      <div className="text-sm text-muted-foreground py-10 text-center">No items match your search.</div>
                                    ) : (
                                      filteredEditParts.map((p) => {
                                        const itemLabel = p.sku ? `${p.part_name} (${p.sku})` : p.part_name;
                                        const itemSub = [p.unit ? `Unit: ${p.unit}` : null]
                                          .filter(Boolean)
                                          .join("  ");
                                        const selected = String(l.part_id) === String(p.id);
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => changePart(l.key, Number(p.id))}
                                            className={cn(
                                              "w-full text-left rounded-xl border px-3 py-3 transition-colors",
                                              selected ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40 border-transparent"
                                            )}
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="font-semibold truncate">{itemLabel}</div>
                                                {itemSub ? (
                                                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{itemSub}</div>
                                                ) : null}
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                                                  ID: {p.id}
                                                </div>
                                              </div>
                                              {selected ? (
                                                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                              ) : null}
                                            </div>
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            {sub ? <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div> : null}
                          </TableCell>
                          <TableCell>
                            <div className="h-10 flex items-center">
                              <span className="text-sm font-semibold">{fmt3(systemStock)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              inputMode="decimal"
                              value={l.physical_stock === "" ? "" : String(l.physical_stock)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setLines((p) =>
                                  p.map((x) =>
                                    x.key === l.key
                                      ? { ...x, physical_stock: v === "" ? "" : Number(v), include_when_zero: x.include_when_zero }
                                      : x
                                  )
                                );
                              }}
                              onFocus={() => setActiveLineKey(l.key)}
                              placeholder="Enter count"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="h-10 flex items-center">
                              {variance === null ? (
                                <span className="text-sm text-muted-foreground">-</span>
                              ) : (
                                <span
                                  className={cn(
                                    "text-sm font-bold",
                                    variance === 0 ? "text-muted-foreground" : variance < 0 ? "text-destructive" : "text-green-700"
                                  )}
                                >
                                  {variance > 0 ? "+" : ""}
                                  {fmt3(variance)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={l.notes ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setLines((p) => p.map((x) => (x.key === l.key ? { ...x, notes: v } : x)));
                              }}
                              onFocus={() => setActiveLineKey(l.key)}
                              placeholder="Optional line note"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                // Keep this line as-is, zero all other qty fields.
                                setActiveLineKey(l.key);
                                setOtherItemsToZero(l.key);
                              }}
                              disabled={saving || lines.length <= 1}
                              title="Set other items to zero"
                            >
                              <MinusCircle className="w-4 h-4" />
                            </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLine(l.key)}
                                disabled={saving}
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => router.push("/inventory/stock/adjustments")} disabled={saving}>
                Cancel
              </Button>
              <Button className="gap-2" onClick={() => void submit()} disabled={saving || loading || !locationId}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

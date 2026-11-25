"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createTransfer, fetchLocations, fetchParts, fetchPartLocationStock, fetchRequisition, fetchRequisitions, fetchInventoryBatches, type LocationStock, type ServiceLocationRow, type PartRow, type StockRequisitionRow , formatPartLabel } from "@/lib/api";
import { Plus, Trash2, Layers } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Line = { 
  part_id: string; 
  qty: string; 
  batch_id?: string; 
  batches?: any[]; 
  requested?: number; 
  fulfilled?: number 
};

export default function NewTransferPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<ServiceLocationRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [fromLoc, setFromLoc] = useState<string>("");
  const [toLoc, setToLoc] = useState<string>("");
  const [requisitions, setRequisitions] = useState<StockRequisitionRow[]>([]);
  const [reqId, setReqId] = useState<string>("");
  const [loadingReq, setLoadingReq] = useState(false);
  const autoLoadedRef = useRef(false);
  const [stockByPartId, setStockByPartId] = useState<Record<string, LocationStock>>({});
  const [loadingStockIds, setLoadingStockIds] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ part_id: "", qty: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const [locs, items, reqs] = await Promise.all([fetchLocations(), fetchParts(""), fetchRequisitions()]);
        setLocations(Array.isArray(locs) ? locs : []);
        setParts(Array.isArray(items) ? items : []);
        setRequisitions(Array.isArray(reqs) ? reqs : []);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load data", variant: "destructive" });
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (fromLoc && toLoc && fromLoc === toLoc) setToLoc("");
  }, [fromLoc, toLoc]);

  useEffect(() => {
    if (!fromLoc) return;
    if (toLoc) return;
    const alt = locations.find((l) => String(l.id) !== String(fromLoc));
    if (alt) setToLoc(String(alt.id));
  }, [fromLoc, toLoc, locations]);

  const addLine = () => setLines((prev) => [...prev, { part_id: "", qty: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const locationOptions = useMemo(() => {
    return (locations ?? []).map((l) => ({
      value: String(l.id),
      label: `${l.name}${l.location_type ? ` (${l.location_type})` : ""}`,
      keywords: `${l.name} ${l.location_type ?? ""}`,
    }));
  }, [locations]);

  const requisitionOptions = useMemo(() => {
    return (requisitions ?? [])
      .map((r) => ({
        value: String(r.id),
        label: `${r.requisition_number} • ${r.to_location_name ?? `Loc ${r.to_location_id}`} • ${r.status}`,
        keywords: `${r.requisition_number} ${r.to_location_name ?? ""} ${r.status}`,
      }));
  }, [requisitions]);

  const partOptions = useMemo(() => {
    return (parts ?? []).map((p) => ({
      value: String(p.id),
      label: formatPartLabel(p),
      keywords: `${p.part_name} ${p.sku ?? ""} ${(p as any).part_number ?? ""} ${(p as any).barcode_number ?? ""}`,
    }));
  }, [parts]);

  const fromLocName = useMemo(() => {
    const row = locations.find((l) => String(l.id) === String(fromLoc));
    return row?.name ? String(row.name) : "";
  }, [locations, fromLoc]);

  const clearLines = () => {
    setLines([{ part_id: "", qty: "" }]);
    setStockByPartId({});
    setLoadingStockIds({});
  };

  const onChangeFromLoc = (v: string) => {
    if (v === fromLoc) return;
    const hasAny = lines.some((l) => (String(l.part_id || "").trim() !== "") || (Number(l.qty) > 0));
    if (hasAny) {
      const ok = window.confirm("Changing From Location will clear all items in this transfer. Continue?");
      if (!ok) return;
      clearLines();
      toast({ title: "Items cleared", description: "Transfer lines were cleared because the From Location changed." });
    }
    setFromLoc(v);
    setStockByPartId({});
    setLoadingStockIds({});
  };

  const loadStockAndBatches = async (partId: string, lineIdx: number) => {
    if (!fromLoc || !partId) return;
    
    // Load general stock data
    if (!stockByPartId[partId] && !loadingStockIds[partId]) {
      setLoadingStockIds((p) => ({ ...p, [partId]: true }));
      try {
        const s = await fetchPartLocationStock(partId, fromLoc);
        setStockByPartId((prev) => ({ ...prev, [partId]: s }));
      } catch {} finally {
        setLoadingStockIds((p) => {
          const next = { ...p };
          delete next[partId];
          return next;
        });
      }
    }

    // Load available batches for this specific line
    try {
      const b = await fetchInventoryBatches(partId, fromLoc);
      setLines(prev => {
        const next = [...prev];
        if (next[lineIdx]) next[lineIdx].batches = b;
        return next;
      });
    } catch {}
  };

  // Lines whose quantity is more than the source location can give.
  // Same item on several lines is summed; a chosen batch is checked against that batch.
  const shortIdx = useMemo(() => {
    const bad = new Set<number>();
    const byPart: Record<string, { qty: number; idx: number[] }> = {};
    lines.forEach((l, i) => {
      const q = Number(l.qty) || 0;
      if (!l.part_id || q <= 0) return;
      if (l.batch_id) {
        const b = (l.batches || []).find((x) => String(x.id) === String(l.batch_id));
        if (b && q > Number(b.quantity_on_hand ?? 0)) bad.add(i);
        return;
      }
      const k = String(l.part_id);
      (byPart[k] ??= { qty: 0, idx: [] }).qty += q;
      byPart[k].idx.push(i);
    });
    for (const [pid, v] of Object.entries(byPart)) {
      const s = stockByPartId[pid];
      const avail = s ? Number(s.available ?? 0) : null;
      if (avail === null || v.qty > avail) v.idx.forEach((i) => bad.add(i));
    }
    return bad;
  }, [lines, stockByPartId]);
  const stockPending = lines.some((l) => l.part_id && Number(l.qty) > 0 && loadingStockIds[String(l.part_id)]);

  const canSave = useMemo(() => {
    if (!fromLoc || !toLoc || fromLoc === toLoc) return false;
    if (shortIdx.size > 0 || stockPending) return false;
    return lines.some((l) => l.part_id && Number(l.qty) > 0);
  }, [fromLoc, toLoc, lines, shortIdx, stockPending]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    for (const l of lines) {
      const qty = Number(l.qty);
      if (!l.part_id || !Number.isFinite(qty) || qty <= 0) continue;
      totalQty += qty;
      const p = parts.find((x) => String(x.id) === String(l.part_id));
      const unitCost = Number((p as any)?.cost_price ?? (p as any)?.price ?? 0);
      if (Number.isFinite(unitCost) && unitCost > 0) totalValue += unitCost * qty;
    }
    return { totalQty, totalValue };
  }, [lines, parts]);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        requisition_id: reqId ? Number(reqId) : undefined,
        from_location_id: Number(fromLoc),
        to_location_id: Number(toLoc),
        notes: notes.trim() || undefined,
        items: lines
          .filter((l) => l.part_id && Number(l.qty) > 0)
          .map((l) => ({ 
            part_id: Number(l.part_id), 
            qty: Number(l.qty),
            batch_id: l.batch_id ? Number(l.batch_id) : undefined 
          })),
      };
      const res = await createTransfer(payload);
      toast({ title: "Created", description: "Transfer request created." });
      const id = res?.data?.id;
      if (id) router.push(`/inventory/transfers/${encodeURIComponent(String(id))}`);
      else router.push("/inventory/transfers");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to create transfer", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadRequest = async () => {
    if (!reqId) return;
    setLoadingReq(true);
    try {
      const data = await fetchRequisition(String(reqId));
      const hdr = (data as any)?.requisition ?? null;
      const its = Array.isArray((data as any)?.items) ? (data as any).items : [];
      if (!hdr) throw new Error("Request not found");

      const fromId = String(hdr.from_location_id ?? "");
      if (fromId && fromId !== "0") {
        setFromLoc(fromId);
        setStockByPartId({});
        setLoadingStockIds({});
      }

      const toId = String(hdr.to_location_id ?? "");
      setToLoc(toId);

      const nextLines: Line[] = its.map((it: any) => {
        const req = Number(it.qty_requested ?? 0);
        const ful = Number(it.qty_fulfilled ?? 0);
        const remaining = Math.max(0, req - ful);
        return {
          part_id: String(it.part_id),
          qty: remaining > 0 ? String(remaining) : "",
          requested: req,
          fulfilled: ful,
        };
      });
      setLines(nextLines.length ? nextLines : [{ part_id: "", qty: "" }]);
      
      try {
        const sourceLoc = (fromId && fromId !== "0") ? fromId : fromLoc;
        if (sourceLoc) {
          const ids = Array.from(new Set(nextLines.map((l) => String(l.part_id || "").trim()).filter(Boolean)));
          const pairs = await Promise.all(ids.map((pid) => fetchPartLocationStock(pid, sourceLoc).then((s) => ({ pid, s })).catch(() => null)));
          const next: Record<string, LocationStock> = {};
          for (const p of pairs) {
            if (!p) continue;
            next[p.pid] = p.s;
          }
          setStockByPartId(next);
        }
      } catch {}
      toast({ title: "Loaded", description: "Request loaded into transfer." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load request", variant: "destructive" });
    } finally {
      setLoadingReq(false);
    }
  };

  useEffect(() => {
    const pre = searchParams?.get("req");
    if (!pre) return;
    if (reqId) return;
    setReqId(String(pre));
  }, [searchParams, reqId]);

  useEffect(() => {
    const pre = searchParams?.get("req");
    if (!pre) return;
    if (String(reqId) !== String(pre)) return;
    if (autoLoadedRef.current) return;
    if (!reqId) return;
    autoLoadedRef.current = true;
    void loadRequest();
  }, [searchParams, reqId]);

  useEffect(() => {
    if (!fromLoc) return;
    const ids = Array.from(new Set(lines.map((l) => String(l.part_id || "").trim()).filter(Boolean)));
    if (ids.length === 0) return;
    void (async () => {
      try {
        const pairs = await Promise.all(ids.map((pid) => fetchPartLocationStock(pid, fromLoc).then((s) => ({ pid, s })).catch(() => null)));
        const next: Record<string, LocationStock> = {};
        for (const p of pairs) {
          if (!p) continue;
          next[p.pid] = p.s;
        }
        setStockByPartId(next);
      } catch {}
    })();
  }, [fromLoc]);

  const sel = "h-9 text-sm";
  const sameLoc = !!fromLoc && !!toLoc && fromLoc === toLoc;

  return (
    <DashboardLayout>
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">New Stock Transfer</h1>
            <p className="text-xs text-muted-foreground">Send stock from one location to another</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push("/inventory/transfers")}>Back</Button>
        </div>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-4">
                <Label className="text-xs">From stock request <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <div className="flex gap-2">
                  <SearchableSelect value={reqId} onValueChange={setReqId} options={requisitionOptions} placeholder="Select request..." searchPlaceholder="Search requests..." triggerClassName={sel} className="min-w-0 flex-1" />
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => void loadRequest()} disabled={!reqId || loadingReq}>
                    {loadingReq ? "Loading..." : "Load"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">From</Label>
                <SearchableSelect value={fromLoc} onValueChange={onChangeFromLoc} options={locationOptions} placeholder="Select source..." searchPlaceholder="Search locations..." triggerClassName={sel} />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">To {reqId ? <span className="font-normal text-muted-foreground">(from request)</span> : null}</Label>
                <SearchableSelect value={toLoc} onValueChange={(v) => { if (reqId) return; setToLoc(v); }} options={locationOptions} placeholder="Select destination..." searchPlaceholder="Search locations..." triggerClassName={`${sel} ${sameLoc ? "border-destructive" : ""}`} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Input className="h-9 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            {sameLoc && <p className="text-xs font-medium text-destructive">From and To locations must be different.</p>}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Item</th>
                    <th className="w-56 px-2 py-1.5 text-left font-medium">Batch</th>
                    <th className="w-28 px-2 py-1.5 text-right font-medium">Available</th>
                    <th className="w-32 px-2 py-1.5 text-left font-medium">Qty</th>
                    <th className="w-28 px-2 py-1.5 text-right font-medium">Value</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, idx) => {
                    const p: any = parts.find((x) => String(x.id) === String(line.part_id));
                    const unit = p?.unit || "";
                    const unitCost = Number(p?.cost_price ?? p?.price ?? 0);
                    const qty = Number(line.qty) || 0;
                    const locStock = stockByPartId[String(line.part_id)] ?? null;
                    const locLoading = Boolean(loadingStockIds[String(line.part_id)]);
                    const avail = locStock ? Number(locStock.available ?? 0) : null;
                    const over = shortIdx.has(idx) && !locLoading;
                    return (
                      <tr key={idx} className="align-middle">
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <SearchableSelect
                            value={line.part_id}
                            onValueChange={(val) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], part_id: val, batch_id: "" };
                              setLines(next);
                              if (val && fromLoc) void loadStockAndBatches(val, idx);
                            }}
                            options={partOptions} placeholder="Select item..." searchPlaceholder="Search items..." triggerClassName="h-8 text-sm"
                          />
                          {p && (
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {[p.sku, `LKR ${unitCost.toFixed(2)} / ${unit || "unit"}`, `System total ${Number(p.stock_quantity ?? 0).toFixed(1)}`].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <SearchableSelect
                            value={line.batch_id || ""}
                            onValueChange={(val) => { const next = [...lines]; next[idx] = { ...next[idx], batch_id: val }; setLines(next); }}
                            options={(line.batches || []).map((b) => ({
                              value: String(b.id),
                              label: `${b.batch_number} (Exp: ${b.expiry_date || "N/A"}, Qty: ${Number(b.quantity_on_hand).toFixed(1)})`,
                              keywords: `${b.batch_number} ${b.expiry_date}`,
                            }))}
                            placeholder={line.batches?.length ? "Auto (FIFO)" : "No batches"}
                            disabled={!line.part_id || !line.batches?.length}
                            triggerClassName="h-8 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums" title={locStock ? `On hand ${Number(locStock.on_hand).toFixed(1)}, reserved ${Number(locStock.reserved).toFixed(1)}` : undefined}>
                          {!line.part_id ? "—" : locLoading ? "…" : avail === null ? "—" : <span className={avail <= 0 ? "text-destructive" : ""}>{avail.toFixed(3)} {unit}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input type="number" step="0.001" min="0" value={line.qty}
                              onChange={(e) => { const next = [...lines]; next[idx] = { ...next[idx], qty: e.target.value }; setLines(next); }}
                              placeholder="0" className={`h-8 text-sm tabular-nums ${unit ? "pr-11" : ""} ${over ? "border-destructive" : ""}`} aria-label={`Quantity for line ${idx + 1}`} />
                            {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{unit}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums">{p && qty > 0 ? (unitCost * qty).toFixed(2) : "—"}</td>
                        <td className="px-1 py-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)} disabled={lines.length === 1} aria-label={`Remove line ${idx + 1}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="outline" className="gap-1.5 border-dashed" onClick={addLine}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs text-muted-foreground">
                  Qty {totals.totalQty.toFixed(3)} · <span className="font-semibold text-foreground">LKR {totals.totalValue.toFixed(2)}</span>
                  {!canSave && <div>{!fromLoc || !toLoc ? "Select both locations"
                    : fromLoc === toLoc ? "Pick two different locations"
                    : stockPending ? "Checking stock…"
                    : shortIdx.size > 0 ? <span className="font-medium text-destructive">Not enough stock on line {Array.from(shortIdx).sort((a, b) => a - b).map((i) => i + 1).join(", ")}</span>
                    : "Add an item with a quantity"}</div>}
                </div>
                <Button size="sm" onClick={submit} disabled={!canSave || saving}>{saving ? "Creating..." : "Create transfer"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

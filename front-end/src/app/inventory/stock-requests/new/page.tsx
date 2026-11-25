"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createRequisition, fetchLocations, fetchParts, type PartRow, type ServiceLocationRow , formatPartLabel } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

const fmtMoney = (v: number) => v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (v: number) => v.toLocaleString("en-LK", { maximumFractionDigits: 3 });

type Line = { part_id: string; qty_requested: string; notes?: string };

export default function NewStockRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [locations, setLocations] = useState<ServiceLocationRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [fromLoc, setFromLoc] = useState<string>("");
  const [toLoc, setToLoc] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ part_id: "", qty_requested: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const [locs, items] = await Promise.all([fetchLocations(), fetchParts("")]);
        const cleanedLocs = Array.isArray(locs) ? (locs as any) : [];
        setLocations(cleanedLocs);
        setParts(Array.isArray(items) ? (items as any) : []);

        // Default To Location = current location context (if available).
        try {
          const ls = window.localStorage.getItem("location_id");
          const v = ls ? String(Number(ls)) : "";
          if (v) setToLoc(v);
        } catch {
          // ignore
        }

        // Default Requested From = first warehouse if present.
        try {
          const wh = cleanedLocs.find((l: any) => String(l.location_type || "").toLowerCase() === "warehouse");
          if (wh && wh.id) setFromLoc(String(wh.id));
        } catch {
          // ignore
        }
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load data", variant: "destructive" });
      }
    };
    void run();
  }, []);

  const addLine = () => setLines((prev) => [...prev, { part_id: "", qty_requested: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const locationOptions = useMemo(() => {
    return (locations ?? []).map((l) => ({
      value: String(l.id),
      label: `${l.name}${l.location_type ? ` (${l.location_type})` : ""}`,
      keywords: `${l.name} ${l.location_type ?? ""}`,
    }));
  }, [locations]);

  const partOptions = useMemo(() => {
    return (parts ?? []).map((p) => ({
      value: String(p.id),
      label: formatPartLabel(p),
      keywords: `${p.part_name} ${p.sku ?? ""} ${(p as any).part_number ?? ""} ${(p as any).barcode_number ?? ""}`,
    }));
  }, [parts]);

  const partById = useMemo(() => new Map((parts ?? []).map((p) => [String(p.id), p])), [parts]);
  const totalValue = lines.reduce((s, l) => s + (Number(l.qty_requested) || 0) * Number(partById.get(l.part_id)?.cost_price ?? 0), 0);

  const sameLoc = !!fromLoc && fromLoc === toLoc;

  const canSave = useMemo(() => {
    if (!fromLoc || !toLoc || sameLoc) return false;
    return lines.some((l) => l.part_id && Number(l.qty_requested) > 0);
  }, [fromLoc, toLoc, sameLoc, lines]);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        from_location_id: Number(fromLoc),
        to_location_id: Number(toLoc),
        notes: notes.trim() || undefined,
        items: lines
          .filter((l) => l.part_id && Number(l.qty_requested) > 0)
          .map((l) => ({
            part_id: Number(l.part_id),
            qty_requested: Number(l.qty_requested),
            notes: (l.notes ?? "").trim() || undefined,
          })),
      };
      const res = await createRequisition(payload);
      const pending = res?.data?.approval === "Pending";
      toast({ title: pending ? "Sent for approval" : "Created", description: pending ? (res?.message || "Stock request sent for approval.") : "Stock request created." });
      router.push("/inventory/stock-requests");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to create stock request", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const sel = "h-9 text-sm";
  const validLines = lines.filter((l) => l.part_id && Number(l.qty_requested) > 0).length;

  return (
    <DashboardLayout>
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">New Stock Request</h1>
            <p className="text-xs text-muted-foreground">Ask another location to send stock</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push("/inventory/stock-requests")}>Back</Button>
        </div>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">From (sends the stock) <span className="text-destructive">*</span></Label>
                <SearchableSelect value={fromLoc} onValueChange={setFromLoc} options={locationOptions} placeholder="Select location..." searchPlaceholder="Search locations..." triggerClassName={sel} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To (needs the stock) <span className="text-destructive">*</span></Label>
                <SearchableSelect value={toLoc} onValueChange={setToLoc} options={locationOptions} placeholder="Select location..." searchPlaceholder="Search locations..." triggerClassName={`${sel} ${sameLoc ? "border-destructive" : ""}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input className="h-9 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            {sameLoc && <p className="text-xs font-medium text-destructive">From and To cannot be the same location.</p>}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Item</th>
                    <th className="w-24 px-2 py-1.5 text-right font-medium">In stock</th>
                    <th className="w-32 px-2 py-1.5 text-left font-medium">Qty</th>
                    <th className="w-28 px-2 py-1.5 text-right font-medium">Value</th>
                    <th className="w-40 px-2 py-1.5 text-left font-medium">Note</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, idx) => {
                    const part = partById.get(line.part_id);
                    const unit = part?.unit || "";
                    const qty = Number(line.qty_requested) || 0;
                    const cost = Number(part?.cost_price ?? 0);
                    const stock = Number(part?.stock_quantity ?? 0);
                    const set = (patch: Partial<Line>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
                    return (
                      <tr key={idx} className="align-middle">
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <SearchableSelect value={line.part_id} onValueChange={(val) => set({ part_id: val })} options={partOptions} placeholder="Select item..." searchPlaceholder="Search items..." triggerClassName="h-8 text-sm" />
                          {part && (
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {[part.sku, part.brand_name, `LKR ${fmtMoney(cost)} / ${unit || "unit"}`].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className={`px-2 py-1.5 text-right text-xs tabular-nums ${part && stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {part ? `${fmtQty(stock)} ${unit}` : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input type="number" step="0.001" min="0" value={line.qty_requested} onChange={(e) => set({ qty_requested: e.target.value })}
                              placeholder="0" className={`h-8 text-sm tabular-nums ${unit ? "pr-11" : ""}`} aria-label={`Quantity for line ${idx + 1}`} />
                            {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{unit}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums">{qty > 0 && part ? fmtMoney(qty * cost) : "—"}</td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-sm" value={line.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Optional" aria-label={`Note for line ${idx + 1}`} />
                        </td>
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
                  {validLines} line(s) · <span className="font-semibold text-foreground">LKR {fmtMoney(totalValue)}</span>
                  {!canSave && <div>{!fromLoc ? "Select the From location" : !toLoc ? "Select the To location" : sameLoc ? "Pick two different locations" : "Add an item with a quantity"}</div>}
                </div>
                <Button size="sm" onClick={submit} disabled={!canSave || saving}>{saving ? "Saving..." : "Create request"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  createGrn,
  fetchParts,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchSuppliers,
  type GrnItemRow,
  type PartRow,
  type PurchaseOrderRow,
  type SupplierRow,
} from "@/lib/api";
import { ArrowLeft, ClipboardCheck, Loader2, PackageCheck, Plus, RefreshCw, Trash2 } from "lucide-react";

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewGrnPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);

  const [form, setForm] = useState({
    supplier_id: "",
    purchase_order_id: "",
    received_at: nowLocalDatetime(),
    notes: "",
    items: [{ part_id: 0, qty_received: 1, unit_cost: 0 } as GrnItemRow],
  });

  const partsById = useMemo(() => {
    const m = new Map<number, PartRow>();
    for (const p of parts) m.set(Number(p.id), p);
    return m;
  }, [parts]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [supRows, partRows, poRows] = await Promise.all([fetchSuppliers(), fetchParts(""), fetchPurchaseOrders("")]);
        setSuppliers(Array.isArray(supRows) ? supRows : []);
        setParts(Array.isArray(partRows) ? partRows : []);
        setPurchaseOrders(Array.isArray(poRows) ? poRows : []);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load master data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, { part_id: 0, qty_received: 1, unit_cost: 0 }] }));
  const removeLine = (idx: number) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const poSelected = useMemo(() => {
    const id = Number(form.purchase_order_id);
    if (!id) return null;
    return purchaseOrders.find((p) => Number(p.id) === id) ?? null;
  }, [form.purchase_order_id, purchaseOrders]);

  const loadPoItems = async () => {
    const poId = Number(form.purchase_order_id);
    if (!poId) {
      toast({ title: "Select PO", description: "Select a purchase order first.", variant: "destructive" });
      return;
    }
    setLoadingPo(true);
    try {
      const data: any = await fetchPurchaseOrder(String(poId));
      const po: any = data?.purchase_order ?? null;
      const items: any[] = Array.isArray(data?.items) ? data.items : [];

      const nextSupplierId = po?.supplier_id ? String(po.supplier_id) : form.supplier_id;

      // Default receive qty = remaining = ordered - received
      const mapped: GrnItemRow[] = items
        .map((it) => {
          const partId = Number(it.part_id);
          const ordered = Number(it.qty_ordered ?? 0);
          const received = Number(it.received_qty ?? 0);
          const remaining = Math.max(0, ordered - received);
          const unitCost = Number(it.unit_cost ?? 0);
          return {
            part_id: partId,
            qty_received: remaining > 0 ? remaining : 0,
            unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
          };
        })
        .filter((x) => x.part_id > 0);

      setForm((p) => ({
        ...p,
        supplier_id: nextSupplierId,
        items: mapped.length > 0 ? mapped : [{ part_id: 0, qty_received: 1, unit_cost: 0 }],
      }));

      toast({ title: "Loaded", description: `Loaded ${mapped.length} PO lines.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load PO items", variant: "destructive" });
    } finally {
      setLoadingPo(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplierId = Number(form.supplier_id);
    const poId = form.purchase_order_id.trim() ? Number(form.purchase_order_id) : null;

	    const items = form.items
	      .map((it) => ({
	        part_id: Number(it.part_id),
	        qty_received: Number(it.qty_received),
	        unit_cost: Number(it.unit_cost),
	      }))
	      .map((it) => ({
	        ...it,
	        qty_received: Number.isFinite(it.qty_received) ? Math.round(it.qty_received * 1000) / 1000 : 0,
	      }))
	      .filter((it) => it.part_id > 0 && it.qty_received > 0 && Number.isFinite(it.unit_cost));

    if (!supplierId || !form.received_at || items.length === 0) {
      toast({ title: "Validation", description: "Supplier, Received At, and at least 1 item line are required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await createGrn({
        supplier_id: supplierId,
        purchase_order_id: poId,
        received_at: form.received_at,
        notes: form.notes.trim() || undefined,
        items,
      });
      const id = (res as any)?.data?.id;
      toast({ title: "Created", description: `GRN created${id ? ` (#${id})` : ""} and stock updated` });
      router.push("/inventory/grn");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Create failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const partLabel = (id: number) => {
    const p = partsById.get(id);
    if (!p) return "Select item...";
    return p.sku ? `${p.part_name} (${p.sku})` : p.part_name;
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
                <PackageCheck className="w-6 h-6 text-primary" />
                New GRN
              </h1>
              <p className="text-muted-foreground mt-1">Receive stock and update average cost price</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/grn">All GRNs</Link>
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader>
              <CardTitle>Header</CardTitle>
              <CardDescription>Supplier, PO link and received time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Purchase Order (optional)</Label>
                    <div className="flex gap-2">
                      <Select value={form.purchase_order_id} onValueChange={(v) => setForm((p) => ({ ...p, purchase_order_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select PO..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[280px]">
                          {purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={String(po.id)}>
                              {po.po_number} {po.supplier_name ? `- ${po.supplier_name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={() => void loadPoItems()} disabled={loadingPo}>
                        {loadingPo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Load PO Items
                      </Button>
                    </div>
                    {poSelected ? (
                      <div className="text-[11px] text-muted-foreground">
                        Selected: <span className="font-semibold text-foreground">{poSelected.po_number}</span> ({poSelected.status})
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">Select a PO to auto-load its items.</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Select
                      value={form.supplier_id}
                      onValueChange={(v) => setForm((p) => ({ ...p, supplier_id: v }))}
                      disabled={Boolean(form.purchase_order_id) && loadingPo}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-[11px] text-muted-foreground">
                      If you load a PO, supplier will be set from that PO.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Received At</Label>
                    <Input type="datetime-local" value={form.received_at} onChange={(e) => setForm((p) => ({ ...p, received_at: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Received Items</CardTitle>
                <CardDescription>Receiving updates stock and calculates average cost price automatically</CardDescription>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={addLine} disabled={saving || loading}>
                <Plus className="w-4 h-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[140px]">Qty</TableHead>
                      <TableHead className="w-[180px]">Unit Cost</TableHead>
                      <TableHead className="w-[70px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((it, idx) => (
                      <TableRow key={idx} className="align-top">
                        <TableCell>
                          <div className="space-y-2">
                            <Select
                              value={String(it.part_id || "")}
                              onValueChange={(v) => {
                                const partId = Number(v);
                                const p = partsById.get(partId);
                                const defaultCost = p?.cost_price ?? 0;
                                setForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((x, i) =>
                                    i === idx
                                      ? { ...x, part_id: partId, unit_cost: Number.isFinite(Number(defaultCost)) ? Number(defaultCost) : 0 }
                                      : x
                                  ),
                                }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[280px]">
                                {parts.map((p) => (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.sku ? `${p.part_name} (${p.sku})` : p.part_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-[11px] text-muted-foreground">{it.part_id ? partLabel(it.part_id) : "Pick an item"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
	                          <Input
	                            type="number"
	                            step="0.001"
	                            inputMode="decimal"
	                            value={String(it.qty_received ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                items: p.items.map((x, i) => (i === idx ? { ...x, qty_received: Number(v) } : x)),
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={String(it.unit_cost ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              setForm((p) => ({
                                ...p,
                                items: p.items.map((x, i) => (i === idx ? { ...x, unit_cost: Number(v) } : x)),
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLine(idx)}
                            disabled={saving || form.items.length <= 1}
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/inventory/grn")} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={saving || loading}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Receive
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}

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
import { createPurchaseOrder, fetchPartsForSupplier, fetchSupplier, fetchSuppliers, type PartRow, type PurchaseOrderItemRow, type SupplierRow, type TaxRow } from "@/lib/api";
import { calculateTaxes } from "@/lib/tax-calc";
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from "lucide-react";

function todayLocalDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMysqlDatetimeFromDate(v: string) {
  // input[type=date] => "YYYY-MM-DD" (no time in UI)
  if (!v) return null;
  // backend accepts mysql DATETIME
  return `${v} 00:00:00`;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [supplierTaxes, setSupplierTaxes] = useState<TaxRow[]>([]);

  const [form, setForm] = useState({
    supplier_id: "",
    notes: "",
    ordered_at: todayLocalDate(),
    expected_at: "",
    items: [{ part_id: 0, qty_ordered: 1, unit_cost: 0 } as PurchaseOrderItemRow],
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [supRows] = await Promise.all([fetchSuppliers()]);
        setSuppliers(Array.isArray(supRows) ? supRows : []);
        setParts([]);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load suppliers/items", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const sid = Number(form.supplier_id);
    if (!Number.isFinite(sid) || sid <= 0) {
      setParts([]);
      setSupplierTaxes([]);
      return;
    }
    void (async () => {
      try {
        const [partRows, sup] = await Promise.all([fetchPartsForSupplier(sid, ""), fetchSupplier(String(sid))]);
        setParts(Array.isArray(partRows) ? partRows : []);
        setSupplierTaxes(Array.isArray((sup as any)?.taxes) ? ((sup as any).taxes as TaxRow[]) : []);
      } catch (e: any) {
        setParts([]);
        setSupplierTaxes([]);
        toast({ title: "Error", description: e?.message || "Failed to load supplier items", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.supplier_id]);

  const partById = useMemo(() => {
    const m = new Map<number, PartRow>();
    for (const p of parts) m.set(Number(p.id), p);
    return m;
  }, [parts]);

  const money = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const totalAmount = useMemo(() => {
    let sum = 0;
    for (const it of form.items) {
      const qty = Number(it.qty_ordered);
      const unitCost = Number(it.unit_cost);
      if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) continue;
      sum += qty * unitCost;
    }
    // money-like total
    return Math.round(sum * 100) / 100;
  }, [form.items]);

  const taxCalc = useMemo(() => calculateTaxes(totalAmount, supplierTaxes), [totalAmount, supplierTaxes]);

  const addLine = () =>
    setForm((p) => ({
      ...p,
      items: [...p.items, { part_id: 0, qty_ordered: 1, unit_cost: 0 }],
    }));

  const removeLine = (idx: number) =>
    setForm((p) => ({
      ...p,
      items: p.items.filter((_, i) => i !== idx),
    }));

  const canSave = useMemo(() => {
    const supplierId = Number(form.supplier_id);
    if (!Number.isFinite(supplierId) || supplierId <= 0) return false;
    const validLines = form.items.some((it) => Number(it.part_id) > 0 && Number(it.qty_ordered) > 0);
    return validLines;
  }, [form]);

  const selectedPartIds = useMemo(() => {
    const s = new Set<number>();
    for (const it of form.items) {
      const id = Number(it.part_id);
      if (Number.isFinite(id) && id > 0) s.add(id);
    }
    return s;
  }, [form.items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplierId = Number(form.supplier_id);

    const items = form.items
      .map((it) => {
        const partId = Number(it.part_id);
        const qty = Number(it.qty_ordered);
        const unitCost = Number(it.unit_cost);
        return {
          part_id: partId,
          qty_ordered: Number.isFinite(qty) ? Math.round(qty * 1000) / 1000 : 0,
          unit_cost: unitCost,
        };
      })
      .filter((it) => it.part_id > 0 && it.qty_ordered > 0);

    if (!supplierId || items.length === 0) {
      toast({ title: "Validation", description: "Select a supplier and add at least 1 item line.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplier_id: supplierId,
        notes: form.notes?.trim() ? form.notes.trim() : undefined,
        ordered_at: toMysqlDatetimeFromDate(form.ordered_at),
        expected_at: toMysqlDatetimeFromDate(form.expected_at),
        items: items.map((it) => ({
          ...it,
          qty_ordered: Number.isFinite(it.qty_ordered) ? Math.round(it.qty_ordered * 1000) / 1000 : 0,
          unit_cost: Number.isFinite(it.unit_cost) ? it.unit_cost : 0,
        })),
      };

      let printTab: Window | null = null;
      try {
        printTab = window.open("about:blank", "_blank", "noopener,noreferrer");
        if (printTab && printTab.document) {
          printTab.document.title = "Preparing PO...";
          printTab.document.body.innerHTML =
            "<div style='font-family:system-ui,Segoe UI,Arial;padding:16px'>Preparing print…</div>";
        }
      } catch {
        printTab = null;
      }

      const res = await createPurchaseOrder(payload as any);
      const createdId = (res as any)?.data?.id;

      toast({ title: "Created", description: "Purchase order created" });

      if (createdId) {
        const url = `/inventory/purchase-orders/print/${encodeURIComponent(String(createdId))}?autoprint=1`;
        if (printTab && !printTab.closed) {
          printTab.location.href = url;
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }

      router.push("/inventory/purchase-orders");
    } catch (e: any) {
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
                <FileText className="w-6 h-6 text-primary" />
                New Purchase Order
              </h1>
              <p className="text-muted-foreground mt-1">Create a purchase order with supplier and line items</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/purchase-orders">All POs</Link>
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader>
              <CardTitle>Header</CardTitle>
              <CardDescription>Supplier, dates and notes</CardDescription>
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
                    <Label>Supplier</Label>
                    <Select value={form.supplier_id} onValueChange={(v) => setForm((p) => ({ ...p, supplier_id: v }))}>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Ordered Date</Label>
                    <Input
                      type="date"
                      value={form.ordered_at}
                      onChange={(e) => setForm((p) => ({ ...p, ordered_at: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Date</Label>
                    <Input
                      type="date"
                      value={form.expected_at}
                      onChange={(e) => setForm((p) => ({ ...p, expected_at: e.target.value }))}
                    />
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
                <CardTitle>Line Items</CardTitle>
                <CardDescription>Unit Cost auto-fills from item Cost Price</CardDescription>
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
                      <TableHead className="w-[160px] text-right">Amount</TableHead>
                      <TableHead className="w-[70px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((it, idx) => {
                      const selected = it.part_id ? partById.get(Number(it.part_id)) : null;
                      const costHint = selected?.cost_price ?? null;
                      const qty = Number(it.qty_ordered);
                      const unitCost = Number(it.unit_cost);
                      const lineAmount = Number.isFinite(qty) && Number.isFinite(unitCost) ? Math.round(qty * unitCost * 100) / 100 : 0;
                      return (
                        <TableRow key={idx} className="align-top">
                          <TableCell>
                            <div className="space-y-2">
                              <Select
                                value={String(it.part_id || "")}
                                onValueChange={(v) => {
                                  const partId = Number(v);
                                  // Prevent duplicate selection
                                  if (partId > 0) {
                                    const usedElsewhere = form.items.some((x, i) => i !== idx && Number(x.part_id) === partId);
                                    if (usedElsewhere) {
                                      toast({ title: "Duplicate item", description: "This item is already added to the PO.", variant: "destructive" });
                                      return;
                                    }
                                  }
                                  const p = partById.get(partId);
                                  const defaultCost = p?.cost_price ?? 0;
                                  setForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            part_id: partId,
                                            unit_cost: Number.isFinite(Number(defaultCost)) ? Number(defaultCost) : 0,
                                          }
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
                                    <SelectItem
                                      key={p.id}
                                      value={String(p.id)}
                                      disabled={selectedPartIds.has(Number(p.id)) && Number(p.id) !== Number(it.part_id)}
                                    >
                                      {p.sku ? `${p.part_name} (${p.sku})` : p.part_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {costHint !== null && costHint !== undefined ? (
                                <div className="text-[11px] text-muted-foreground">Item cost price: {Number(costHint).toLocaleString()}</div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground">Pick an item</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
	                            <Input
	                              type="number"
	                              step="0.001"
	                              inputMode="decimal"
	                              value={String(it.qty_ordered ?? "")}
                              onChange={(e) => {
                                const v = e.target.value;
                                setForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((x, i) => (i === idx ? { ...x, qty_ordered: Number(v) } : x)),
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
	                                setForm((prev) => ({
	                                  ...prev,
	                                  items: prev.items.map((x, i) => (i === idx ? { ...x, unit_cost: Number(v) } : x)),
	                                }));
	                              }}
	                            />
	                          </TableCell>
                          <TableCell className="text-right align-middle">
                            <div className="font-semibold tabular-nums">{money(lineAmount)}</div>
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-end mt-4">
                <div className="rounded-lg border bg-muted/20 px-4 py-3 min-w-[260px]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">Sub Total</div>
                    <div className="text-lg font-bold tabular-nums">{money(totalAmount)}</div>
                  </div>
                  {taxCalc.lines.length > 0 ? (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {taxCalc.lines.map((t) => (
                        <div key={t.tax_id} className="flex items-center justify-between gap-4 text-sm">
                          <div className="text-muted-foreground">
                            {t.code} ({Number(t.rate_percent).toLocaleString()}%)
                          </div>
                          <div className="font-semibold tabular-nums">{money(t.amount)}</div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-4 text-sm pt-1">
                        <div className="text-muted-foreground">Total Tax</div>
                        <div className="font-semibold tabular-nums">{money(taxCalc.totalTax)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-2 border-t">
                        <div className="text-sm text-muted-foreground">Grand Total</div>
                        <div className="text-xl font-bold tabular-nums">{money(taxCalc.grandTotal)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/inventory/purchase-orders")} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={!canSave || saving || loading}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create PO
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}

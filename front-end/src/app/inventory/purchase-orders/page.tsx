"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createPurchaseOrder,
  fetchParts,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchPartsForSupplier,
  fetchSuppliers,
  setPurchaseOrderStatus,
  updatePurchaseOrder,
  type PartRow,
  type PurchaseOrderItemRow,
  type PurchaseOrderRow,
  type SupplierRow,
} from "@/lib/api";
import { Plus, Search, Loader2, AlertCircle, FileText, Pencil, Send, Printer, PackageCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toLocalDatetimeValue(v: string | null) {
  if (!v) return "";
  const iso = v.includes("T") ? v : v.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    supplier_id: "",
    notes: "",
    ordered_at: "",
    expected_at: "",
    items: [] as PurchaseOrderItemRow[],
  });

  const onPrint = (id: number) => {
    const url = `/inventory/purchase-orders/print/${encodeURIComponent(String(id))}?autoprint=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onReceive = (id: number) => {
    router.push(`/inventory/grn/new?po=${encodeURIComponent(String(id))}`);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [poRows, supRows] = await Promise.all([fetchPurchaseOrders(), fetchSuppliers()]);
      setRows(Array.isArray(poRows) ? poRows : []);
      setSuppliers(Array.isArray(supRows) ? supRows : []);
      setParts([]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load purchase orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem("auth_token");
      if (!token) return;
      const part = token.split(".")[1];
      const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      setIsAdmin(String(json?.role ?? "") === "Admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.po_number ?? "").toLowerCase().includes(q) || (r.supplier_name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const openAdd = () => {
    // New PO is now a dedicated page.
    // (Kept for backward compatibility; not used by the UI button anymore.)
    setEditId(null);
    setForm({ supplier_id: "", notes: "", ordered_at: "", expected_at: "", items: [{ part_id: 0, qty_ordered: 1, unit_cost: 0 }] });
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    if (!isAdmin) {
      toast({ title: "Forbidden", description: "Only Admin can edit purchase orders.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const data: any = await fetchPurchaseOrder(String(id));
      const po: any = data?.purchase_order;
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      setEditId(id);
      setForm({
        supplier_id: String(po?.supplier_id ?? ""),
        notes: String(po?.notes ?? ""),
        ordered_at: toLocalDatetimeValue(po?.ordered_at ?? null),
        expected_at: toLocalDatetimeValue(po?.expected_at ?? null),
        items: items.map((it) => ({
          id: Number(it.id),
          part_id: Number(it.part_id),
          qty_ordered: Number(it.qty_ordered ?? 0),
          unit_cost: Number(it.unit_cost ?? 0),
          received_qty: Number(it.received_qty ?? 0),
        })),
      });

      const sid = Number(po?.supplier_id ?? 0);
      if (sid > 0) {
        const partRows = await fetchPartsForSupplier(sid, "");
        setParts(Array.isArray(partRows) ? partRows : []);
      } else {
        setParts([]);
      }
      setDialogOpen(true);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load PO", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const sid = Number(form.supplier_id);
    if (!dialogOpen) return;
    if (!Number.isFinite(sid) || sid <= 0) {
      setParts([]);
      return;
    }
    void (async () => {
      try {
        const partRows = await fetchPartsForSupplier(sid, "");
        setParts(Array.isArray(partRows) ? partRows : []);
      } catch {
        setParts([]);
      }
    })();
  }, [form.supplier_id, dialogOpen]);

  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, { part_id: 0, qty_ordered: 1, unit_cost: 0 }] }));
  const removeLine = (idx: number) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId && !isAdmin) {
      toast({ title: "Forbidden", description: "Only Admin can edit purchase orders.", variant: "destructive" });
      return;
    }
    const supplierId = Number(form.supplier_id);
    const items = form.items
      .map((it) => ({
        part_id: Number(it.part_id),
        qty_ordered: Math.trunc(Number(it.qty_ordered)),
        unit_cost: Number(it.unit_cost),
      }))
      .filter((it) => it.part_id > 0 && it.qty_ordered > 0 && Number.isFinite(it.unit_cost));
    if (!supplierId || items.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        notes: form.notes.trim() || undefined,
        ordered_at: form.ordered_at ? form.ordered_at : null,
        expected_at: form.expected_at ? form.expected_at : null,
        items,
      };
      if (editId) {
        await updatePurchaseOrder(String(editId), payload);
        toast({ title: "Updated", description: "Purchase order updated" });
      } else {
        await createPurchaseOrder(payload);
        toast({ title: "Created", description: "Purchase order created" });
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Save failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const quickStatus = async (id: number, status: string) => {
    if (!isAdmin) {
      toast({ title: "Forbidden", description: "Only Admin can update purchase order status.", variant: "destructive" });
      return;
    }
    try {
      await setPurchaseOrderStatus(String(id), status);
      toast({ title: "Updated", description: `Status set to ${status}` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update status", variant: "destructive" });
    }
  };

  const partLabel = (id: number) => {
    const p = parts.find((x) => x.id === id);
    if (!p) return "Select item...";
    return p.sku ? `${p.part_name} (${p.sku})` : p.part_name;
  };

  const selectedPartIds = useMemo(() => {
    const s = new Set<number>();
    for (const it of form.items) {
      const id = Number(it.part_id);
      if (Number.isFinite(id) && id > 0) s.add(id);
    }
    return s;
  }, [form.items]);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Create POs and receive items with GRN</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {rows.length} POs
          </Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button asChild className="gap-2 bg-primary">
              <Link href="/inventory/purchase-orders/new">
                <Plus className="w-4 h-4" />
                New PO
              </Link>
            </Button>
            <DialogContent className="sm:max-w-[920px]">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{editId ? `Edit Purchase Order #${editId}` : "New Purchase Order"}</DialogTitle>
                  <DialogDescription>Choose supplier and add line items.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm((p) => ({ ...p, supplier_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ordered At</Label>
                      <Input type="datetime-local" value={form.ordered_at} onChange={(e) => setForm((p) => ({ ...p, ordered_at: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected At</Label>
                      <Input type="datetime-local" value={form.expected_at} onChange={(e) => setForm((p) => ({ ...p, expected_at: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="font-semibold">Line Items</div>
                      <Button type="button" variant="outline" onClick={addLine}>Add Line</Button>
                    </div>
                    <div className="p-4 space-y-3">
                      {form.items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                          <div className="lg:col-span-6 space-y-2">
                            <Label>Item</Label>
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
                                const p = parts.find((x) => x.id === partId);
                                const defaultCost = p?.cost_price ?? 0;
                                setForm((p) => ({
                                  ...p,
                                  items: p.items.map((x, i) =>
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
                            <div className="text-[11px] text-muted-foreground">
                              {it.part_id ? partLabel(it.part_id) : "Pick an item"}
                            </div>
                          </div>
                          <div className="lg:col-span-2 space-y-2">
                            <Label>Qty</Label>
                            <Input
                              inputMode="numeric"
                              value={String(it.qty_ordered ?? "")}
                              onChange={(e) => {
                                const v = e.target.value;
                                setForm((p) => ({
                                  ...p,
                                  items: p.items.map((x, i) => (i === idx ? { ...x, qty_ordered: Number(v) } : x)),
                                }));
                              }}
                            />
                          </div>
                          <div className="lg:col-span-2 space-y-2">
                            <Label>Unit Cost</Label>
                            <Input
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
                          </div>
                          <div className="lg:col-span-2 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => removeLine(idx)} disabled={form.items.length <= 1}>Remove</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by PO number or supplier..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading purchase orders...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No purchase orders</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Create a PO to start purchasing inventory."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">GRN</TableHead>
                    <TableHead className="hidden md:table-cell">Ordered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po) => (
                    <TableRow key={po.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">{po.po_number}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">PO ID: #{po.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{po.supplier_name ?? po.supplier_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{po.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {po.last_grn_number ? (
                          <Badge variant="outline" className="text-[10px]">{po.last_grn_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {po.ordered_at ? new Date(po.ordered_at.replace(" ", "T")).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => void openEdit(po.id)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onPrint(po.id)} title="Print">
                            <Printer className="w-4 h-4" />
                          </Button>
                          {isAdmin && String(po.status) !== "Received" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => onReceive(po.id)}
                              title="Mark as received (create GRN)"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => void quickStatus(po.id, "Sent")}
                              title="Mark Sent"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

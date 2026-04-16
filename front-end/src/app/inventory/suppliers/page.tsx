"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  createSupplier,
  deleteSupplier,
  fetchSupplier,
  fetchSuppliers,
  fetchTaxes,
  updateSupplier,
  type SupplierRow,
  type TaxRow,
} from "@/lib/api";
import { Plus, Search, Trash2, Pencil, Loader2, AlertCircle, Truck } from "lucide-react";
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

export default function SuppliersPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_reg_no: "",
    is_active: true,
    tax_ids: [] as number[],
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load suppliers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const loadTaxes = async () => {
    setLoadingTaxes(true);
    try {
      const data = await fetchTaxes("", { all: true });
      const rows = Array.isArray(data) ? (data as TaxRow[]) : [];
      setTaxes(rows.filter((t) => (t as any).is_active !== 0));
    } catch (e: any) {
      setTaxes([]);
      toast({ title: "Error", description: e?.message || "Failed to load taxes", variant: "destructive" });
    } finally {
      setLoadingTaxes(false);
    }
  };

  const loadSupplierDetails = async (id: number) => {
    try {
      const row = await fetchSupplier(String(id));
      setForm({
        name: row.name ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        address: row.address ?? "",
        tax_reg_no: (row as any).tax_reg_no ?? "",
        is_active: Boolean(row.is_active),
        tax_ids: Array.isArray((row as any).tax_ids) ? (row as any).tax_ids.map(Number) : [],
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load supplier details", variant: "destructive" });
      const s = items.find((x) => x.id === id);
      setForm({
        name: s?.name ?? "",
        email: s?.email ?? "",
        phone: s?.phone ?? "",
        address: s?.address ?? "",
        tax_reg_no: (s as any)?.tax_reg_no ?? "",
        is_active: Boolean(s?.is_active),
        tax_ids: [],
      });
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ name: "", email: "", phone: "", address: "", tax_reg_no: "", is_active: true, tax_ids: [] });
    setIsDialogOpen(true);
    void loadTaxes();
  };

  const openEdit = (s: SupplierRow) => {
    setEditId(s.id);
    setIsDialogOpen(true);
    void loadTaxes();
    void loadSupplierDetails(s.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        email: form.email.trim() ? form.email.trim() : null,
        phone: form.phone.trim() ? form.phone.trim() : null,
        address: form.address.trim() ? form.address.trim() : null,
        tax_reg_no: form.tax_reg_no.trim() ? form.tax_reg_no.trim() : null,
        is_active: form.is_active ? 1 : 0,
        tax_ids: form.tax_ids,
      };
      if (editId) {
        await updateSupplier(String(editId), payload);
        toast({ title: "Updated", description: "Supplier updated" });
      } else {
        await createSupplier(payload);
        toast({ title: "Created", description: "Supplier added" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      await deleteSupplier(String(id));
      toast({ title: "Deleted", description: "Supplier removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Delete failed", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage vendors for purchase orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {items.length} Suppliers
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{editId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
                  <DialogDescription>Supplier details for purchasing and GRN.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" className="col-span-3" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" className="col-span-3" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">Phone</Label>
                    <Input id="phone" className="col-span-3" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">Address</Label>
                    <Input id="address" className="col-span-3" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tax_reg_no" className="text-right">Tax Reg No</Label>
                    <Input
                      id="tax_reg_no"
                      className="col-span-3"
                      value={form.tax_reg_no}
                      onChange={(e) => setForm((p) => ({ ...p, tax_reg_no: e.target.value }))}
                      placeholder="Optional (VAT/SSCL registration)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Active</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
                      <span className="text-sm text-muted-foreground">{form.is_active ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Taxes</Label>
                    <div className="col-span-3">
                      <div className="text-xs text-muted-foreground mb-2">
                        Select taxes that apply to this supplier. Compound taxes are supported by Tax sort order.
                      </div>
                      {loadingTaxes ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading taxes...
                        </div>
                      ) : taxes.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No taxes found. Create taxes in Master Data → Taxes.</div>
                      ) : (
                        <div className="rounded-md border p-3 space-y-2 max-h-[220px] overflow-auto">
                          {taxes.map((t) => {
                            const checked = form.tax_ids.includes(Number(t.id));
                            return (
                              <label key={t.id} className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setForm((p) => {
                                      const cur = new Set<number>(p.tax_ids);
                                      if (on) cur.add(Number(t.id));
                                      else cur.delete(Number(t.id));
                                      return { ...p, tax_ids: Array.from(cur) };
                                    });
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">
                                    {t.code} <span className="text-muted-foreground font-normal">({Number(t.rate_percent ?? 0)}%)</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {t.name} • {t.apply_on === "base_plus_previous" ? "Base + previous taxes" : "Base"}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          <Input
            placeholder="Search suppliers..."
            className="pl-9 h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading suppliers...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No suppliers found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Add a supplier to create purchase orders."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Truck className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">SUPPLIER ID: #{s.id}</p>
                          </div>
                          {s.is_active ? null : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm text-muted-foreground">
                          <div>{s.email ?? "-"}</div>
                          <div>{s.phone ?? "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{s.address ?? "-"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(s.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

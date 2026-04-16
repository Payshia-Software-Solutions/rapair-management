"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  contentUrl,
  deletePart,
  fetchBrands,
  fetchPart,
  fetchSuppliers,
  fetchUnits,
  setPartImage,
  updatePart,
  uploadPartImage,
  type BrandRow,
  type SupplierRow,
  type UnitRow,
} from "@/lib/api";
import { ArrowLeft, ChevronDown, Image as ImageIcon, Loader2, Save, Sparkles, Trash2, Upload } from "lucide-react";

function asNumOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function generateSku() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  let rand = "";
  try {
    const bytes = new Uint8Array(3);
    globalThis.crypto.getRandomValues(bytes);
    rand = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  } catch {
    rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  }
  return `SKU-${ymd}-${rand}`;
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [part, setPart] = useState<any>(null);

  const [form, setForm] = useState({
    sku: "",
    part_number: "",
    barcode_number: "",
    part_name: "",
    unit: "",
    brand_id: "",
    cost_price: "",
    price: "",
    reorder_level: "",
    is_active: true,
    item_type: "Part" as "Part" | "Service",
  });

  const [supplierIds, setSupplierIds] = useState<number[]>([]);
  const [supplierQuery, setSupplierQuery] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, u, b, s] = await Promise.all([fetchPart(String(id)), fetchUnits(""), fetchBrands(""), fetchSuppliers("")]);
      setPart(p);
      setUnits(Array.isArray(u) ? u : []);
      setBrands(Array.isArray(b) ? b : []);
      setSuppliers(Array.isArray(s) ? s : []);
      setForm({
        sku: p?.sku ?? "",
        part_number: p?.part_number ?? "",
        barcode_number: p?.barcode_number ?? "",
        part_name: p?.part_name ?? "",
        unit: p?.unit ?? "",
        brand_id: p?.brand_id ? String(p.brand_id) : "",
        cost_price: p?.cost_price !== null && p?.cost_price !== undefined ? String(p.cost_price) : "",
        price: p?.price !== null && p?.price !== undefined ? String(p.price) : "",
        reorder_level: p?.reorder_level !== null && p?.reorder_level !== undefined ? String(p.reorder_level) : "",
        is_active: Boolean(p?.is_active),
        item_type: (p?.item_type === "Service" ? "Service" : "Part") as "Part" | "Service",
      });
      const ids = Array.isArray(p?.supplier_ids) ? (p.supplier_ids as any[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];
      setSupplierIds(Array.from(new Set(ids)).sort((a, b) => a - b));
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load product", variant: "destructive" });
      setPart(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const imageUrl = useMemo(() => {
    const fn = part?.image_filename ? String(part.image_filename) : "";
    return fn ? contentUrl("items", fn) : "";
  }, [part]);

  const lowStock = useMemo(() => {
    const stock = Number(part?.stock_quantity ?? 0);
    const r = part?.reorder_level;
    if (r === null || r === undefined) return false;
    return stock <= Number(r);
  }, [part]);

  const save = async () => {
    const name = form.part_name.trim();
    const price = asNumOrNull(form.price);
    if (!name || price === null) {
      toast({ title: "Validation", description: "Name and Selling price are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updatePart(String(id), {
        sku: form.sku.trim() ? form.sku.trim() : null,
        part_number: form.part_number.trim() ? form.part_number.trim() : null,
        barcode_number: form.barcode_number.trim() ? form.barcode_number.trim() : null,
        part_name: name,
        unit: form.unit.trim() ? form.unit.trim() : null,
        brand_id: form.brand_id.trim() ? Number(form.brand_id) : null,
        supplier_ids: supplierIds,
        cost_price: asNumOrNull(form.cost_price),
        price,
        reorder_level: asNumOrNull(form.reorder_level),
        is_active: form.is_active ? 1 : 0,
        image_filename: part?.image_filename ?? null,
        item_type: form.item_type,
      });
      toast({ title: "Saved", description: "Product updated" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this product?")) return;
    setSaving(true);
    try {
      await deletePart(String(id));
      toast({ title: "Deleted", description: "Product removed" });
      router.push("/inventory/items");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Delete failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    setSaving(true);
    try {
      const up = await uploadPartImage(file);
      if (up.status !== "success") throw new Error(up.message || "Upload failed");
      await setPartImage(String(id), up.data.filename);
      toast({ title: "Uploaded", description: "Image updated" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Upload failed", variant: "destructive" });
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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product #{id}</h1>
              <p className="text-muted-foreground mt-1">{part?.part_name ? part.part_name : "Product"}</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/items">All Products</Link>
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader>
            <CardTitle>Product</CardTitle>
            <CardDescription>Details, pricing, unit, image and stock</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : !part ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Not found</div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-4">
                    <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                      <div className="h-[220px] rounded-lg border bg-background overflow-hidden flex items-center justify-center">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-muted-foreground flex flex-col items-center gap-2">
                            <ImageIcon className="w-7 h-7" />
                            <div className="text-sm">No image</div>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileRef}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (!f) return;
                          void uploadImage(f);
                          e.currentTarget.value = "";
                        }}
                      />
	                      <div className="flex gap-2">
	                        <Button variant="outline" className="gap-2 w-full" onClick={() => fileRef.current?.click()} disabled={saving}>
	                          <Upload className="w-4 h-4" />
	                          Upload Image
	                        </Button>
	                      </div>
	                      {part?.image_filename ? (
	                        <div className="text-xs text-muted-foreground">
	                          Filename: <span className="font-mono">{String(part.image_filename)}</span>
	                        </div>
	                      ) : null}
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Item Type</Label>
                        <Select value={form.item_type} onValueChange={(v: any) => setForm((p) => ({ ...p, item_type: v }))}>
                          <SelectTrigger className="font-bold border-amber-200 bg-amber-50/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Part" className="font-bold">Part (Physical Goods)</SelectItem>
                            <SelectItem value="Service" className="font-bold">Service (Labor/Fee)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>SKU</Label>
                        <div className="flex gap-2">
                          <Input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 shrink-0"
                            onClick={() => setForm((p) => ({ ...p, sku: generateSku() }))}
                            disabled={saving}
                          >
                            <Sparkles className="w-4 h-4" />
                            Generate
                          </Button>
                        </div>
                        <div className="text-[11px] text-muted-foreground">Optional</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Part Number</Label>
                        <Input value={form.part_number} onChange={(e) => setForm((p) => ({ ...p, part_number: e.target.value }))} />
                        <div className="text-[11px] text-muted-foreground">Optional</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Barcode</Label>
                        <Input value={form.barcode_number} onChange={(e) => setForm((p) => ({ ...p, barcode_number: e.target.value }))} />
                        <div className="text-[11px] text-muted-foreground">Optional</div>
                      </div>
	                      <div className="space-y-2">
	                        <Label>Name</Label>
	                        <Input value={form.part_name} onChange={(e) => setForm((p) => ({ ...p, part_name: e.target.value }))} required />
	                      </div>
	                      <div className="space-y-2">
	                        <Label>Brand</Label>
	                        <Select value={form.brand_id} onValueChange={(v) => setForm((p) => ({ ...p, brand_id: v }))}>
	                          <SelectTrigger>
	                            <SelectValue placeholder="Select brand..." />
	                          </SelectTrigger>
	                          <SelectContent className="max-h-[280px]">
	                            {brands.map((b) => (
	                              <SelectItem key={b.id} value={String(b.id)}>
	                                {b.name}
	                              </SelectItem>
	                            ))}
	                          </SelectContent>
	                        </Select>
	                        <div className="text-[11px] text-muted-foreground">
	                          Manage brands in <Link className="underline" href="/master-data/brands">Master Data → Brands</Link>
	                        </div>
	                      </div>
	                      <div className="space-y-2">
	                        <Label>Unit</Label>
	                        <Select value={form.unit} onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}>
	                          <SelectTrigger>
                            <SelectValue placeholder="Select unit..." />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.name}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-[11px] text-muted-foreground">
                          Manage units in <Link className="underline" href="/master-data/units">Master Data → Units</Link>
                        </div>
                      </div>
	                      <div className="space-y-2">
	                        <Label>Suppliers</Label>
	                        <Popover>
	                          <PopoverTrigger asChild>
	                            <Button type="button" variant="outline" className="w-full justify-between" disabled={saving}>
	                              <span className="truncate">
	                                {supplierIds.length === 0 ? "Select suppliers..." : `${supplierIds.length} selected`}
	                              </span>
	                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
	                            </Button>
	                          </PopoverTrigger>
	                          <PopoverContent className="w-[360px] p-3" align="start">
	                            <div className="space-y-2">
	                              <Input placeholder="Search suppliers..." value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} />
	                              <ScrollArea className="h-[240px] pr-2">
	                                <div className="space-y-2">
	                                  {suppliers
	                                    .filter((s) => (s.name ?? "").toLowerCase().includes(supplierQuery.trim().toLowerCase()))
	                                    .map((s) => {
	                                      const sid = Number(s.id);
	                                      const checked = supplierIds.includes(sid);
	                                      return (
	                                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
	                                          <Checkbox
	                                            checked={checked}
	                                            onCheckedChange={(v) => {
	                                              setSupplierIds((prev) => {
	                                                const next = new Set(prev);
	                                                if (v) next.add(sid);
	                                                else next.delete(sid);
	                                                return Array.from(next).sort((a, b) => a - b);
	                                              });
	                                            }}
	                                          />
	                                          <span className="truncate">{s.name}</span>
	                                        </label>
	                                      );
	                                    })}
	                                  {suppliers.length === 0 ? (
	                                    <div className="text-xs text-muted-foreground py-4 text-center">No suppliers</div>
	                                  ) : null}
	                                </div>
	                              </ScrollArea>
	                            </div>
	                          </PopoverContent>
	                        </Popover>
	                        <div className="text-[11px] text-muted-foreground">Optional. You can assign multiple suppliers.</div>
	                      </div>
	                      <div className="space-y-2">
	                        <Label>Active</Label>
	                        <div className="h-11 flex items-center">
	                          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
	                        </div>
	                      </div>
                      <div className="space-y-2">
                        <Label>Cost Price</Label>
                        <Input inputMode="decimal" value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Selling Price</Label>
                        <Input inputMode="decimal" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Reorder Level</Label>
                        <Input inputMode="numeric" value={form.reorder_level} onChange={(e) => setForm((p) => ({ ...p, reorder_level: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Stock</Label>
                        <div className="h-11 flex items-center gap-2">
                          <Badge variant="outline" className="bg-muted/40">
                            {Number(part.stock_quantity ?? 0).toLocaleString()} {part.unit ?? ""}
                          </Badge>
                          {lowStock ? <Badge variant="destructive">Low</Badge> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => void load()} disabled={saving}>
                        Reload
                      </Button>
                      <Button className="gap-2" onClick={() => void save()} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </Button>
                      <Button variant="destructive" className="gap-2" onClick={() => void remove()} disabled={saving}>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Stock adjustments are handled in a separate page for safety/auditability. */}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  api,
  contentUrl,
  deletePart,
  fetchBrands,
  fetchCollections,
  fetchPart,
  fetchLocations,
  fetchSuppliers,
  fetchUnits,
  setPartImage,
  updatePart,
  uploadPartImage,
  type BrandRow,
  type ServiceLocation,
  type SupplierRow,
  type UnitRow,
} from "@/lib/api";
import { ArrowLeft, ChevronDown, LayoutGrid, Image as ImageIcon, Loader2, Save, Sparkles, Trash2, Upload } from "lucide-react";

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

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = React.use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [part, setPart] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);

  const [form, setForm] = useState({
    sku: "",
    part_number: "",
    barcode_number: "",
    part_name: "",
    unit: "",
    brand_id: "",
    cost_price: "",
    price: "",
    wholesale_price: "",
    min_selling_price: "",
    price_2: "",
    reorder_level: "",
    is_active: true,
    is_fifo: false,
    is_expiry: false,
    item_type: "Part" as "Part" | "Service",
    recipe_type: "Standard" as "Standard" | "A La Carte" | "Recipe",
    default_location_id: "" as string,
  });

  const [supplierIds, setSupplierIds] = useState<number[]>([]);
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<number[]>([]);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [collectionQuery, setCollectionQuery] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, u, b, s, c, locationsRes, batchesRes] = await Promise.all([
        fetchPart(String(id)), 
        fetchUnits(""), 
        fetchBrands(""), 
        fetchSuppliers(""),
        fetchCollections(),
        fetchLocations(),
        api(`/api/part/batches/${id}`).then(res => res.json())
      ]);
      setPart(p);
      setBatches(batchesRes?.status === 'success' ? batchesRes.data : (Array.isArray(batchesRes) ? batchesRes : []));
      setUnits(Array.isArray(u) ? u : []);
      setBrands(Array.isArray(b) ? b : []);
      setSuppliers(Array.isArray(s) ? s : []);
      setCollections(Array.isArray(c) ? c : []);
      setLocations(Array.isArray(locationsRes) ? locationsRes : []);
      setForm({
        sku: p?.sku ?? "",
        part_number: p?.part_number ?? "",
        barcode_number: p?.barcode_number ?? "",
        part_name: p?.part_name ?? "",
        unit: p?.unit ?? "",
        brand_id: p?.brand_id ? String(p.brand_id) : "",
        cost_price: p?.cost_price !== null && p?.cost_price !== undefined ? String(p.cost_price) : "",
        price: p?.price !== null && p?.price !== undefined ? String(p.price) : "",
        wholesale_price: p?.wholesale_price !== null && p?.wholesale_price !== undefined ? String(p.wholesale_price) : "",
        min_selling_price: p?.min_selling_price !== null && p?.min_selling_price !== undefined ? String(p.min_selling_price) : "",
        price_2: p?.price_2 !== null && p?.price_2 !== undefined ? String(p.price_2) : "",
        reorder_level: p?.reorder_level !== null && p?.reorder_level !== undefined ? String(p.reorder_level) : "",
        is_active: Boolean(p?.is_active),
        is_fifo: Boolean(p?.is_fifo),
        is_expiry: Boolean(p?.is_expiry),
        item_type: (p?.item_type === "Service" ? "Service" : "Part") as "Part" | "Service",
        recipe_type: (p?.recipe_type || "Standard") as "Standard" | "A La Carte" | "Recipe",
        default_location_id: p?.default_location_id ? String(p.default_location_id) : "",
      });
      const ids = Array.isArray(p?.supplier_ids) ? (p.supplier_ids as any[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];
      setSupplierIds(Array.from(new Set(ids)).sort((a, b) => a - b));
      const cids = Array.isArray(p?.collection_ids) ? (p.collection_ids as any[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];
      setCollectionIds(Array.from(new Set(cids)).sort((a, b) => a - b));

      const aloc = Array.isArray(p?.allowed_locations) 
        ? p.allowed_locations.map(Number) 
        : (typeof p?.allowed_locations === 'string' 
            ? (JSON.parse(p.allowed_locations) as any[] || []).map(Number) 
            : []);
      setAllowedLocationIds(Array.from(new Set(aloc)).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b));
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
        collection_ids: collectionIds,
        cost_price: asNumOrNull(form.cost_price),
        price,
        wholesale_price: asNumOrNull(form.wholesale_price),
        min_selling_price: asNumOrNull(form.min_selling_price),
        price_2: asNumOrNull(form.price_2),
        reorder_level: asNumOrNull(form.reorder_level),
        is_active: form.is_active ? 1 : 0,
        is_fifo: form.is_fifo ? 1 : 0,
        is_expiry: form.is_expiry ? 1 : 0,
        image_filename: part?.image_filename ?? null,
        item_type: form.item_type,
        recipe_type: form.recipe_type,
        default_location_id: (form.default_location_id && form.default_location_id !== "none") ? Number(form.default_location_id) : null,
        allowed_locations: JSON.stringify(allowedLocationIds),
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
                        <Label>Recipe Type</Label>
                        <Select value={form.recipe_type} onValueChange={(v: any) => setForm((p) => ({ ...p, recipe_type: v }))}>
                          <SelectTrigger className="font-bold border-blue-200 bg-blue-50/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Standard" className="font-bold">Standard (GRN & Sell)</SelectItem>
                            <SelectItem value="A La Carte" className="font-bold">A La Carte (Needs BOM)</SelectItem>
                            <SelectItem value="Recipe" className="font-bold">Recipe (Needs BOM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Stock Location</Label>
                        <Select value={form.default_location_id} onValueChange={(v) => setForm((p) => ({ ...p, default_location_id: v }))}>
                          <SelectTrigger className="font-bold border-green-200 bg-green-50/30">
                            <SelectValue placeholder="Select location..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="italic">Inherit from Invoice/POS</SelectItem>
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={String(loc.id)}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-[10px] text-muted-foreground -mt-1 line-clamp-2 italic">A La Carte items will ALWAYS deduct ingredients from this location.</div>
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
                      <div className="space-y-2 col-span-1 md:col-span-2">
                        <Label>Suppliers</Label>
                        <div className="rounded-md border p-4 bg-muted/5 space-y-3">
                          <Input 
                            placeholder="Search suppliers..." 
                            value={supplierQuery} 
                            onChange={(e) => setSupplierQuery(e.target.value)} 
                            className="h-8 text-sm"
                          />
                          <ScrollArea className="h-[120px] pr-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {suppliers
                                .filter((s) => (s.name ?? "").toLowerCase().includes(supplierQuery.trim().toLowerCase()))
                                .map((s) => {
                                  const sid = Number(s.id);
                                  const checked = supplierIds.includes(sid);
                                  return (
                                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer select-none hover:bg-muted/50 p-1.5 rounded-sm transition-colors border border-transparent hover:border-muted-foreground/20">
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
                                      <span className="truncate flex-1">{s.name}</span>
                                    </label>
                                  );
                                })}
                              {suppliers.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-4 text-center col-span-full">No suppliers found</div>
                              ) : null}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="text-[11px] text-muted-foreground">Select multiple suppliers for this product.</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Collections</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between" disabled={saving}>
                              <span className="truncate">
                                {collectionIds.length === 0 ? "Select collections..." : `${collectionIds.length} selected`}
                              </span>
                              <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[360px] p-3" align="start">
                            <div className="space-y-2">
                              <Input placeholder="Search collections..." value={collectionQuery} onChange={(e) => setCollectionQuery(e.target.value)} />
                              <ScrollArea className="h-[240px] pr-2">
                                <div className="space-y-2">
                                  {collections
                                    .filter((c) => (c.name ?? "").toLowerCase().includes(collectionQuery.trim().toLowerCase()))
                                    .map((c) => {
                                      const cid = Number(c.id);
                                      const checked = collectionIds.includes(cid);
                                      return (
                                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(v) => {
                                              setCollectionIds((prev) => {
                                                const next = new Set(prev);
                                                if (v) next.add(cid);
                                                else next.delete(cid);
                                                return Array.from(next).sort((a, b) => a - b);
                                              });
                                            }}
                                          />
                                          <span className="truncate">{c.name}</span>
                                        </label>
                                      );
                                    })}
                                  {collections.length === 0 ? (
                                    <div className="text-xs text-muted-foreground py-4 text-center">No collections</div>
                                  ) : null}
                                </div>
                              </ScrollArea>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <div className="text-[11px] text-muted-foreground">Group this product for POS filtering.</div>
                      </div>
                      <div className="space-y-2 col-span-1 md:col-span-2">
                        <Label>Allowed Stock Locations</Label>
                        <div className="rounded-md border p-4 bg-muted/5 space-y-2">
                          <ScrollArea className="h-[120px] pr-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              {locations.map((loc) => {
                                const checked = allowedLocationIds.includes(loc.id);
                                return (
                                  <label key={loc.id} className="flex items-center gap-2 text-sm cursor-pointer select-none hover:bg-muted/50 p-1.5 rounded-md transition-colors border border-transparent hover:border-muted-foreground/10">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        setAllowedLocationIds((prev) => {
                                          const next = new Set(prev);
                                          if (v) next.add(loc.id);
                                          else next.delete(loc.id);
                                          return Array.from(next).sort((a, b) => a - b);
                                        });
                                      }}
                                    />
                                    <span className="truncate flex-1 font-medium">{loc.name}</span>
                                  </label>
                                );
                              })}
                              {locations.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-4 text-center col-span-full italic">No locations configured</div>
                              ) : null}
                            </div>
                          </ScrollArea>
                          <div className="text-[11px] text-muted-foreground border-t pt-2">Limit which locations can sell this item. Leave empty for "All Locations".</div>
                        </div>
                      </div>
	                      <div className="space-y-2">
	                        <Label>Active</Label>
	                        <div className="h-11 flex items-center">
	                          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
	                        </div>
	                      </div>
                          <div className="space-y-2">
                            <Label>Follow FIFO</Label>
                            <div className="h-11 flex items-center">
                              <Switch checked={form.is_fifo} onCheckedChange={(v) => setForm((p) => ({ ...p, is_fifo: v }))} />
                            </div>
                            <div className="text-[10px] text-muted-foreground -mt-1 line-clamp-1">Track stock by oldest batch first</div>
                          </div>
                          <div className="space-y-2">
                            <Label>Track Expiry</Label>
                            <div className="h-11 flex items-center">
                              <Switch checked={form.is_expiry} onCheckedChange={(v) => setForm((p) => ({ ...p, is_expiry: v }))} />
                            </div>
                            <div className="text-[10px] text-muted-foreground -mt-1 line-clamp-1">Capture Mfg/Expiry dates during GRN</div>
                          </div>
                      <div className="space-y-2">
                        <Label>Cost Price</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          inputMode="decimal" 
                          value={Number.isFinite(Number(form.cost_price)) ? Number(form.cost_price).toFixed(2) : "0.00"} 
                          onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Selling Price</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          inputMode="decimal" 
                          value={form.price} 
                          onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Wholesale Price</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          inputMode="decimal" 
                          value={form.wholesale_price} 
                          onChange={(e) => setForm((p) => ({ ...p, wholesale_price: e.target.value }))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Min. Selling Price</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          inputMode="decimal" 
                          value={form.min_selling_price} 
                          onChange={(e) => setForm((p) => ({ ...p, min_selling_price: e.target.value }))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price 2 Option</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          inputMode="decimal" 
                          value={form.price_2} 
                          onChange={(e) => setForm((p) => ({ ...p, price_2: e.target.value }))} 
                        />
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

                {(form.is_fifo || form.is_expiry) && batches.length > 0 && (
                  <div className="mt-8 border-t pt-8">
                    <h3 className="text-lg font-semibold mb-4">Stored Batches</h3>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Batch No</TableHead>
                            <TableHead>Mfg Date</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="font-medium">{b.batch_number || "N/A"}</TableCell>
                              <TableCell>{b.mfg_date || "N/A"}</TableCell>
                              <TableCell>
                                {b.expiry_date || "N/A"}
                                {b.expiry_date && new Date(b.expiry_date) < new Date() && (
                                  <Badge variant="destructive" className="ml-2 py-0 h-5">Expired</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {Number(b.quantity_on_hand).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

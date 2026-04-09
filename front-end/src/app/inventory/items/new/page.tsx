"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createPart, fetchParts, fetchUnits, uploadPartImage, type UnitRow } from "@/lib/api";
import { ArrowLeft, Loader2, Plus, Sparkles, Upload } from "lucide-react";

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

export default function NewItemPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sku: "",
    part_number: "",
    barcode_number: "",
    part_name: "",
    unit: "",
    cost_price: "",
    price: "",
    reorder_level: "",
    is_active: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [skuTaken, setSkuTaken] = useState(false);
  const lastSkuCheck = useRef<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const u = await fetchUnits("");
        setUnits(Array.isArray(u) ? u : []);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load units", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const sku = form.sku.trim();
    if (!sku) {
      setSkuTaken(false);
      return;
    }
    if (sku === lastSkuCheck.current) return;
    lastSkuCheck.current = sku;
    void (async () => {
      try {
        const parts = await fetchParts(sku);
        const taken = Array.isArray(parts) ? parts.some((p: any) => String(p.sku || "").toLowerCase() === sku.toLowerCase()) : false;
        setSkuTaken(taken);
      } catch {
        setSkuTaken(false);
      }
    })();
  }, [form.sku]);

  const canSave = useMemo(() => {
    const nameOk = form.part_name.trim().length > 0;
    const priceOk = asNumOrNull(form.price) !== null;
    return nameOk && priceOk && !skuTaken;
  }, [form, skuTaken]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let image_filename: string | null = null;
      if (imageFile) {
        const up = await uploadPartImage(imageFile);
        if (up.status !== "success") throw new Error(up.message || "Image upload failed");
        image_filename = up.data.filename;
      }

      await createPart({
        sku: form.sku.trim() ? form.sku.trim() : null,
        part_number: form.part_number.trim() ? form.part_number.trim() : null,
        barcode_number: form.barcode_number.trim() ? form.barcode_number.trim() : null,
        part_name: form.part_name.trim(),
        unit: form.unit.trim() ? form.unit.trim() : null,
        stock_quantity: 0,
        cost_price: asNumOrNull(form.cost_price),
        price: asNumOrNull(form.price) ?? 0,
        reorder_level: asNumOrNull(form.reorder_level),
        is_active: form.is_active ? 1 : 0,
        image_filename,
      });

      toast({ title: "Created", description: "Product created" });
      router.push("/inventory/items");
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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Product</h1>
              <p className="text-muted-foreground mt-1">Create an item with unit, pricing and image</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/items">All Products</Link>
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Required: Name and Selling price</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <div className="flex gap-2">
                      <Input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 shrink-0"
                        onClick={() => setForm((p) => ({ ...p, sku: generateSku() }))}
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate
                      </Button>
                    </div>
                    {skuTaken ? <div className="text-xs text-destructive">SKU already exists</div> : null}
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
                    <Label>Image</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                    <div className="text-[11px] text-muted-foreground">Optional</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => router.push("/inventory/items")} disabled={saving}>
                    Cancel
                  </Button>
                  <Button className="gap-2" onClick={() => void save()} disabled={!canSave || saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

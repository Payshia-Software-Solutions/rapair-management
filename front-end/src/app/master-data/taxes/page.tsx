"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createTax, deleteTax, fetchTaxes, updateTax, type TaxRow } from "@/lib/api";
import { Plus, Search, Trash2, Pencil, Loader2, AlertCircle, Percent } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmtPct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export default function TaxesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState<string>("0");
  const [applyOn, setApplyOn] = useState<"base" | "base_plus_previous">("base");
  const [sortOrder, setSortOrder] = useState<string>("100");
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTaxes("", { all: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load taxes", variant: "destructive" });
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
    return items.filter((t) => {
      const a = (t.code ?? "").toLowerCase();
      const b = (t.name ?? "").toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setCode("");
    setName("");
    setRatePercent("0");
    setApplyOn("base");
    setSortOrder("100");
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEdit = (t: TaxRow) => {
    setEditId(t.id);
    setCode(String(t.code ?? ""));
    setName(String(t.name ?? ""));
    setRatePercent(String(t.rate_percent ?? 0));
    setApplyOn((t.apply_on as any) === "base_plus_previous" ? "base_plus_previous" : "base");
    setSortOrder(String(t.sort_order ?? 100));
    setIsActive(Boolean(t.is_active));
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const n = name.trim();
    const rp = Number(ratePercent);
    const so = Number(sortOrder);
    if (!c || !n) return;
    if (!Number.isFinite(rp) || rp < 0) {
      toast({ title: "Invalid rate", description: "Rate must be a number (>= 0).", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(so)) {
      toast({ title: "Invalid sort order", description: "Sort order must be a number.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: c,
        name: n,
        rate_percent: rp,
        apply_on: applyOn,
        sort_order: Math.trunc(so),
        is_active: (isActive ? 1 : 0) as 0 | 1,
      };
      if (editId) {
        await updateTax(String(editId), payload);
        toast({ title: "Updated", description: "Tax updated" });
      } else {
        await createTax(payload);
        toast({ title: "Created", description: "Tax created" });
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
    if (!confirm("Delete this tax?")) return;
    try {
      await deleteTax(String(id));
      toast({ title: "Deleted", description: "Tax removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Delete failed", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Taxes</h1>
          <p className="text-muted-foreground mt-1">Tax master (supports compound taxes like VAT on base + previous taxes)</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {items.length} Taxes
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Tax
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{editId ? "Edit Tax" : "Add Tax"}</DialogTitle>
                  <DialogDescription>
                    Example: SSCL (base), VAT (base + previous taxes).
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Code</Label>
                    <Input
                      id="code"
                      className="col-span-3"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g., VAT"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                      id="name"
                      className="col-span-3"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Value Added Tax"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rate" className="text-right">Rate %</Label>
                    <Input
                      id="rate"
                      className="col-span-3"
                      value={ratePercent}
                      onChange={(e) => setRatePercent(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g., 18"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Apply On</Label>
                    <div className="col-span-3">
                      <Select value={applyOn} onValueChange={(v) => setApplyOn(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select calculation base..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base">Base amount only</SelectItem>
                          <SelectItem value="base_plus_previous">Base + previous taxes (compound)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground mt-1">
                        Use “compound” for VAT when VAT is calculated on base + SSCL, etc.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sort" className="text-right">Sort</Label>
                    <Input
                      id="sort"
                      className="col-span-3"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g., 10"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Active</Label>
                    <div className="col-span-3 flex items-center gap-3">
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                      <span className="text-sm text-muted-foreground">{isActive ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
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
          <Input placeholder="Search taxes..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading taxes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No taxes found</h3>
                <p className="text-muted-foreground max-w-xs">{query ? "No results match your search." : "Add your first tax."}</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Apply On</TableHead>
                    <TableHead className="text-right">Sort</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Percent className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div>{t.code}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">TAX ID: #{t.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.name}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtPct(Number(t.rate_percent ?? 0))}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.apply_on === "base_plus_previous" ? "Base + previous taxes" : "Base"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{t.sort_order ?? 100}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.is_active ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-muted"}>
                          {t.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(t.id)}>
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


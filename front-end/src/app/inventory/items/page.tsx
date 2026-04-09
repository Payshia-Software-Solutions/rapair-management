"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { contentUrl, fetchParts, type PartRow } from "@/lib/api";
import { Boxes, Grid3X3, LayoutList, Loader2, Plus, Search, Image as ImageIcon } from "lucide-react";

type ViewMode = "table" | "grid";

const LS_VIEW_KEY = "inventory_items_view";
const LS_SIZE_KEY = "inventory_items_page_size";

export default function InventoryItemsListPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PartRow[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [pageSize, setPageSize] = useState<number>(12);
  const [page, setPage] = useState<number>(1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchParts("");
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(LS_VIEW_KEY);
      if (v === "grid" || v === "table") setView(v);
      const s = Number(window.localStorage.getItem(LS_SIZE_KEY));
      if (Number.isFinite(s) && s > 0) setPageSize(s);
    } catch {
      // ignore
    }
    void load();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_VIEW_KEY, view);
    } catch {}
  }, [view]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_SIZE_KEY, String(pageSize));
    } catch {}
  }, [pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q
      ? items
      : items.filter((p) => (p.part_name ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
    return [...rows].sort((a, b) => String(a.part_name ?? "").localeCompare(String(b.part_name ?? "")));
  }, [items, query]);

  const pageCount = useMemo(() => {
    const c = Math.ceil(filtered.length / pageSize);
    return c <= 0 ? 1 : c;
  }, [filtered.length, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
    if (page < 1) setPage(1);
  }, [page, pageCount]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const Pagination = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{" "}
        <span className="font-semibold text-foreground">{Math.min(page * pageSize, filtered.length)}</span> of{" "}
        <span className="font-semibold text-foreground">{filtered.length}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            const n = Number(v);
            setPageSize(Number.isFinite(n) && n > 0 ? n : 12);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 24, 48].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </Button>
        <Badge variant="outline" className="px-3 py-2">
          Page {page} / {pageCount}
        </Badge>
        <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
          Next
        </Button>
      </div>
    </div>
  );

  const thumb = (p: any) => {
    const fn = p?.image_filename ? String(p.image_filename) : "";
    if (!fn) return null;
    return contentUrl("items", fn);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground mt-1">Item master (list view). Click an item to edit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[340px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                className="pl-9 h-11"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")} className="gap-2">
                <LayoutList className="w-4 h-4" />
                Table
              </Button>
              <Button variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")} className="gap-2">
                <Grid3X3 className="w-4 h-4" />
                Grid
              </Button>
            </div>
            <Button asChild className="gap-2">
              <Link href="/inventory/items/new">
                <Plus className="w-4 h-4" />
                New
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {items.length} Items
          </Badge>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-16 text-center">No items found</div>
            ) : (
              <div className="space-y-4">
                {Pagination}
                {view === "table" ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-[130px]">Stock</TableHead>
                          <TableHead className="hidden md:table-cell w-[140px]">Cost</TableHead>
                          <TableHead className="hidden md:table-cell w-[140px]">Selling</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paged.map((p) => {
                          const url = thumb(p);
                          return (
                            <TableRow key={p.id} className="hover:bg-muted/10">
                              <TableCell>
                                <Link href={`/inventory/items/${p.id}`} className="flex items-center gap-3 min-w-0">
                                  <div className="h-12 w-12 rounded-lg border bg-muted/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold truncate">{p.part_name}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold truncate">
                                      {p.sku ? `SKU: ${p.sku}` : `ITEM ID: #${p.id}`}
                                    </div>
                                  </div>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <div className="font-bold">
                                  {Number(p.stock_quantity ?? 0).toLocaleString()}{" "}
                                  {p.unit ? <span className="text-xs text-muted-foreground font-normal">{p.unit}</span> : null}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                {p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price).toFixed(2) : "-"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm">
                                {p.price !== null && p.price !== undefined ? Number(p.price).toFixed(2) : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paged.map((p) => {
                      const url = thumb(p);
                      return (
                        <Link key={p.id} href={`/inventory/items/${p.id}`} className="block">
                          <Card className="border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-14 w-14 rounded-xl border bg-muted/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold truncate">{p.part_name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{p.sku ? p.sku : `#${p.id}`}</div>
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-muted/40">
                                  {Number(p.stock_quantity ?? 0).toLocaleString()} {p.unit ?? ""}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="text-muted-foreground">Selling</div>
                                <div className="font-semibold">{p.price !== null && p.price !== undefined ? Number(p.price).toFixed(2) : "-"}</div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {Pagination}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


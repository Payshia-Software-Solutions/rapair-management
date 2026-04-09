"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchLocationStockBalances, fetchLocations, type LocationStockBalanceRow, type PartRow, type ServiceLocationRow } from "@/lib/api";
import { Search, Loader2, AlertCircle, ListOrdered, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function StockPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<LocationStockBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [locationId, setLocationId] = useState<number>(1);

  // Movements are now shown on a separate page.

  const load = async (opts: { locationId?: number; q?: string } = {}) => {
    setLoading(true);
    try {
      const lid = Number(opts.locationId ?? locationId ?? 1) || 1;
      const q = String(opts.q ?? query ?? "");
      const data = await fetchLocationStockBalances(lid, q);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load stock", variant: "destructive" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const decodeToken = () => {
      try {
        const token = window.localStorage.getItem("auth_token");
        if (!token) return null;
        const part = token.split(".")[1];
        return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      } catch {
        return null;
      }
    };

    const init = async () => {
      try {
        const tokenJson: any = decodeToken();
        const role = String(tokenJson?.role ?? "");
        const allowed = Array.isArray(tokenJson?.allowed_locations) ? tokenJson.allowed_locations : [];
        const allowedLocs = allowed
          .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
          .filter((x: any) => x.id > 0 && x.name);

        let locs: Array<{ id: number; name: string }> = [];
        if (role === "Admin") {
          const rows = await fetchLocations();
          locs = Array.isArray(rows)
            ? (rows as ServiceLocationRow[]).map((l) => ({ id: Number(l.id), name: String(l.name ?? "") })).filter((l) => l.id > 0 && l.name)
            : [];
        } else {
          locs = allowedLocs;
        }
        if (locs.length === 0) locs = [{ id: 1, name: "Main" }];
        setLocations(locs);

        const ls = Number(window.localStorage.getItem("location_id") || 0);
        const initId = (ls > 0 ? ls : (locs[0]?.id ?? 1));
        setLocationId(initId);
        await load({ locationId: initId, q: "" });
      } catch (e: any) {
        setLocations([{ id: 1, name: "Main" }]);
        setLocationId(1);
        await load({ locationId: 1, q: "" });
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let base = items;
    if (onlyLow) {
      base = base.filter((p: any) => {
        const qty = Number((p as any).location_stock_quantity ?? 0);
        return p.reorder_level !== null && p.reorder_level !== undefined && qty <= Number(p.reorder_level);
      });
    }
    return base;
  }, [items, onlyLow]);

  const totals = useMemo(() => {
    const totalQty = items.reduce((sum, p: any) => sum + Number((p as any).location_stock_quantity ?? 0), 0);
    const totalValue = items.reduce((sum, p) => {
      const cost = p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : 0;
      const qty = Number((p as any).location_stock_quantity ?? 0);
      return sum + cost * qty;
    }, 0);
    return { totalQty, totalValue };
  }, [items]);

  const openMovements = (p: PartRow) => {
    router.push(`/inventory/stock/movements/${encodeURIComponent(String(p.id))}?location_id=${encodeURIComponent(String(locationId))}`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock</h1>
          <p className="text-muted-foreground mt-1">Stock balances and movement history</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {totals.totalQty.toLocaleString()} Units
          </Badge>
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-muted/50">
            Value {totals.totalValue.toFixed(2)}
          </Badge>
          <Button variant={onlyLow ? "default" : "outline"} onClick={() => setOnlyLow((p) => !p)}>
            Low Stock
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            className="pl-9 h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load({ locationId, q: query.trim() });
              }
            }}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Location</div>
            <select
              className="h-11 min-w-[260px] rounded-md border bg-background px-3 text-sm"
              value={String(locationId)}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLocationId(v);
                void load({ locationId: v, q: query.trim() });
              }}
            >
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={() => void load({ locationId, q: query.trim() })}>Search</Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading stock...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No items</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Create items and receive stock to see balances here."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>On Hand</TableHead>
                    <TableHead className="hidden md:table-cell">Cost</TableHead>
                    <TableHead className="hidden lg:table-cell">Value</TableHead>
                    <TableHead className="text-right">History</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const cost = p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : 0;
                    const qty = Number((p as any).location_stock_quantity ?? 0);
                    const sys = Number((p as any).system_stock_quantity ?? (p as any).stock_quantity ?? 0);
                    const value = cost * qty;
                    const low = p.reorder_level !== null && p.reorder_level !== undefined ? qty <= Number(p.reorder_level) : false;
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <ListOrdered className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold truncate">{p.part_name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{p.sku ? `SKU: ${p.sku}` : `ITEM ID: #${p.id}`}</p>
                            </div>
                            {low ? <Badge variant="destructive" className="text-[10px]">Low</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">
                          <div>
                            {qty.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{" "}
                            {p.unit ? <span className="text-xs text-muted-foreground font-normal">{p.unit}</span> : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-normal">System: {sys.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{cost ? cost.toFixed(2) : "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{value ? value.toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => void openMovements(p)}>
                            <History className="w-4 h-4" />
                            Movements
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

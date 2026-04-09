"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchPartMovements, fetchParts, type PartRow } from "@/lib/api";
import { Search, Loader2, AlertCircle, ListOrdered, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function StockPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [activePart, setActivePart] = useState<PartRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchParts();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load stock", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = items;
    if (q) {
      base = base.filter((p) => (p.part_name ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
    }
    if (onlyLow) {
      base = base.filter((p) => p.reorder_level !== null && p.reorder_level !== undefined && p.stock_quantity <= Number(p.reorder_level));
    }
    return base;
  }, [items, query, onlyLow]);

  const totals = useMemo(() => {
    const totalQty = items.reduce((sum, p) => sum + Number(p.stock_quantity ?? 0), 0);
    const totalValue = items.reduce((sum, p) => {
      const cost = p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : 0;
      const qty = Number(p.stock_quantity ?? 0);
      return sum + cost * qty;
    }, 0);
    return { totalQty, totalValue };
  }, [items]);

  const openMovements = async (p: PartRow) => {
    setActivePart(p);
    setMovementsOpen(true);
    setMovements([]);
    setMovementsLoading(true);
    try {
      const data = await fetchPartMovements(String(p.id), 200);
      setMovements(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load movements", variant: "destructive" });
    } finally {
      setMovementsLoading(false);
    }
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
          <Input placeholder="Search items..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                    const qty = Number(p.stock_quantity ?? 0);
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
                          {qty.toLocaleString()} {p.unit ? <span className="text-xs text-muted-foreground font-normal">{p.unit}</span> : null}
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

      <Dialog open={movementsOpen} onOpenChange={setMovementsOpen}>
        <DialogContent className="sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>Stock Movements</DialogTitle>
            <DialogDescription>
              {activePart ? (
                <span>
                  {activePart.part_name} {activePart.sku ? `(${activePart.sku})` : ""} | On hand:{" "}
                  {Number(activePart.stock_quantity ?? 0).toLocaleString()}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading movements...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">No movements</TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.id}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{m.movement_type}</Badge></TableCell>
                      <TableCell className={`font-bold ${Number(m.qty_change) < 0 ? "text-destructive" : "text-green-700"}`}>
                        {Number(m.qty_change).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.ref_table ? `${m.ref_table}#${m.ref_id ?? ""}` : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {m.created_at ? new Date(String(m.created_at).replace(" ", "T")).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}


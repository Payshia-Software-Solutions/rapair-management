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
import { fetchLocations, fetchStockAdjustmentBatchesForLocation, type StockAdjustmentBatchRow } from "@/lib/api";
import { ArrowLeftRight, Loader2, MapPin, Plus, Search } from "lucide-react";

const LS_SIZE_KEY = "stock_adj_batches_page_size";
const LS_LOC_KEY = "stock_adj_location_id";

type AllowedLocation = { id: number; name: string };

function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function StockAdjustmentsListPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockAdjustmentBatchRow[]>([]);
  const [query, setQuery] = useState("");

  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);

  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState<number>(1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchStockAdjustmentBatchesForLocation(query.trim(), locationId ?? undefined);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load adjustments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const s = Number(window.localStorage.getItem(LS_SIZE_KEY));
      if (Number.isFinite(s) && s > 0) setPageSize(s);
    } catch {}

    // Load allowed locations (admin: all locations; non-admin: allowed_locations from JWT)
    void (async () => {
      try {
        const token = window.localStorage.getItem("auth_token") ?? "";
        const payload = token ? decodeJwtPayload(token) : null;
        const role = String(payload?.role ?? "");

        const lsLoc = Number(window.localStorage.getItem(LS_LOC_KEY) ?? "");
        const fallbackLoc = Number(window.localStorage.getItem("location_id") ?? "");

        if (role === "Admin") {
          const locs = await fetchLocations();
          const cleaned: AllowedLocation[] = Array.isArray(locs)
            ? locs
                .map((l: any) => ({ id: Number(l?.id), name: String(l?.name ?? "") }))
                .filter((x: AllowedLocation) => x.id > 0 && x.name)
            : [];
          setLocations(cleaned);
          const init = (Number.isFinite(lsLoc) && lsLoc > 0 ? lsLoc : (Number.isFinite(fallbackLoc) && fallbackLoc > 0 ? fallbackLoc : null));
          setLocationId(init && cleaned.some((l) => l.id === init) ? init : (cleaned[0]?.id ?? null));
          return;
        }

        const allowed: AllowedLocation[] = Array.isArray(payload?.allowed_locations)
          ? payload.allowed_locations
              .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
              .filter((x: AllowedLocation) => x.id > 0 && x.name)
          : [];
        const tokenLocId = payload?.location_id ? Number(payload.location_id) : 1;
        const tokenLocName = payload?.location_name ? String(payload.location_name) : "Main";
        const finalAllowed = allowed.length > 0 ? allowed : [{ id: tokenLocId, name: tokenLocName }];
        setLocations(finalAllowed);
        const init = Number.isFinite(lsLoc) && lsLoc > 0 ? lsLoc : (Number.isFinite(fallbackLoc) && fallbackLoc > 0 ? fallbackLoc : tokenLocId);
        setLocationId(finalAllowed.some((l) => l.id === init) ? init : finalAllowed[0].id);
      } catch {
        setLocations([]);
        setLocationId(null);
      }
    })();

    void load();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_SIZE_KEY, String(pageSize));
    } catch {}
  }, [pageSize]);

  useEffect(() => {
    // Reload when searching
    setPage(1);
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    // Reload when location changes
    if (!locationId) return;
    try {
      window.localStorage.setItem(LS_LOC_KEY, String(locationId));
    } catch {}
    setPage(1);
    void load();
  }, [locationId]);

  const pageCount = useMemo(() => {
    const c = Math.ceil(rows.length / pageSize);
    return c <= 0 ? 1 : c;
  }, [rows.length, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
    if (page < 1) setPage(1);
  }, [page, pageCount]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-primary" />
              Stock Adjustments
            </h1>
            <p className="text-muted-foreground mt-1">Batch adjustments with one adjustment number per operation</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/inventory/stock/adjustments/new">
              <Plus className="w-4 h-4" />
              New Adjustment
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-[380px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search adjustment number or reason..."
              className="pl-9 h-11"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Location</span>
            </div>
            <Select
              value={locationId ? String(locationId) : ""}
              onValueChange={(v) => {
                const n = Number(v);
                setLocationId(Number.isFinite(n) && n > 0 ? n : null);
              }}
              disabled={locations.length === 0}
            >
              <SelectTrigger className="w-[220px] h-11">
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="bg-muted/40">
              {rows.length} adjustments
            </Badge>
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-16 text-center">No adjustments found</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    <span className="font-semibold text-foreground">{rows.length === 0 ? 0 : (page - 1) * pageSize + 1}</span>{" "}
                    to{" "}
                    <span className="font-semibold text-foreground">{Math.min(page * pageSize, rows.length)}</span>{" "}
                    of <span className="font-semibold text-foreground">{rows.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        const n = Number(v);
                        setPageSize(Number.isFinite(n) && n > 0 ? n : 15);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 30, 60].map((n) => (
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
                    <Button
                      variant="outline"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Adjustment</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="hidden md:table-cell">Reason</TableHead>
                        <TableHead className="w-[120px]">Lines</TableHead>
                        <TableHead className="w-[120px]">Total Qty</TableHead>
                        <TableHead className="hidden lg:table-cell">By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/10">
                          <TableCell>
                            <Link href={`/inventory/stock/adjustments/${r.id}`} className="font-semibold hover:underline">
                              {r.adjustment_number}
                            </Link>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                              ID: #{r.id}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.adjusted_at ? new Date(String(r.adjusted_at).replace(" ", "T")).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.reason ?? "-"}</TableCell>
                          <TableCell className="font-semibold">{Number(r.line_count ?? 0).toLocaleString()}</TableCell>
                          <TableCell className={`font-bold ${Number(r.total_qty_change ?? 0) < 0 ? "text-destructive" : Number(r.total_qty_change ?? 0) > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                            {Number(r.total_qty_change ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.created_by_name ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

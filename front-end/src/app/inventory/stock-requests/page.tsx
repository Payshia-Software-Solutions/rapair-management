"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchRequisitions, type StockRequisitionRow } from "@/lib/api";
import { Loader2, Plus, RefreshCcw, ArrowLeftRight, CheckCircle2, Hourglass } from "lucide-react";

function badgeClass(s: string) {
  const v = String(s || "").toLowerCase();
  if (v === "fulfilled") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (v === "approved") return "bg-sky-500/10 text-sky-700 border-sky-500/20";
  if (v === "requested") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  if (v === "pending approval") return "bg-violet-500/10 text-violet-700 border-violet-500/20";
  if (v === "rejected") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  return "bg-muted text-foreground";
}

export default function StockRequestsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockRequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRequisitions();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRows([]);
      toast({ title: "Error", description: e?.message || "Failed to load stock requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const [filter, setFilter] = useState<string>("All");
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: rows.length };
    for (const r of rows) c[String(r.status)] = (c[String(r.status)] ?? 0) + 1;
    return c;
  }, [rows]);

  const enriched = useMemo(() => {
    return (rows ?? []).filter((r) => filter === "All" || String(r.status) === filter).map((r) => {
      const req = Number(r.total_qty_requested ?? 0);
      const ful = Number(r.total_qty_fulfilled ?? 0);
      const pct = req > 0 ? Math.max(0, Math.min(100, Math.round((ful / req) * 100))) : 0;
      return { ...r, _req: req, _ful: ful, _pct: pct };
    });
  }, [rows, filter]);

  const FILTERS = ["All", "Pending Approval", "Requested", "Approved", "Rejected", "Fulfilled"];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Requests</h1>
          <p className="text-muted-foreground mt-1">Destination locations request stock; warehouses fulfill via transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
          <Button asChild className="gap-2">
            <Link href="/inventory/stock-requests/new">
              <Plus className="w-4 h-4" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Requests</CardTitle>
          <CardDescription>Pending approval, requested and approved requests</CardDescription>
          <div className="flex flex-wrap gap-2 pt-3" role="tablist" aria-label="Filter by status">
            {FILTERS.filter((f) => f === "All" || counts[f]).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {f} <span className="ml-1 opacity-70">{counts[f] ?? 0}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading requests...</p>
            </div>
          ) : enriched.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{filter === "All" ? "No requests yet." : `No ${filter.toLowerCase()} requests.`}</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Requested From</TableHead>
                  <TableHead>To Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-xs font-bold">#{r.id}</TableCell>
                    <TableCell className="font-semibold">{r.requisition_number}</TableCell>
                    <TableCell className="text-muted-foreground">{(r as any).from_location_name ?? ((r as any).from_location_id ?? "—")}</TableCell>
                    <TableCell className="font-medium">{r.to_location_name ?? r.to_location_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badgeClass(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[180px]">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{Number(r._ful).toFixed(3)} / {Number(r._req).toFixed(3)}</span>
                          <span>{r._pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${r._pct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/inventory/stock-requests/${r.id}`}>{String(r.status) === "Requested" ? "View & approve" : "View"}</Link>
                        </Button>
                        {["Requested", "Approved"].includes(String(r.status)) && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/inventory/transfers/new?req=${r.id}`} className="gap-2">
                              <ArrowLeftRight className="w-4 h-4" />
                              Create Transfer
                            </Link>
                          </Button>
                        )}
                        {String(r.status) === "Pending Approval" ? (
                          <Button asChild size="sm" variant="outline" className="gap-2 border-violet-500/30 text-violet-700">
                            <Link href="/approvals/inbox"><Hourglass className="w-4 h-4" /> In approval</Link>
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
    </DashboardLayout>
  );
}

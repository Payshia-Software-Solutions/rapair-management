"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchTransfers, receiveTransfer, type StockTransferRow } from "@/lib/api";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import Link from "next/link";

export default function StockTransfersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivingId, setReceivingId] = useState<number | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTransfers();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRows([]);
      toast({ title: "Error", description: e?.message || "Failed to load transfers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    try {
      const ls = window.localStorage.getItem("location_id");
      const v = ls ? Number(ls) : null;
      setCurrentLocationId(Number.isFinite(v as any) ? (v as number) : null);
    } catch {
      setCurrentLocationId(null);
    }
  }, []);

  const receive = async (id: number) => {
    setReceivingId(id);
    try {
      await receiveTransfer(String(id));
      toast({ title: "Received", description: "Transfer received and stock movements created." });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to receive transfer", variant: "destructive" });
    } finally {
      setReceivingId(null);
    }
  };

  const badgeClass = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v === "received") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (v === "cancelled") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Transfers</h1>
          <p className="text-muted-foreground mt-1">Create and receive stock transfer requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
          <Button asChild className="gap-2">
            <Link href="/inventory/transfers/new">
              <Plus className="w-4 h-4" />
              New Transfer
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Requests</CardTitle>
          <CardDescription>Transfers between fleet hubs and warehouses</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading transfers...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No transfers yet.</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-xs font-bold">#{r.id}</TableCell>
                    <TableCell className="font-semibold">{r.transfer_number}</TableCell>
                    <TableCell>{r.from_location_name ?? r.from_location_id}</TableCell>
                    <TableCell>{r.to_location_name ?? r.to_location_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badgeClass(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{r.line_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/inventory/transfers/${r.id}`}>View</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/inventory/transfers/print/${r.id}?autoprint=1`}>Print</Link>
                        </Button>
                        {r.status === "Requested" && currentLocationId !== null && Number(r.to_location_id) === Number(currentLocationId) ? (
                          <Button
                            size="sm"
                            onClick={() => void receive(r.id)}
                            disabled={receivingId === r.id}
                          >
                            {receivingId === r.id ? "Receiving..." : "Receive"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

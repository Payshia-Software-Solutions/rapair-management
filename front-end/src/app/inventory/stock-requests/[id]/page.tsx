"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { approveRequisition, fetchRequisition } from "@/lib/api";
import { ArrowLeft, ArrowLeftRight, CheckCircle2, Loader2 } from "lucide-react";

function qtyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function badgeClass(s: string) {
  const v = String(s || "").toLowerCase();
  if (v === "fulfilled") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (v === "approved") return "bg-sky-500/10 text-sky-700 border-sky-500/20";
  if (v === "requested") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-muted text-foreground";
}

export default function StockRequestDetailsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [hdr, setHdr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [approving, setApproving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchRequisition(String(id));
      setHdr((data as any)?.requisition ?? null);
      setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
    } catch (e: any) {
      setHdr(null);
      setItems([]);
      toast({ title: "Error", description: e?.message || "Failed to load request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const totals = useMemo(() => {
    let req = 0;
    let ful = 0;
    for (const it of items) {
      req += Number(it.qty_requested ?? 0) || 0;
      ful += Number(it.qty_fulfilled ?? 0) || 0;
    }
    const pct = req > 0 ? Math.max(0, Math.min(100, Math.round((ful / req) * 100))) : 0;
    return { req, ful, pct };
  }, [items]);

  const approve = async () => {
    if (!id) return;
    setApproving(true);
    try {
      await approveRequisition(String(id));
      toast({ title: "Approved", description: "Stock request approved." });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to approve", variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Request</h1>
          <p className="text-muted-foreground mt-1">Request details and progress</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/inventory/stock-requests")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          {id ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/inventory/transfers/new?req=${encodeURIComponent(String(id))}`}>
                <ArrowLeftRight className="w-4 h-4" />
                Create Transfer
              </Link>
            </Button>
          ) : null}
          {hdr && String(hdr.status) === "Requested" ? (
            <Button onClick={() => void approve()} disabled={approving} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {approving ? "Approving..." : "Approve"}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading request...
        </div>
      ) : !hdr ? (
        <div className="py-24 text-center text-muted-foreground">Request not found.</div>
      ) : (
        <>
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{hdr.requisition_number}</CardTitle>
                  <CardDescription>
                    To location: <span className="font-medium text-foreground">{hdr.to_location_name ?? hdr.to_location_id}</span>
                  </CardDescription>
                  <CardDescription>
                    Requested from:{" "}
                    <span className="font-medium text-foreground">
                      {hdr.from_location_name ?? (hdr.from_location_id ?? "—")}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={badgeClass(hdr.status)}>{hdr.status}</Badge>
                  <div className="text-right text-xs text-muted-foreground">
                    {hdr.requested_at ? <div>Requested: <span className="text-foreground">{hdr.requested_at}</span></div> : null}
                    {hdr.approved_at ? <div>Approved: <span className="text-foreground">{hdr.approved_at}</span></div> : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {hdr.notes ? (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="whitespace-pre-wrap">{hdr.notes}</div>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{qtyFmt(totals.ful)} / {qtyFmt(totals.req)}</span>
                  <span>{totals.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${totals.pct}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden mt-6">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">Lines</CardTitle>
              <CardDescription>Requested vs fulfilled quantities</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Fulfilled</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const req = Number(it.qty_requested ?? 0);
                    const ful = Number(it.qty_fulfilled ?? 0);
                    const rem = Math.max(0, req - ful);
                    return (
                      <TableRow key={it.id ?? idx} className="hover:bg-muted/10">
                        <TableCell className="font-medium">{it.part_name ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.sku ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.brand_name ?? "-"}</TableCell>
                        <TableCell className="text-right">{qtyFmt(req)}</TableCell>
                        <TableCell className="text-right">{qtyFmt(ful)}</TableCell>
                        <TableCell className="text-right font-semibold">{qtyFmt(rem)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fetchTransfer } from "@/lib/api";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

function qtyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function badgeClass(s: string) {
  const v = String(s || "").toLowerCase();
  if (v === "received") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (v === "cancelled") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
}

export default function StockTransferViewPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [hdr, setHdr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      setLoading(true);
      try {
        const data = await fetchTransfer(String(id));
        setHdr((data as any)?.transfer ?? null);
        setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
      } catch (e: any) {
        setHdr(null);
        setItems([]);
        toast({ title: "Error", description: e?.message || "Failed to load transfer", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const it of items) {
      const q = Number(it.qty ?? 0);
      const unit = Number(it.unit_cost ?? it.cost_price ?? 0);
      if (Number.isFinite(q)) qty += q;
      if (Number.isFinite(q) && Number.isFinite(unit)) value += q * unit;
    }
    return { qty, value: Math.round(value * 100) / 100 };
  }, [items]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => router.push("/inventory/transfers")}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Transfer</h1>
            <p className="text-muted-foreground mt-1">View only (not editable)</p>
          </div>
        </div>
        {id ? (
          <Button asChild className="gap-2">
            <Link href={`/inventory/transfers/print/${encodeURIComponent(String(id))}?autoprint=1`} target="_blank">
              <Printer className="w-4 h-4" />
              Print
            </Link>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading transfer...
        </div>
      ) : !hdr ? (
        <div className="py-24 text-center text-muted-foreground">Transfer not found.</div>
      ) : (
        <>
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{hdr.transfer_number}</CardTitle>
                  <CardDescription>
                    From <span className="font-medium text-foreground">{hdr.from_location_name ?? hdr.from_location_id}</span> to{" "}
                    <span className="font-medium text-foreground">{hdr.to_location_name ?? hdr.to_location_id}</span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={badgeClass(hdr.status)}>{hdr.status}</Badge>
                  <div className="text-right text-xs text-muted-foreground">
                    {hdr.requested_at ? <div>Requested: <span className="text-foreground">{hdr.requested_at}</span></div> : null}
                    {hdr.received_at ? <div>Received: <span className="text-foreground">{hdr.received_at}</span></div> : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {hdr.notes ? (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="whitespace-pre-wrap">{hdr.notes}</div>
                </div>
              ) : null}
              <div className="text-sm text-muted-foreground">
                Total Qty: <span className="font-semibold text-foreground">{qtyFmt(totals.qty)}</span> | Value (info):{" "}
                <span className="font-semibold text-foreground">{money(totals.value)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden mt-6">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">Items</CardTitle>
              <CardDescription>Transferred quantities</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const qty = Number(it.qty ?? 0);
                    const unit = Number(it.unit_cost ?? it.cost_price ?? 0);
                    const amount = Number.isFinite(qty) && Number.isFinite(unit) ? Math.round(qty * unit * 100) / 100 : 0;
                    return (
                      <TableRow key={it.id ?? idx} className="hover:bg-muted/10">
                        <TableCell className="font-medium">{it.part_name ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.sku ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.brand_name ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.unit ?? "-"}</TableCell>
                        <TableCell className="text-right">{money(unit)}</TableCell>
                        <TableCell className="text-right font-semibold">{qtyFmt(qty)}</TableCell>
                        <TableCell className="text-right font-semibold">{money(amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">Totals</TableCell>
                    <TableCell className="text-right font-semibold">{qtyFmt(totals.qty)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(totals.value)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}

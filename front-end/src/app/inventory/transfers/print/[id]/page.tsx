"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchCompany, fetchTransfer, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

function qtyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockTransferPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [transfer, setTransfer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const printedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [comp, data] = await Promise.all([fetchCompany(), fetchTransfer(String(id))]);
        setCompany((comp as any) ?? null);
        setTransfer((data as any)?.transfer ?? null);
        setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const totalQty = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const q = Number(it.qty ?? 0);
      if (!Number.isFinite(q)) continue;
      sum += q;
    }
    return sum;
  }, [items]);

  const totalValue = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const q = Number(it.qty ?? 0);
      const unit = Number(it.unit_cost ?? it.cost_price ?? 0);
      if (!Number.isFinite(q) || !Number.isFinite(unit)) continue;
      sum += q * unit;
    }
    return Math.round(sum * 100) / 100;
  }, [items]);

  useEffect(() => {
    if (!auto) return;
    if (loading) return;
    if (!transfer) return;
    if (printedRef.current) return;
    printedRef.current = true;
    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [auto, loading, transfer]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          html,
          body {
            background: #fff !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="print:hidden sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Print Stock Transfer</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/inventory/transfers")}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-muted/20 min-h-screen py-8 print:bg-white print:py-0">
        <div className="mx-auto max-w-4xl px-4">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading transfer...
            </div>
          ) : !transfer ? (
            <div className="py-24 text-center text-muted-foreground">Transfer not found.</div>
          ) : (
            <div className="bg-white border shadow-sm rounded-md p-6 print:border-0 print:shadow-none print:rounded-none">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-2xl font-bold leading-tight">{company?.name ?? "ServiceBay"}</div>
                  <div className="text-sm text-muted-foreground mt-1 space-y-1">
                    {company?.address ? <div className="leading-tight">{company.address}</div> : null}
                    {company?.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{company.phone}</span>
                      </div>
                    ) : null}
                    {company?.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{company.email}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="text-right min-w-[240px]">
                  <div className="text-sm font-bold">Stock Transfer</div>
                  <div className="text-sm text-muted-foreground">Transfer No: <span className="font-semibold text-foreground">{transfer.transfer_number}</span></div>
                  <div className="text-sm text-muted-foreground">Status: <span className="font-semibold text-foreground">{transfer.status}</span></div>
                  {transfer.requested_at ? <div className="text-sm text-muted-foreground">Requested: <span className="text-foreground">{transfer.requested_at}</span></div> : null}
                  {transfer.received_at ? <div className="text-sm text-muted-foreground">Received: <span className="text-foreground">{transfer.received_at}</span></div> : null}
                </div>
              </div>

              <div className="my-6 border-t" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    From
                  </div>
                  <div className="font-semibold mt-1">{transfer.from_location_name ?? transfer.from_location_id}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    To
                  </div>
                  <div className="font-semibold mt-1">{transfer.to_location_name ?? transfer.to_location_id}</div>
                </div>
              </div>

              {transfer.notes ? (
                <div className="mt-4 text-sm">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="whitespace-pre-wrap">{transfer.notes}</div>
                </div>
              ) : null}

              <div className="my-6 border-t" />

              <table className="w-full text-sm border">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2 border">Item</th>
                    <th className="text-left p-2 border">SKU</th>
                    <th className="text-left p-2 border">Brand</th>
                    <th className="text-left p-2 border">Unit</th>
                    <th className="text-right p-2 border">Unit Cost</th>
                    <th className="text-right p-2 border">Qty</th>
                    <th className="text-right p-2 border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const qty = Number(it.qty ?? 0);
                    const unitCost = Number(it.unit_cost ?? it.cost_price ?? 0);
                    const amount = Number.isFinite(qty) && Number.isFinite(unitCost) ? Math.round(qty * unitCost * 100) / 100 : 0;
                    return (
                      <tr key={it.id ?? idx}>
                        <td className="p-2 border">{it.part_name ?? "-"}</td>
                        <td className="p-2 border">{it.sku ?? "-"}</td>
                        <td className="p-2 border">{it.brand_name ?? "-"}</td>
                        <td className="p-2 border">{it.unit ?? "-"}</td>
                        <td className="p-2 border text-right">{money(unitCost)}</td>
                        <td className="p-2 border text-right">{qtyFmt(qty)}</td>
                        <td className="p-2 border text-right font-semibold">{money(amount)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="p-2 border text-right font-semibold" colSpan={5}>Total Qty</td>
                    <td className="p-2 border text-right font-semibold">{qtyFmt(totalQty)}</td>
                    <td className="p-2 border" />
                  </tr>
                  <tr>
                    <td className="p-2 border text-right font-semibold" colSpan={6}>Total Value</td>
                    <td className="p-2 border text-right font-semibold">{money(totalValue)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="border-t pt-2">Requested By</div>
                </div>
                <div>
                  <div className="border-t pt-2">Checked By</div>
                </div>
                <div>
                  <div className="border-t pt-2">Authorized By</div>
                </div>
              </div>

              <div className="mt-6 text-xs text-muted-foreground">
                Printed: {new Date().toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchStockAdjustmentBatchForLocation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function StockAdjustmentPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";
  const loc = searchParams?.get("loc");
  const locId = loc ? Number(loc) : null;

  const [loading, setLoading] = useState(true);
  const [hdr, setHdr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const printedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data: any = await fetchStockAdjustmentBatchForLocation(String(id), locId && locId > 0 ? locId : undefined);
        setHdr(data?.adjustment ?? null);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id, locId]);

  const totalVariance = useMemo(() => {
    return items.reduce((sum, it) => sum + Number(it.qty_change ?? 0), 0);
  }, [items]);

  useEffect(() => {
    if (!auto) return;
    if (loading) return;
    if (!hdr) return;
    if (printedRef.current) return;
    printedRef.current = true;

    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [auto, loading, hdr]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
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
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Print Stock Adjustment</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/inventory/stock/adjustments/${encodeURIComponent(String(id))}`)}>
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
        <div className="mx-auto max-w-3xl px-4">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading adjustment...
            </div>
          ) : !hdr ? (
            <div className="py-24 text-center text-muted-foreground">Adjustment not found.</div>
          ) : (
            <div className="mx-auto w-[72mm] max-w-full bg-white border shadow-sm rounded-md p-4 print:border-0 print:shadow-none print:rounded-none">
              <div className="text-center">
                <div className="font-bold text-base leading-tight">ServiceBay</div>
                <div className="text-[11px] text-muted-foreground">Stock Adjustment</div>
              </div>

              <div className="my-3 border-t border-dashed" />

              <div className="text-[12px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adjustment</span>
                  <span className="font-semibold">{hdr.adjustment_number ?? `#${id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{hdr.location_name ?? (hdr.location_id ? `#${hdr.location_id}` : "-")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adjusted</span>
                  <span>{hdr.adjusted_at ?? "-"}</span>
                </div>
                {hdr.created_by_name ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">By</span>
                    <span>{hdr.created_by_name}</span>
                  </div>
                ) : null}
              </div>

              <div className="my-3 border-t border-dashed" />

              {hdr.reason ? (
                <div className="text-[12px]">
                  <div className="text-muted-foreground text-[11px]">Reason</div>
                  <div className="leading-tight">{String(hdr.reason)}</div>
                </div>
              ) : null}
              {hdr.notes ? (
                <div className="text-[12px] mt-2">
                  <div className="text-muted-foreground text-[11px]">Notes</div>
                  <div className="whitespace-pre-wrap leading-tight">{String(hdr.notes)}</div>
                </div>
              ) : null}

              <div className="my-3 border-t border-dashed" />

              <div className="text-[12px]">
                <div className="text-muted-foreground text-[11px] mb-1">Lines</div>
                <div className="space-y-2">
                  {items.map((it) => {
                    const system = Number(it.system_stock ?? 0);
                    const physical = Number(it.physical_stock ?? system);
                    const variance = Number(it.qty_change ?? 0);
                    return (
                      <div key={it.id} className="border-b border-dashed pb-2">
                        <div className="font-semibold leading-tight">{it.part_name ?? `Item #${it.part_id}`}</div>
                        {it.sku ? <div className="text-[11px] text-muted-foreground leading-tight">SKU: {it.sku}</div> : null}
                        <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <div className="text-muted-foreground">System</div>
                            <div className="font-semibold">{fmt3(system)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Physical</div>
                            <div className="font-semibold">{fmt3(physical)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-muted-foreground">Variance</div>
                            <div className="font-bold">{variance > 0 ? "+" : ""}{fmt3(variance)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="my-3 border-t border-dashed" />

              <div className="text-[12px] flex justify-between">
                <span className="text-muted-foreground">Total Variance</span>
                <span className="font-bold">{totalVariance > 0 ? "+" : ""}{fmt3(totalVariance)}</span>
              </div>

              <div className="mt-3 text-center text-[10px] text-muted-foreground">
                Printed: {new Date().toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


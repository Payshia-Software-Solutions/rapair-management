"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchCompany, fetchProductionOrder, fetchLocations, type CompanyRow, type ServiceLocationRow } from "@/lib/api";
import { Button } from "@/components/ui/button";

import { Loader2, Printer, ArrowLeft, Mail, MapPin, Phone, Factory, Package, Boxes, Clock } from "lucide-react";
import { format } from "date-fns";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductionPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [location, setLocation] = useState<ServiceLocationRow | null>(null);
  const printedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [data, comp, locs] = await Promise.all([
          fetchProductionOrder(String(id)),
          fetchCompany(),
          fetchLocations()
        ]);
        
        setOrder(data);
        setCompany((comp as any) ?? null);

        const locRows = Array.isArray(locs) ? (locs as ServiceLocationRow[]) : [];
        const locId = data?.location_id ? Number(data.location_id) : null;
        const match = locId && locId > 0 ? locRows.find((x) => Number(x.id) === Number(locId)) ?? null : null;
        setLocation(match);
      } catch (err) {
        console.error("Print fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  useEffect(() => {
    if (!auto) return;
    if (loading) return;
    if (!order) return;
    if (printedRef.current) return;
    printedRef.current = true;

    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [auto, loading, order]);

  const { totalMaterialCost, allocatedOutputs } = useMemo(() => {
    if (!order) return { totalMaterialCost: 0, allocatedOutputs: [] };
    
    // 1. Calculate Actual Total Batch Material Cost
    const totalMat = (order.items || []).reduce((acc: number, cur: any) => 
      acc + (Number(cur.actual_qty ?? cur.planned_qty) * Number(cur.unit_cost)), 0
    );

    // 2. Calculate Weights based on Standard Costs
    const outputs = order.outputs || [];
    let totalStandardValue = outputs.reduce((acc: number, cur: any) => 
      acc + (Number(cur.planned_qty) * Number(cur.standard_unit_cost || 0)), 0
    );

    // Filter to handle fallback if no BOM costs exist
    const hasAnyStandardCost = totalStandardValue > 0;
    
    // 3. Allocate actual cost to each item
    const allocated = outputs.map((out: any) => {
      let weight = 0;
      if (hasAnyStandardCost) {
        weight = (Number(out.planned_qty) * Number(out.standard_unit_cost || 0)) / totalStandardValue;
      } else {
        // Fallback to simple quantity-based allocation
        const totalQty = outputs.reduce((acc: number, cur: any) => acc + Number(cur.planned_qty), 0);
        weight = totalQty > 0 ? Number(out.planned_qty) / totalQty : 0;
      }

      const totalAllocated = totalMat * weight;
      const actualQty = Number(out.actual_qty || 0);
      const unitAllocated = (actualQty > 0) ? totalAllocated / actualQty : 0;

      return {
        ...out,
        allocated_total_cost: totalAllocated,
        allocated_unit_cost: unitAllocated
      };
    });

    return { totalMaterialCost: totalMat, allocatedOutputs: allocated };
  }, [order]);

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
            color: #000 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="print:hidden sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Production Summary Report</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/production/orders/${id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Order
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-muted/10 min-h-screen py-8 print:bg-white print:py-0">
        <div className="mx-auto max-w-4xl px-4">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading production details...
            </div>
          ) : !order ? (
            <div className="py-24 text-center text-muted-foreground">Production Order not found.</div>
          ) : (
            <div className="bg-white border shadow-sm rounded-md p-8 print:border-0 print:shadow-none print:rounded-none">
              
              {/* Header Section */}
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="text-2xl font-black tracking-tight">{company?.name ?? "ServiceBay Manufacturing"}</div>
                  <div className="text-sm text-muted-foreground mt-2 space-y-1">
                    {company?.address ? <div className="leading-tight">{company.address}</div> : null}
                    {company?.phone && (
                      <div className="flex items-center gap-2 leading-tight">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 leading-tight">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-bold text-foreground">{location?.name || order.location_name}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                    <Factory className="w-3 h-3" /> Production Document
                  </div>
                  <div className="text-3xl font-black leading-tight">{order.order_number}</div>
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-bold uppercase">{order.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Printed: {format(new Date(), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>

              <div className="my-4 border-t" />

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2 border rounded-lg bg-slate-50/50">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5 tracking-tight">Batch Start</div>
                  <div className="text-xs font-bold">{order.started_at ? format(new Date(order.started_at), 'MMM d, HH:mm') : '—'}</div>
                </div>
                <div className="p-2 border rounded-lg bg-slate-50/50">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5 tracking-tight">Batch End</div>
                  <div className="text-xs font-bold">{order.completed_at ? format(new Date(order.completed_at), 'MMM d, HH:mm') : 'In Progress'}</div>
                </div>
                <div className="p-2 border rounded-lg bg-slate-50/50">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5 tracking-tight">Total Target</div>
                  <div className="text-xs font-bold">{Number(order.qty).toLocaleString()} Units</div>
                </div>
                <div className="p-2 border rounded-lg bg-slate-50/50">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5 tracking-tight">Total Yield</div>
                  <div className="text-xs font-bold">{order.actual_yield ? Number(order.actual_yield).toLocaleString() : '—'}</div>
                </div>
              </div>

              {/* Output Products Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Finished Goods Output
                </h3>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-left text-[9px] uppercase font-bold text-muted-foreground">
                        <th className="px-3 py-1.5">Product Description</th>
                        <th className="px-3 py-1.5 text-right">Yield</th>
                        <th className="px-3 py-1.5 text-right">Unit Cost</th>
                        <th className="px-3 py-1.5 text-right">Total Cost</th>
                        <th className="px-3 py-1.5">Waste/Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b">
                      {(allocatedOutputs || []).map((out: any) => (
                        <tr key={out.id}>
                          <td className="px-3 py-1.5 leading-tight">
                            <div className="font-bold">{out.part_name}</div>
                            <div className="text-[9px] font-mono text-muted-foreground uppercase">SKU: {out.sku || 'N/A'}</div>
                          </td>
                          <td className="px-3 py-1.5 text-right leading-tight">
                            <div className="font-black">
                               {out.actual_qty ? Number(out.actual_qty).toLocaleString() : '—'} <span className="text-[9px] text-muted-foreground font-normal">{out.unit}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground italic leading-none">Target: {Number(out.planned_qty).toLocaleString()}</div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                            {order.status === 'Completed' ? money(out.allocated_unit_cost) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-black tabular-nums">
                            {money(out.allocated_total_cost)}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground italic text-[10px] leading-tight max-w-[150px] truncate">
                            {out.waste_reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Material Consumption Table */}
              <div className="space-y-2 mt-4">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Boxes className="w-3.5 h-3.5" /> Material Consumption
                </h3>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-left text-[9px] uppercase font-bold text-muted-foreground">
                        <th className="px-3 py-1.5">Material Component</th>
                        <th className="px-3 py-1.5 text-right">Target</th>
                        <th className="px-3 py-1.5 text-right">Consumed</th>
                        <th className="px-3 py-1.5 text-right">Unit Cost</th>
                        <th className="px-3 py-1.5 text-right">Ext. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(order.items || []).map((item: any) => {
                        const consumed = Number(item.actual_qty ?? item.planned_qty);
                        const cost = Number(item.unit_cost);
                        const ext = consumed * cost;
                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-1.5 leading-tight">
                              <div className="font-bold">{item.part_name}</div>
                              <div className="text-[9px] font-mono text-muted-foreground uppercase">SKU: {item.sku || 'N/A'}</div>
                            </td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">
                              {Number(item.planned_qty).toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold">
                              {consumed.toLocaleString()} <span className="text-[9px] text-muted-foreground">{item.unit}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {money(cost)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                              {money(ext)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t font-bold">
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right uppercase text-[9px] tracking-wider">Total Batch Material Cost</td>
                        <td className="px-3 py-1.5 text-right text-sm tabular-nums">
                          {money(totalMaterialCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarks Section */}
              {order.waste_reason && (
                <div className="mt-3 p-3 border rounded bg-slate-50 text-[10px]">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Batch Notes / Global Remarks</div>
                  <div className="whitespace-pre-wrap leading-tight">{order.waste_reason}</div>
                </div>
              )}

              {/* Sign-off Area */}
              <div className="mt-8 grid grid-cols-3 gap-10">
                <div className="space-y-6">
                  <div className="border-b border-slate-300" />
                  <div className="text-center">
                    <div className="text-[9px] font-black uppercase tracking-tighter">Prepared By</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{order.created_by_name || 'Production Lead'}</div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="border-b border-slate-300" />
                  <div className="text-center">
                    <div className="text-[9px] font-black uppercase tracking-tighter">Verified By</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Quality Assurance</div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="border-b border-slate-300" />
                  <div className="text-center">
                    <div className="text-[9px] font-black uppercase tracking-tighter">Authorized signature</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Site Manager / Director</div>
                  </div>
                </div>
              </div>

              {/* Verification Stamp Placeholder */}
              <div className="mt-6 flex justify-end">
                <div className="w-20 h-20 border-2 border-slate-100 rounded-full flex items-center justify-center -rotate-12 opacity-30">
                  <div className="text-[8px] font-black uppercase text-center leading-none">
                    Batch<br/>Verified<br/>Quality ok
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[9px] text-muted-foreground border-t pt-2">
                This document is a formal record of manufacturing activities and inventory movements related to the specified batch.
                PayShia Production Module v2.0 - Total Batch Value: {money(totalMaterialCost)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

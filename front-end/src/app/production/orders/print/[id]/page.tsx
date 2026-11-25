"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchCompany, fetchProductionOrder, fetchLocations, type CompanyRow, type ServiceLocationRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintSection, PrintTable, PrintTotals } from "@/components/print/PrintDocument";

import { format } from "date-fns";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductionPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [location, setLocation] = useState<ServiceLocationRow | null>(null);

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
    <PrintDocument
      title="Production Order"
      number={order?.order_number}
      loading={loading}
      error={!loading && !order ? "Production order not found." : null}
      ready={!!order}
      autoPrint={auto}
      company={company}
      meta={order ? [
        ["Location", location?.name || order.location_name || "-"],
        ["Status", order.status],
        ["Started", order.started_at ? format(new Date(order.started_at), "d MMM yyyy, HH:mm") : "–"],
        ["Completed", order.completed_at ? format(new Date(order.completed_at), "d MMM yyyy, HH:mm") : "In progress"],
        ["Planned quantity", `${Number(order.qty).toLocaleString()} units`],
        ["Actual yield", order.actual_yield ? Number(order.actual_yield).toLocaleString() : "–"],
      ] : []}
      signatures={["Prepared by", "Verified by (QA)", "Authorized by"]}
    >
      <PrintSection title="Finished goods">
        <PrintTable
          columns={[
            { key: "item", label: "Product" },
            { key: "yield", label: "Yield", align: "right", width: "28mm" },
            { key: "unit", label: "Unit cost", align: "right", width: "26mm" },
            { key: "total", label: "Total cost", align: "right", width: "28mm" },
            { key: "waste", label: "Waste / remarks", width: "36mm" },
          ]}
          rows={allocatedOutputs.map((out: any) => ({
            item: <><div className="font-medium">{out.part_name}</div><div className="text-[10px] text-slate-500">SKU {out.sku || "–"}</div></>,
            yield: <>{out.actual_qty ? Number(out.actual_qty).toLocaleString() : "–"} {out.unit}<div className="text-[10px] text-slate-500">Target {Number(out.planned_qty).toLocaleString()}</div></>,
            unit: order?.status === "Completed" ? money(out.allocated_unit_cost) : "–",
            total: money(out.allocated_total_cost),
            waste: out.waste_reason || "–",
          }))}
        />
      </PrintSection>
      <PrintSection title="Materials used">
        <PrintTable
          columns={[
            { key: "item", label: "Material" },
            { key: "target", label: "Target", align: "right", width: "22mm" },
            { key: "used", label: "Consumed", align: "right", width: "26mm" },
            { key: "cost", label: "Unit cost", align: "right", width: "24mm" },
            { key: "ext", label: "Cost", align: "right", width: "28mm" },
          ]}
          rows={(order?.items || []).map((item: any) => {
            const consumed = Number(item.actual_qty ?? item.planned_qty), cost = Number(item.unit_cost);
            return {
              item: <><div className="font-medium">{item.part_name}</div><div className="text-[10px] text-slate-500">SKU {item.sku || "–"}</div></>,
              target: Number(item.planned_qty).toLocaleString(),
              used: `${consumed.toLocaleString()} ${item.unit || ""}`,
              cost: money(cost),
              ext: money(consumed * cost),
            };
          })}
        />
        <PrintTotals lines={[{ label: "Total material cost", value: money(totalMaterialCost), grand: true }]} />
      </PrintSection>
      {order?.waste_reason ? <PrintNotes label="Batch notes">{order.waste_reason}</PrintNotes> : null}
    </PrintDocument>
  );
}

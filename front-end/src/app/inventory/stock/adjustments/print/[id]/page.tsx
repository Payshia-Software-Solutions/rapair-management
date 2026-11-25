"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchStockAdjustmentBatch } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function StockAdjustmentPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";
  const loc = searchParams?.get("loc");
  const locId = loc ? Number(loc) : null;

  const [loading, setLoading] = useState(true);
  const [hdr, setHdr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data: any = await fetchStockAdjustmentBatch(String(id));
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

  const totalValue = items.reduce((s, it) => s + Number(it.qty_change ?? 0) * Number(it.unit_cost ?? 0), 0);

  return (
    <PrintDocument
      title="Stock Adjustment"
      number={hdr ? (hdr.adjustment_number ?? `#${id}`) : undefined}
      loading={loading}
      error={!loading && !hdr ? "Adjustment not found." : null}
      ready={!!hdr}
      autoPrint={auto}
      meta={hdr ? [
        ["Date", hdr.adjusted_at ? new Date(String(hdr.adjusted_at).replace(" ", "T")).toLocaleDateString("en-GB") : "-"],
        ["Location", hdr.location_name ?? `#${hdr.location_id}`],
        ["Reason", hdr.reason ?? "General correction"],
        ["Entered by", hdr.created_by_name ?? "-"],
      ] : []}
      signatures={["Counted by", "Checked by", "Approved by"]}
    >
      <PrintTable
        columns={[
          { key: "n", label: "#", width: "8mm" },
          { key: "item", label: "Item" },
          { key: "batch", label: "Batch", width: "24mm" },
          { key: "sys", label: "System", align: "right", width: "18mm" },
          { key: "phys", label: "Counted", align: "right", width: "18mm" },
          { key: "var", label: "Variance", align: "right", width: "18mm" },
          { key: "cost", label: "Unit cost", align: "right", width: "22mm" },
          { key: "val", label: "Value", align: "right", width: "24mm" },
        ]}
        rows={items.map((it, idx) => {
          const system = Number(it.system_stock ?? 0), physical = Number(it.physical_stock ?? system);
          const variance = Number(it.qty_change ?? 0), cost = Number(it.unit_cost ?? 0);
          return {
            n: idx + 1,
            item: <><div className="font-medium">{it.part_name}</div><div className="text-[10px] text-slate-500">{it.sku ? `SKU ${it.sku}` : `ID ${it.part_id}`}{it.unit ? ` · ${it.unit}` : ""}</div></>,
            batch: it.batch_number ?? "–",
            sys: fmt3(system),
            phys: fmt3(physical),
            var: <span className={variance < 0 ? "text-red-700" : ""}>{variance > 0 ? "+" : ""}{fmt3(variance)}</span>,
            cost: fmtMoney(cost),
            val: fmtMoney(variance * cost, false),
          };
        })}
      />
      <PrintTotals lines={[
        { label: "Net quantity change", value: fmt3(totalVariance) },
        { label: "Net value change", value: fmtMoney(totalValue, false), grand: true },
      ]} />
      {hdr?.notes ? <PrintNotes>{String(hdr.notes)}</PrintNotes> : null}
    </PrintDocument>
  );
}

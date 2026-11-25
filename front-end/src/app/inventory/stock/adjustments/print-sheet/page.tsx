"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchLocations, fetchLocationStockBalances } from "@/lib/api";
import { PrintDocument, PrintTable } from "@/components/print/PrintDocument";

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function InventoryCountSheetPage() {
  const searchParams = useSearchParams();
  
  const loc = searchParams?.get("loc");
  const locId = loc ? Number(loc) : null;
  const isBlind = searchParams?.get("blind") === "1";
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const selectedLocation = useMemo(() => {
    if (!locId) return null;
    return locations.find(l => Number(l.id) === locId) || { id: locId, name: `Location #${locId}` };
  }, [locId, locations]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [locsData, itemsData] = await Promise.all([
          fetchLocations().catch(() => []),
          locId ? fetchLocationStockBalances(locId).catch(() => []) : Promise.resolve([])
        ]);
        setLocations(Array.isArray(locsData) ? locsData : []);
        setItems(Array.isArray(itemsData) ? itemsData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [locId]);

  return (
    <PrintDocument
      title={isBlind ? "Blind Count Sheet" : "Stock Count Sheet"}
      loading={loading}
      error={!loading && !locId ? "Choose a location first." : null}
      ready={items.length > 0}
      autoPrint={auto}
      meta={[
        ["Location", selectedLocation?.name ?? "-"],
        ["Count date", "____________________"],
        ["Items", String(items.length)],
        ["Type", isBlind ? "Blind (system quantities hidden)" : "With system quantities"],
      ]}
      signatures={["Counted by", "Checked by", "Approved by"]}
    >
      <PrintTable
        columns={[
          { key: "n", label: "#", width: "8mm" },
          { key: "item", label: "Item" },
          ...(isBlind ? [] : [{ key: "sys", label: "System qty", align: "right" as const, width: "22mm" }]),
          { key: "count", label: "Counted qty", align: "center", width: "32mm" },
          { key: "remarks", label: "Remarks", width: "45mm" },
        ]}
        rows={items.map((it, idx) => ({
          n: idx + 1,
          item: <><div className="font-medium">{it.part_name}</div><div className="text-[10px] text-slate-500">{it.sku ? `SKU ${it.sku}` : `ID ${it.id}`}{it.unit ? ` · ${it.unit}` : ""}</div></>,
          sys: fmt3(Number(it.stock_quantity ?? 0)),
          count: <div className="h-6 border-b border-slate-400" />,
          remarks: <div className="h-6 border-b border-slate-300" />,
        }))}
        empty="No stock at this location."
      />
    </PrintDocument>
  );
}

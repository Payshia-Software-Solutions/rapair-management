"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchCompany, fetchTransfer, type CompanyRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals } from "@/components/print/PrintDocument";

function qtyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockTransferPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [transfer, setTransfer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

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

  return (
    <PrintDocument
      title="Stock Transfer"
      number={transfer?.transfer_number}
      loading={loading}
      error={!loading && !transfer ? "Transfer not found." : null}
      ready={!!transfer}
      autoPrint={auto}
      company={company}
      meta={transfer ? [
        ["From", transfer.from_location_name ?? transfer.from_location_id],
        ["To", transfer.to_location_name ?? transfer.to_location_id],
        ["Status", transfer.status],
        ["Requested", transfer.requested_at ?? "-"],
        ...(transfer.received_at ? [["Received", transfer.received_at] as [string, string]] : []),
      ] : []}
      signatures={["Requested by", "Issued by", "Received by"]}
    >
      <PrintTable
        columns={[
          { key: "item", label: "Item" },
          { key: "unit", label: "Unit", width: "16mm" },
          { key: "cost", label: "Unit cost", align: "right", width: "26mm" },
          { key: "qty", label: "Qty", align: "right", width: "22mm" },
          { key: "amt", label: "Amount", align: "right", width: "28mm" },
        ]}
        rows={items.map((it) => {
          const qty = Number(it.qty ?? 0), unit = Number(it.unit_cost ?? it.cost_price ?? 0);
          return {
            item: <><div className="font-medium">{it.part_name ?? "-"}</div>
              {(it.sku || it.brand_name) && <div className="text-[10px] text-slate-500">{[it.sku && `SKU ${it.sku}`, it.brand_name].filter(Boolean).join(" · ")}</div>}</>,
            unit: it.unit ?? "-",
            cost: money(unit),
            qty: qtyFmt(qty),
            amt: money(Math.round(qty * unit * 100) / 100),
          };
        })}
      />
      <PrintTotals lines={[
        { label: "Total quantity", value: qtyFmt(totalQty) },
        { label: "Total value", value: money(totalValue), grand: true },
      ]} />
      {transfer?.notes ? <PrintNotes>{String(transfer.notes)}</PrintNotes> : null}
    </PrintDocument>
  );
}

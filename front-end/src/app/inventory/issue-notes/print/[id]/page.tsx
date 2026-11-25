"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchCompany, type CompanyRow } from "@/lib/api";
import { fetchIssueNote } from "@/lib/api/inventory";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals } from "@/components/print/PrintDocument";

function qtyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IssueNotePrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [hdr, setHdr] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [comp, data] = await Promise.all([fetchCompany(), fetchIssueNote(String(id))]);
        setCompany((comp as any) ?? null);
        setHdr((data as any)?.issue_note ?? null);
        setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
      } catch (e) {
        console.error("Failed to load print data", e);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const it of items) {
      const q = Number(it.qty_issued ?? 0);
      const unit = Number(it.unit_cost ?? 0);
      if (Number.isFinite(qty)) qty += q;
      if (Number.isFinite(q) && Number.isFinite(unit)) value += q * unit;
    }
    return { qty, value: Math.round(value * 100) / 100 };
  }, [items]);

  return (
    <PrintDocument
      title="Material Issue Note"
      number={hdr?.issue_number}
      loading={loading}
      error={!loading && !hdr ? "Issue note not found." : null}
      ready={!!hdr}
      autoPrint={auto}
      company={company}
      meta={hdr ? [
        ["Location", hdr.location_name ?? `ID: ${hdr.location_id}`],
        ["Cost center", hdr.cost_center_name ?? (hdr.cost_center_id ? `ID: ${hdr.cost_center_id}` : "-")],
        ["Status", hdr.status],
        ["Created", hdr.created_at ? new Date(hdr.created_at).toLocaleString("en-GB") : "-"],
        ...(hdr.issued_at ? [["Issued", new Date(hdr.issued_at).toLocaleString("en-GB")] as [string, string]] : []),
      ] : []}
      signatures={["Issued by", "Received by", "Approved by"]}
    >
      <PrintTable
        columns={[
          { key: "item", label: "Item" },
          { key: "batch", label: "Batch", width: "26mm" },
          { key: "unit", label: "Unit", width: "14mm" },
          { key: "cost", label: "Unit cost", align: "right", width: "24mm" },
          { key: "qty", label: "Qty", align: "right", width: "20mm" },
          { key: "amt", label: "Amount", align: "right", width: "26mm" },
        ]}
        rows={items.map((it) => {
          const qty = Number(it.qty_issued ?? 0), unit = Number(it.unit_cost ?? 0);
          return {
            item: <><div className="font-medium">{it.part_name ?? "-"}</div>{it.sku && <div className="text-[10px] text-slate-500">SKU {it.sku}</div>}</>,
            batch: it.batch_number ?? "Auto (FIFO)",
            unit: it.unit ?? "-",
            cost: money(unit),
            qty: qtyFmt(qty),
            amt: money(Number(it.line_total ?? qty * unit)),
          };
        })}
      />
      <PrintTotals lines={[
        { label: "Total quantity", value: qtyFmt(totals.qty) },
        { label: "Total value (cost)", value: money(totals.value), grand: true },
      ]} />
      {hdr?.notes ? <PrintNotes>{String(hdr.notes)}</PrintNotes> : null}
    </PrintDocument>
  );
}

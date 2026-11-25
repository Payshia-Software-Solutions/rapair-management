"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchCompany, fetchGrn, fetchLocations, fetchSupplier, type CompanyRow, type ServiceLocationRow, type TaxRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals } from "@/components/print/PrintDocument";
import { calculateTaxes } from "@/lib/tax-calc";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GrnPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [grn, setGrn] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [location, setLocation] = useState<ServiceLocationRow | null>(null);
  const [supplierTaxes, setSupplierTaxes] = useState<TaxRow[]>([]);
  const [supplierTaxRegNo, setSupplierTaxRegNo] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [data, comp, locs] = await Promise.all([fetchGrn(String(id)), fetchCompany(), fetchLocations()]);
        setGrn((data as any)?.grn ?? (data as any)?.grn_row ?? (data as any)?.grn_header ?? null);
        setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
        setCompany((comp as any) ?? null);

        const grnRow: any = (data as any)?.grn ?? (data as any)?.grn_row ?? (data as any)?.grn_header ?? null;
        const sid = Number(grnRow?.supplier_id ?? 0);
        if (sid > 0) {
          try {
            const sup = await fetchSupplier(String(sid));
            setSupplierTaxes(Array.isArray((sup as any)?.taxes) ? ((sup as any).taxes as TaxRow[]) : []);
            setSupplierTaxRegNo(String((sup as any)?.tax_reg_no ?? ""));
          } catch {
            setSupplierTaxes([]);
            setSupplierTaxRegNo("");
          }
        } else {
          setSupplierTaxes([]);
          setSupplierTaxRegNo("");
        }

        const locRows = Array.isArray(locs) ? (locs as ServiceLocationRow[]) : [];
        const grnLocId = (data as any)?.grn?.location_id ?? (data as any)?.location_id ?? (data as any)?.grn_row?.location_id ?? (data as any)?.grn_header?.location_id ?? null;
        const locId = grnLocId ? Number(grnLocId) : null;
        const match = locId && locId > 0 ? locRows.find((x) => Number(x.id) === Number(locId)) ?? null : null;
        setLocation(match);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const total = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const qty = Number(it.qty_received ?? 0);
      const unit = Number(it.unit_cost ?? 0);
      if (!Number.isFinite(qty) || !Number.isFinite(unit)) continue;
      sum += qty * unit;
    }
    return Math.round(sum * 100) / 100;
  }, [items]);

  const taxCalc = useMemo(() => calculateTaxes(total, supplierTaxes), [total, supplierTaxes]);

  return (
    <PrintDocument
      title="Goods Received Note"
      number={grn ? (grn.grn_number ?? `#${id}`) : undefined}
      loading={loading}
      error={!loading && !grn ? "GRN not found." : null}
      ready={!!grn}
      autoPrint={auto}
      company={company}
      meta={grn ? [
        ["Supplier", grn.supplier_name ?? grn.supplier_id ?? "-"],
        ["Received", grn.received_at ?? "-"],
        ...(supplierTaxRegNo ? [["Supplier tax no", supplierTaxRegNo] as [string, string]] : []),
        ["Purchase order", grn.po_number ?? (grn.purchase_order_id ? `#${grn.purchase_order_id}` : "-")],
        ["Location", location?.name ?? "-"],
        ["Entered by", grn.created_by_name ?? "-"],
      ] : []}
      signatures={["Received by", "Checked by", "Authorized by"]}
    >
      <PrintTable
        columns={[
          { key: "item", label: "Item" },
          { key: "qty", label: "Qty", align: "right", width: "24mm" },
          { key: "unit", label: "Unit cost", align: "right", width: "28mm" },
          { key: "amt", label: "Amount", align: "right", width: "30mm" },
        ]}
        rows={items.map((it) => {
          const qty = Number(it.qty_received ?? 0), unit = Number(it.unit_cost ?? 0);
          return {
            item: <><div className="font-medium">{it.part_name ?? `Item #${it.part_id}`}</div>
              {(it.sku || it.brand_name) && <div className="text-[10px] text-slate-500">{[it.sku && `SKU ${it.sku}`, it.brand_name].filter(Boolean).join(" · ")}</div>}</>,
            qty: qty.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
            unit: money(unit),
            amt: money(Math.round(qty * unit * 100) / 100),
          };
        })}
      />
      <PrintTotals lines={[
        { label: "Sub total", value: money(total), grand: taxCalc.lines.length === 0 },
        ...taxCalc.lines.map((t) => ({ label: `${t.code} (${Number(t.rate_percent).toLocaleString()}%)`, value: money(t.amount) })),
        ...(taxCalc.lines.length > 0 ? [{ label: "Grand total", value: money(taxCalc.grandTotal), grand: true }] : []),
      ]} />
      {grn?.notes ? <PrintNotes>{String(grn.notes)}</PrintNotes> : null}
    </PrintDocument>
  );
}

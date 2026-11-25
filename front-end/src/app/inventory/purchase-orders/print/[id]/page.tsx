"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchCompany, fetchLocations, fetchPurchaseOrder, fetchSupplier, type CompanyRow, type ServiceLocationRow, type TaxRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals } from "@/components/print/PrintDocument";
import { calculateTaxes } from "@/lib/tax-calc";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrderPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [location, setLocation] = useState<ServiceLocationRow | null>(null);
  const [supplierTaxes, setSupplierTaxes] = useState<TaxRow[]>([]);
  const [supplierTaxRegNo, setSupplierTaxRegNo] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const locIdRaw = typeof window !== "undefined" ? window.localStorage.getItem("location_id") : null;
        const locId = locIdRaw ? Number(locIdRaw) : null;

        const [data, comp, locs] = await Promise.all([fetchPurchaseOrder(String(id)), fetchCompany(), fetchLocations()]);
        setPo((data as any)?.purchase_order ?? null);
        setItems(Array.isArray((data as any)?.items) ? (data as any).items : []);
        setCompany((comp as any) ?? null);

        const poRow: any = (data as any)?.purchase_order ?? null;
        const sid = Number(poRow?.supplier_id ?? 0);
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
      const qty = Number(it.qty_ordered ?? 0);
      const unit = Number(it.unit_cost ?? 0);
      if (!Number.isFinite(qty) || !Number.isFinite(unit)) continue;
      sum += qty * unit;
    }
    return Math.round(sum * 100) / 100;
  }, [items]);

  const taxCalc = useMemo(() => calculateTaxes(total, supplierTaxes), [total, supplierTaxes]);

  return (
    <PrintDocument
      title="Purchase Order"
      number={po ? (po.po_number ?? `#${id}`) : undefined}
      loading={loading}
      error={!loading && !po ? "Purchase order not found." : null}
      ready={!!po}
      autoPrint={auto}
      company={company}
      meta={po ? [
        ["Supplier", po.supplier_name ?? po.supplier_id ?? "-"],
        ["Order date", po.ordered_at ?? "-"],
        ...(supplierTaxRegNo ? [["Supplier tax no", supplierTaxRegNo] as [string, string]] : []),
        ["Expected", po.expected_at ?? "-"],
        ["Deliver to", location?.name ?? "-"],
        ["Status", po.status ?? "-"],
        ["Prepared by", po.created_by_name ?? "-"],
        ...(po.last_grn_number ? [["Last GRN", po.last_grn_number] as [string, string]] : []),
      ] : []}
      signatures={["Prepared by", "Approved by", "Supplier acceptance"]}
    >
      <PrintTable
        columns={[
          { key: "item", label: "Item" },
          { key: "qty", label: "Qty", align: "right", width: "24mm" },
          { key: "unit", label: "Unit cost", align: "right", width: "28mm" },
          { key: "amt", label: "Amount", align: "right", width: "30mm" },
        ]}
        rows={items.map((it) => {
          const qty = Number(it.qty_ordered ?? 0), unit = Number(it.unit_cost ?? 0);
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
      {po?.notes ? <PrintNotes>{String(po.notes)}</PrintNotes> : null}
    </PrintDocument>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchCompany, fetchGrn, fetchLocations, fetchSupplier, type CompanyRow, type ServiceLocationRow, type TaxRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { calculateTaxes } from "@/lib/tax-calc";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GrnPrintPage() {
  const router = useRouter();
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
  const printedRef = useRef(false);

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

  useEffect(() => {
    if (!auto) return;
    if (loading) return;
    if (!grn) return;
    if (printedRef.current) return;
    printedRef.current = true;

    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [auto, loading, grn]);

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
          <div className="font-semibold">Print GRN</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/inventory/grn")}>
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
              Loading GRN...
            </div>
          ) : !grn ? (
            <div className="py-24 text-center text-muted-foreground">GRN not found.</div>
          ) : (
            <div className="bg-white border shadow-sm rounded-md p-6 print:border-0 print:shadow-none print:rounded-none">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-2xl font-bold leading-tight">{company?.name ?? "ServiceBay"}</div>
                  <div className="text-sm text-muted-foreground mt-1 space-y-1">
                    {company?.address ? <div className="leading-tight">{company.address}</div> : null}
                    {company?.phone ? (
                      <div className="flex items-center gap-2 leading-tight">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="sr-only">Tel</span>
                        <span>{company.phone}</span>
                      </div>
                    ) : null}
                    {company?.email ? (
                      <div className="flex items-center gap-2 leading-tight">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="sr-only">Email</span>
                        <span>{company.email}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 leading-tight">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-semibold text-foreground">{location?.name ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-right">
                  <div className="text-xl font-bold leading-tight">Goods Receive Note</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    GRN No: <span className="font-semibold text-foreground">{grn.grn_number ?? `#${id}`}</span>
                  </div>
                  <div className="my-3 border-t" />
                  <div>
                    <span className="text-muted-foreground">Supplier: </span>
                    <span className="font-semibold">{grn.supplier_name ?? grn.supplier_id ?? "-"}</span>
                  </div>
                  {supplierTaxRegNo ? (
                    <div>
                      <span className="text-muted-foreground">Tax Reg No: </span>
                      <span className="font-semibold">{supplierTaxRegNo}</span>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-muted-foreground">Entered By: </span>
                    <span className="font-semibold">{grn.created_by_name ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received: </span>
                    <span>{grn.received_at ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PO: </span>
                    <span>{grn.po_number ?? (grn.purchase_order_id ? `#${grn.purchase_order_id}` : "-")}</span>
                  </div>
                </div>
              </div>

              {grn.notes ? (
                <div className="mt-4 text-sm">
                  <div className="text-muted-foreground">Notes</div>
                  <div className="whitespace-pre-wrap">{String(grn.notes)}</div>
                </div>
              ) : null}

              <div className="mt-6 border rounded-md overflow-hidden">
                <div className="grid grid-cols-12 bg-muted/30 text-xs font-semibold px-3 py-2">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Cost</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                <div className="divide-y">
                  {items.map((it) => {
                    const qty = Number(it.qty_received ?? 0);
                    const unit = Number(it.unit_cost ?? 0);
                    const amt = Math.round(qty * unit * 100) / 100;
                    return (
                      <div key={it.id ?? `${it.part_id}-${it.part_name}`} className="grid grid-cols-12 px-3 py-2 text-sm">
                        <div className="col-span-6">
                          <div className="font-medium leading-tight">{it.part_name ?? `Item #${it.part_id}`}</div>
                          {it.brand_name ? (
                            <div className="text-[11px] text-muted-foreground leading-tight">Brand: {it.brand_name}</div>
                          ) : null}
                          {it.sku ? <div className="text-[11px] text-muted-foreground leading-tight">SKU: {it.sku}</div> : null}
                        </div>
                        <div className="col-span-2 text-right tabular-nums">{qty.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                        <div className="col-span-2 text-right tabular-nums">{money(unit)}</div>
                        <div className="col-span-2 text-right font-semibold tabular-nums">{money(amt)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="min-w-[260px] border rounded-md px-4 py-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="text-muted-foreground">Sub Total</div>
                    <div className="text-lg font-bold tabular-nums">{money(total)}</div>
                  </div>
                  {taxCalc.lines.length > 0 ? (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {taxCalc.lines.map((t) => (
                        <div key={t.tax_id} className="flex items-center justify-between gap-4 text-sm">
                          <div className="text-muted-foreground">
                            {t.code} ({Number(t.rate_percent).toLocaleString()}%)
                          </div>
                          <div className="font-semibold tabular-nums">{money(t.amount)}</div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-4 text-sm pt-1">
                        <div className="text-muted-foreground">Total Tax</div>
                        <div className="font-semibold tabular-nums">{money(taxCalc.totalTax)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-2 border-t">
                        <div className="text-muted-foreground">Grand Total</div>
                        <div className="text-lg font-bold tabular-nums">{money(taxCalc.grandTotal)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 text-xs text-muted-foreground">Printed: {new Date().toLocaleString()}</div>

              <div className="mt-8 grid grid-cols-3 gap-8 text-sm">
                {["Checked By", "Authorized By"].map((label) => (
                  <div key={label} className="space-y-2">
                    <div className="h-6 border-b border-dotted border-slate-400 print:border-black/60" />
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

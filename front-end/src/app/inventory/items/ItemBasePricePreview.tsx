"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { fetchCompany, fetchLocations, fetchTaxes } from "@/lib/api";
import { computePosTotals, resolveLocationTaxes } from "@/lib/pricing/pos-totals";

/**
 * Menu-price (tax-inclusive) POS locations: Selling Price is the menu price customers see.
 * One quiet line under the field shows the base the tax engine books at the current location;
 * other menu-price outlets are in a small expandable table. Same engine as the POS.
 */
export function ItemBasePricePreview({ price }: { price: string | number }) {
  const [locs, setLocs] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    try { setCurrentId(localStorage.getItem("location_id")); } catch {}
    fetchLocations().then((r: any) => setLocs(Array.isArray(r) ? r : [])).catch(() => {});
    fetchTaxes("", { all: true }).then(t => setTaxes(t || [])).catch(() => {});
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const menuPrice = Number(price || 0);
    return locs
      .filter(l => l.tax_mode === "inclusive" && Boolean(l.is_pos_active))
      .map(l => {
        const locTaxes = resolveLocationTaxes(l, taxes, company);
        const sc = l.allow_service_charge ? Number(l.service_charge_rate || 0) : 0;
        const t = computePosTotals({
          mode: "inclusive",
          cart: [{ quantity: 1, unit_price: menuPrice, discount: 0 }],
          taxes: locTaxes,
          billDiscountType: "fixed" as any,
          billDiscountValue: 0,
          promoDiscount: 0,
          serviceChargeRate: sc,
        });
        return {
          id: String(l.id),
          name: l.name as string,
          taxes: locTaxes.map((x: any) => x.code).join(" + ") || "No tax",
          sc,
          base: t.internalLines[0]?.unit_price ?? menuPrice,
        };
      })
      .sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  }, [locs, taxes, company, price, currentId]);

  if (rows.length === 0) return null; // no menu-price outlets: Selling Price is the plain price

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const main = rows[0];
  const others = rows.slice(1);

  return (
    <div className="text-xs text-muted-foreground" aria-live="polite">
      <div className="flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
        <p className="min-w-0">
          Menu price (tax inclusive). Base booked{rows.length > 1 ? ` at ${main.name}` : ""}:{" "}
          <span className="font-semibold text-foreground tabular-nums">{fmt(main.base)}</span>
          <span className="whitespace-nowrap"> · {main.taxes}{main.sc ? ` · +${main.sc}% SC on dine-in` : ""}</span>
        </p>
      </div>

      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="mt-1 ml-5 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {open ? "Hide" : "Show"} {others.length} other outlet{others.length > 1 ? "s" : ""}
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open && (
            <table className="mt-1.5 ml-5 w-[calc(100%-1.25rem)] text-xs">
              <tbody className="divide-y">
                {others.map(r => (
                  <tr key={r.id}>
                    <td className="py-1 pr-2 truncate max-w-[10rem]">{r.name}</td>
                    <td className="py-1 pr-2">{r.taxes}</td>
                    <td className="py-1 text-right font-semibold text-foreground tabular-nums">{fmt(r.base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

/**
 * POS bill totals engine.
 *
 * Two pricing modes, chosen per location (service_locations.tax_mode):
 *
 *  - "exclusive" (standard): item prices are pre-tax. Taxes run on the
 *    discounted subtotal; service charge (dine-in) is added on top and is
 *    NOT taxed. This is the original POS behaviour and is kept unchanged.
 *
 *  - "inclusive" (menu pricing, hidden breakdown): item prices are the menu
 *    card prices, which already contain TDL / SSCL / VAT etc. The customer
 *    sees only  Menu price + Service charge = Total.  Internally the system
 *    back-calculates the base price and books the full chain:
 *
 *        Base  →  + SC  =  Subtotal  →  + taxes on Subtotal (chain)  =  Total
 *
 *    Because SC is a % of the base, the base is the same for dine-in and
 *    take-away:  base = menu price / taxFactor,  where taxFactor is the
 *    compound multiplier of the location's taxes (1.2213 for TDL 1%,
 *    SSCL 2.5%, VAT 18% on base+previous).
 *
 *    Rounding rule: every component is rounded to 2 decimals and any
 *    remaining cent difference goes into the last tax in the chain
 *    (usually VAT), so the internal total always equals the displayed total.
 */

export type PricingMode = "exclusive" | "inclusive";

export interface PosTaxDef {
  id?: number;
  name: string;
  code: string;
  rate_percent: number | string;
  apply_on?: "base" | "base_plus_previous" | string;
  sort_order?: number | string;
}

export interface PosCartLine {
  quantity: number;
  unit_price: number; // price the cashier sees (menu price in inclusive mode)
  discount: number;   // per-unit discount, same units as unit_price
}

export interface AppliedTaxLine {
  name: string;
  code: string;
  rate_percent: number;
  amount: number;
  is_sc?: boolean;
}

export interface InternalLine {
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface PosTotals {
  mode: PricingMode;
  // ---- What the cashier / customer sees ----
  subtotal: number;          // gross of lines (display prices)
  lineDiscountTotal: number;
  billDiscountAmt: number;
  promoDiscountAmt: number;
  taxableAmount: number;     // display amount after discounts
  serviceChargeAmt: number;  // display service charge
  serviceChargeRate: number;
  /** Lines shown on the POS / customer bill. Inclusive mode: SC only. */
  displayTaxes: AppliedTaxLine[];
  grandTotal: number;
  // ---- What gets booked (invoice header / taxes / lines) ----
  /** Full breakdown stored in invoice_taxes (SC + every tax). */
  appliedTaxes: AppliedTaxLine[];
  taxSum: number;
  internalSubtotal: number;
  internalDiscountTotal: number;
  internalBase: number;       // internal taxable amount (after discounts)
  internalLines: InternalLine[];
  taxFactor: number;
}

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const sortTaxes = (taxes: PosTaxDef[]) =>
  [...(taxes || [])].sort((a, b) => Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100));

/** Run the tax chain on an amount. `round` rounds each tax to 2 decimals. */
export function runTaxChain(amount: number, taxes: PosTaxDef[], round = false): AppliedTaxLine[] {
  let currentBase = amount;
  const out: AppliedTaxLine[] = [];
  for (const tax of sortTaxes(taxes)) {
    const rate = Number(tax.rate_percent) || 0;
    const applyTo = tax.apply_on === "base_plus_previous" ? currentBase : amount;
    let taxAmt = applyTo * (rate / 100);
    if (round) taxAmt = round2(taxAmt);
    out.push({ name: tax.name, code: tax.code, rate_percent: rate, amount: taxAmt });
    currentBase += taxAmt;
  }
  return out;
}

/** Compound multiplier of a tax chain: 1 + total tax on 1 unit. */
export function taxFactor(taxes: PosTaxDef[]): number {
  return 1 + runTaxChain(1, taxes).reduce((s, t) => s + t.amount, 0);
}

/**
 * Taxes that apply at a POS location: the location's allowed_taxes_json,
 * or (legacy, when the location has no config) the company's tax_ids_json.
 */
export function resolveLocationTaxes(loc: any, allTaxes: any[], company?: any): any[] {
  if (!loc) return [];
  let allowedIds: number[] = [];
  let isExplicitlySet = false;
  try {
    if (loc.allowed_taxes_json) {
      allowedIds = JSON.parse(loc.allowed_taxes_json);
      isExplicitlySet = Array.isArray(allowedIds);
    }
  } catch {
    allowedIds = [];
  }

  if (!isExplicitlySet && loc.allowed_taxes_json == null) {
    let companyEnabledIds = new Set<number>();
    if (company?.tax_ids_json) {
      try {
        const ids = JSON.parse(company.tax_ids_json);
        if (Array.isArray(ids)) companyEnabledIds = new Set(ids.map(Number));
      } catch {}
    }
    return (allTaxes || []).filter(t => t.is_active && companyEnabledIds.has(Number(t.id)));
  }
  const allowedSet = new Set((allowedIds || []).map(Number));
  return (allTaxes || []).filter(t => t.is_active && allowedSet.has(Number(t.id)));
}

export interface ComputePosTotalsInput {
  mode: PricingMode;
  cart: PosCartLine[];
  taxes: PosTaxDef[];
  billDiscountType?: "percentage" | "fixed" | string;
  billDiscountValue?: number;
  promoDiscount?: number;
  /** Service charge % to apply (pass 0 when not dine-in / not enabled). */
  serviceChargeRate?: number;
}

export function computePosTotals(input: ComputePosTotalsInput): PosTotals {
  const { mode, cart, taxes } = input;
  const scRate = Number(input.serviceChargeRate || 0);
  const billValue = Number(input.billDiscountValue || 0);

  let subtotal = 0;
  let lineDiscountTotal = 0;
  for (const item of cart) {
    subtotal += item.quantity * item.unit_price;
    lineDiscountTotal += item.quantity * item.discount;
  }
  const billDiscountAmt =
    input.billDiscountType === "percentage" ? (subtotal - lineDiscountTotal) * (billValue / 100) : billValue;
  const promoDiscountAmt = Number(input.promoDiscount || 0);
  const taxableAmount = Math.max(0, subtotal - lineDiscountTotal - billDiscountAmt - promoDiscountAmt);

  if (mode !== "inclusive") {
    // ---------- Standard (exclusive) — original POS behaviour ----------
    const appliedTaxes = runTaxChain(taxableAmount, taxes);
    let taxSum = appliedTaxes.reduce((s, t) => s + t.amount, 0);
    let serviceChargeAmt = 0;
    if (scRate > 0) {
      serviceChargeAmt = taxableAmount * (scRate / 100);
      appliedTaxes.push({ name: "Service Charge", code: "SC", rate_percent: scRate, amount: serviceChargeAmt, is_sc: true });
      taxSum += serviceChargeAmt;
    }
    const grandTotal = taxableAmount + taxSum;
    return {
      mode: "exclusive",
      subtotal, lineDiscountTotal, billDiscountAmt, promoDiscountAmt, taxableAmount,
      serviceChargeAmt, serviceChargeRate: scRate,
      displayTaxes: appliedTaxes,
      grandTotal,
      appliedTaxes,
      taxSum,
      internalSubtotal: subtotal,
      internalDiscountTotal: lineDiscountTotal + billDiscountAmt + promoDiscountAmt,
      internalBase: taxableAmount,
      internalLines: cart.map((i) => ({
        unit_price: i.unit_price,
        discount: i.discount,
        line_total: i.quantity * i.unit_price - i.quantity * i.discount,
      })),
      taxFactor: 1,
    };
  }

  // ---------- Menu pricing (inclusive, hidden breakdown) ----------
  const factor = taxFactor(taxes);

  // Display side (what the customer pays)
  const displayTaxable = round2(taxableAmount);
  const serviceChargeAmt = scRate > 0 ? round2(displayTaxable * (scRate / 100)) : 0;
  const grandTotal = round2(displayTaxable + serviceChargeAmt);

  // Internal side: back-calculate per line, then book the chain forward.
  const internalLines: InternalLine[] = cart.map((i) => {
    const unit = round2(i.unit_price / factor);
    const disc = round2(i.discount / factor);
    return { unit_price: unit, discount: disc, line_total: round2(i.quantity * (unit - disc)) };
  });
  const internalSubtotal = round2(cart.reduce((s, i, idx) => s + i.quantity * internalLines[idx].unit_price, 0));
  const internalLineDisc = round2(cart.reduce((s, i, idx) => s + i.quantity * internalLines[idx].discount, 0));
  const internalBillDisc = round2((billDiscountAmt + promoDiscountAmt) / factor);
  const internalBase = Math.max(0, round2(internalSubtotal - internalLineDisc - internalBillDisc));

  const internalSC = scRate > 0 ? round2(internalBase * (scRate / 100)) : 0;
  const chainBase = round2(internalBase + internalSC);
  const taxLines = runTaxChain(chainBase, taxes, true);

  // Absorb rounding so internal total === displayed total.
  const booked = round2(chainBase + taxLines.reduce((s, t) => s + t.amount, 0));
  const diff = round2(grandTotal - booked);
  if (diff !== 0) {
    if (taxLines.length > 0) {
      const last = taxLines[taxLines.length - 1];
      last.amount = round2(last.amount + diff);
    }
  }

  const appliedTaxes: AppliedTaxLine[] = [];
  if (scRate > 0) {
    appliedTaxes.push({ name: "Service Charge", code: "SC", rate_percent: scRate, amount: internalSC, is_sc: true });
  }
  appliedTaxes.push(...taxLines);
  let taxSum = round2(appliedTaxes.reduce((s, t) => s + t.amount, 0));

  // No taxes configured: factor is 1, so only SC can differ by a cent.
  if (taxLines.length === 0 && round2(internalBase + taxSum) !== grandTotal && appliedTaxes.length > 0) {
    const fix = round2(grandTotal - internalBase - taxSum);
    appliedTaxes[0].amount = round2(appliedTaxes[0].amount + fix);
    taxSum = round2(taxSum + fix);
  }

  return {
    mode: "inclusive",
    subtotal, lineDiscountTotal, billDiscountAmt, promoDiscountAmt, taxableAmount,
    serviceChargeAmt, serviceChargeRate: scRate,
    displayTaxes: scRate > 0 ? [{ name: "Service Charge", code: "SC", rate_percent: scRate, amount: serviceChargeAmt, is_sc: true }] : [],
    grandTotal,
    appliedTaxes,
    taxSum,
    internalSubtotal,
    internalDiscountTotal: round2(internalLineDisc + internalBillDisc),
    internalBase,
    internalLines,
    taxFactor: factor,
  };
}

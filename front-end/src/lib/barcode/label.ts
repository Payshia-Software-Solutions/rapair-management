import * as bwip from "bwip-js/browser";
import { buildGs1, toGtin14 } from "./encoders";

export type Symbology =
  | "code128" | "gs1128" | "ean13" | "ean8" | "upca" | "upce"
  | "code39" | "code93" | "itf" | "code2of5" | "codabar"
  | "qr" | "gs1dm";

/** Barcode types offered on the label printer, grouped for the picker. */
export const SYMBOLOGY_INFO: Record<Symbology, { label: string; group: "Retail" | "Industrial / logistics" | "2D"; hint: string; twoD?: boolean; sample: string }> = {
  ean13:   { label: "EAN-13", group: "Retail", hint: "Supermarket barcode. 12–13 digits (check digit added or verified).", sample: "4006381333931" },
  ean8:    { label: "EAN-8", group: "Retail", hint: "Small retail packs. 7–8 digits.", sample: "96385074" },
  upca:    { label: "UPC-A", group: "Retail", hint: "US/Canada retail. 11–12 digits.", sample: "036000291452" },
  upce:    { label: "UPC-E", group: "Retail", hint: "Short UPC for small packs. 7–8 digits starting with 0 or 1.", sample: "01234565" },
  code128: { label: "Code 128", group: "Industrial / logistics", hint: "Any text or number. The most common internal barcode.", sample: "SKU-1001" },
  gs1128:  { label: "GS1-128", group: "Industrial / logistics", hint: "GTIN + batch + MFG + EXP inside the barcode (AI 01/10/11/17).", sample: "4006381333931" },
  code39:  { label: "Code 39", group: "Industrial / logistics", hint: "Old industrial/automotive standard. A–Z, 0–9, - . $ / + % space.", sample: "SKU-1001" },
  code93:  { label: "Code 93", group: "Industrial / logistics", hint: "Denser than Code 39; any text.", sample: "SKU-1001" },
  itf:     { label: "Interleaved 2 of 5 (ITF)", group: "Industrial / logistics", hint: "Cartons and cases. Digits only (a 0 is added for odd lengths).", sample: "12345670" },
  code2of5:{ label: "Standard (Industrial) 2 of 5", group: "Industrial / logistics", hint: "Warehouses, older systems. Digits only.", sample: "12345670" },
  codabar: { label: "Codabar", group: "Industrial / logistics", hint: "Libraries, blood banks, couriers. Digits and - $ : / . +", sample: "1234567890" },
  qr:      { label: "QR code", group: "2D", hint: "All details in one square code; phones can read it.", twoD: true, sample: "SKU-1001" },
  gs1dm:   { label: "GS1 DataMatrix", group: "2D", hint: "Pharma/medical standard: GTIN + batch + dates in a tiny square.", twoD: true, sample: "4006381333931" },
};
export type DateFormat = "dd/mm/yyyy" | "yyyy-mm-dd" | "mm/yyyy" | "dd mmm yyyy";

export interface LabelData {
  name: string;
  sku?: string | null;
  barcode?: string | null; // item barcode (EAN/UPC/internal)
  price?: number | null;
  unit?: string | null;
  batch?: string | null;
  mfg?: string | null;     // YYYY-MM-DD
  exp?: string | null;     // YYYY-MM-DD
}

export interface LabelSettings {
  symbology: Symbology;
  layout: "roll" | "grid";
  width: number;    // mm (roll label / grid cell height uses `height`)
  height: number;   // mm
  padding: number;  // mm
  cols: number;     // grid
  gap: number;      // grid, mm
  marginTop: number;
  marginLeft: number;
  barHeight: number; // mm
  fontSize: number;  // pt, base size
  header: string;
  currency: string;
  dateFormat: DateFormat;
  gs1Price: boolean; // put the price in the GS1 barcode (AI 3922)
  cutLines?: boolean; // A4 sheets: dashed cutting guides between labels
  show: { header: boolean; name: boolean; sku: boolean; hri: boolean; batch: boolean; mfg: boolean; exp: boolean; price: boolean };
}

export const DEFAULT_SETTINGS: LabelSettings = {
  symbology: "code128", layout: "roll", width: 50, height: 30, padding: 2,
  cols: 3, gap: 2, marginTop: 10, marginLeft: 8,
  barHeight: 10, fontSize: 7, header: "", currency: "LKR", dateFormat: "dd/mm/yyyy", gs1Price: false, cutLines: true,
  show: { header: false, name: true, sku: false, hri: true, batch: false, mfg: false, exp: false, price: true },
};

/** Ready-made label designs; each sets the barcode type, size and which fields show. */
export const TEMPLATES: Record<string, { label: string; hint: string; apply: Partial<LabelSettings> }> = {
  retail: {
    label: "Retail price tag", hint: "Name, barcode, price",
    apply: { symbology: "code128", width: 50, height: 30, barHeight: 10, show: { header: false, name: true, sku: false, hri: true, batch: false, mfg: false, exp: false, price: true } },
  },
  product: {
    label: "Product label (batch / MFG / EXP)", hint: "GS1-128 with batch and dates inside the barcode",
    apply: { symbology: "gs1128", width: 60, height: 40, barHeight: 11, show: { header: true, name: true, sku: false, hri: true, batch: true, mfg: true, exp: true, price: true } },
  },
  food: {
    label: "Food / pharma (QR)", hint: "QR code with all details, dates in big text",
    apply: { symbology: "qr", width: 50, height: 30, show: { header: false, name: true, sku: false, hri: false, batch: true, mfg: true, exp: true, price: true } },
  },
  shelf: {
    label: "Shelf / bin label", hint: "Large name and SKU, no price",
    apply: { symbology: "code128", width: 80, height: 50, barHeight: 14, fontSize: 9, show: { header: false, name: true, sku: true, hri: true, batch: false, mfg: false, exp: false, price: false } },
  },
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function fmtDate(d: string | null | undefined, f: DateFormat): string {
  const m = String(d ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, y, mo, da] = m;
  if (f === "yyyy-mm-dd") return `${y}-${mo}-${da}`;
  if (f === "mm/yyyy") return `${mo}/${y}`;
  if (f === "dd mmm yyyy") return `${da} ${MONTHS[Number(mo) - 1]} ${y}`;
  return `${da}/${mo}/${y}`;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (v: number) => v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface BarcodeResult { svg: string; hri: string; error?: string; note?: string }

const BCID: Record<Symbology, string> = {
  code128: "code128", gs1128: "gs1-128", ean13: "ean13", ean8: "ean8", upca: "upca", upce: "upce",
  code39: "code39", code93: "code93ext", itf: "interleaved2of5", code2of5: "code2of5", codabar: "rationalizedCodabar",
  qr: "qrcode", gs1dm: "gs1datamatrix",
};

/** bwip-js messages look like "bwipp.ean13badCheckDigit#6915: Incorrect EAN-13 check digit provided". */
const cleanError = (e: unknown) => String((e as any)?.message ?? e).replace(/^bwip(p|-js)?\.[\w]+#?\d*:\s*/i, "");

/** Text to encode for each type, or an error when the item's code cannot be used. */
function encodeText(d: LabelData, s: LabelSettings): { text?: string; error?: string; note?: string } {
  const code = String(d.barcode || d.sku || "").trim();
  const digits = code.replace(/\s/g, "");
  const onlyDigits = /^\d+$/.test(digits);
  switch (s.symbology) {
    case "gs1128":
    case "gs1dm": {
      const gtin = toGtin14(d.barcode);
      const g = buildGs1({
        gtin, productId: gtin ? undefined : code || undefined,
        mfg: s.show.mfg ? d.mfg : null, exp: s.show.exp ? d.exp : null, batch: s.show.batch ? d.batch : null,
        price: s.gs1Price ? d.price ?? null : null,
      });
      if (!g) return { error: "Nothing to encode: add a barcode, SKU, batch or date" };
      return { text: g.hri, note: gtin ? undefined : "No valid GTIN on this item: SKU sent as AI 240" };
    }
    case "qr":
      return {
        text: [
          d.name, code && `CODE:${code}`,
          s.show.batch && d.batch && `BATCH:${d.batch}`, s.show.mfg && d.mfg && `MFG:${d.mfg}`, s.show.exp && d.exp && `EXP:${d.exp}`,
          s.show.price && d.price != null && `PRICE:${s.currency} ${money(Number(d.price))}`,
        ].filter(Boolean).join("\n") || "-",
      };
    case "ean13":
      return onlyDigits && (digits.length === 12 || digits.length === 13) ? { text: digits } : { error: "EAN-13 needs a 12 or 13 digit barcode" };
    case "ean8":
      return onlyDigits && (digits.length === 7 || digits.length === 8) ? { text: digits } : { error: "EAN-8 needs a 7 or 8 digit barcode" };
    case "upca":
      return onlyDigits && (digits.length === 11 || digits.length === 12) ? { text: digits } : { error: "UPC-A needs an 11 or 12 digit barcode" };
    case "upce":
      return onlyDigits && (digits.length === 7 || digits.length === 8) && /^[01]/.test(digits) ? { text: digits } : { error: "UPC-E needs 7–8 digits starting with 0 or 1" };
    case "itf":
      if (!onlyDigits) return { error: "Interleaved 2 of 5 takes digits only" };
      return { text: digits.length % 2 ? `0${digits}` : digits };
    case "code2of5":
      return onlyDigits ? { text: digits } : { error: "Industrial 2 of 5 takes digits only" };
    case "codabar":
      return /^[0-9\-$:/.+]+$/.test(digits) ? { text: `A${digits}A` } : { error: "Codabar takes digits and - $ : / . + only" };
    case "code39": {
      const t = code.toUpperCase();
      return /^[0-9A-Z\-. $/+%]+$/.test(t) ? { text: t } : { error: "Code 39 takes A–Z, 0–9 and - . $ / + % space only" };
    }
    default:
      return code ? { text: code } : { error: "Item has no barcode or SKU" };
  }
}

/** The barcode for one label. `error` means it cannot be made with this barcode type. */
export function makeBarcode(d: LabelData, s: LabelSettings): BarcodeResult {
  const info = SYMBOLOGY_INFO[s.symbology] ?? SYMBOLOGY_INFO.code128;
  const t = encodeText(d, s);
  if (t.error || !t.text) return { svg: "", hri: "", error: t.error || "Nothing to encode" };
  try {
    const svg = bwip.toSVG({
      bcid: BCID[s.symbology] ?? "code128",
      text: t.text,
      scale: 2,
      ...(info.twoD ? {} : { height: s.barHeight, includetext: s.show.hri, textxalign: "center", textsize: 8 }),
    } as any);
    // Fit the box without stretching (keeps the human-readable text in proportion).
    const fitted = svg.replace("<svg ", `<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" `);
    return { svg: fitted, hri: t.text, note: t.note };
  } catch (e) {
    return { svg: "", hri: t.text, error: cleanError(e) };
  }
}

/** Width of one label in mm (grid cells share the A4 width). */
export function labelWidth(s: LabelSettings): number {
  if (s.layout === "roll") return s.width;
  const cols = Math.max(1, s.cols);
  return (210 - s.marginLeft * 2 - s.gap * (cols - 1)) / cols;
}

/** One label as HTML (mm units, black on white). Used by both the preview and the print window. */
export function labelHtml(d: LabelData, s: LabelSettings): string {
  const bc = makeBarcode(d, s);
  const w = labelWidth(s);
  const fs = s.fontSize;
  const sh = s.show;
  const price = sh.price && d.price != null ? `${esc(s.currency)} ${money(Number(d.price))}` : "";
  const facts: Array<[string, string]> = [];
  if (sh.batch && d.batch) facts.push(["BATCH", d.batch]);
  if (sh.mfg && d.mfg) facts.push(["MFG", fmtDate(d.mfg, s.dateFormat)]);
  if (sh.exp && d.exp) facts.push(["EXP", fmtDate(d.exp, s.dateFormat)]);
  const factsHtml = facts.map(([k, v]) =>
    `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="font-weight:600">${k}</span> ${esc(v)}</div>`).join("");

  const header = sh.header && s.header ? `<div style="font-size:${fs}pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center">${esc(s.header)}</div>` : "";
  const name = sh.name ? `<div style="font-size:${fs}pt;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center">${esc(d.name)}</div>` : "";
  const sku = sh.sku && d.sku ? `<div style="font-size:${fs}pt;text-align:center">${esc(d.sku)}</div>` : "";
  const err = bc.error ? `<div style="font-size:${fs}pt;color:#c00;text-align:center;border:1px dashed #c00;padding:1mm">${esc(bc.error)}</div>` : "";

  const box = `width:${w}mm;height:${s.height}mm;padding:${s.padding}mm;box-sizing:border-box;overflow:hidden;background:#fff;color:#000;font-family:'Times New Roman',Times,serif;font-size:${fs}pt;line-height:1.15`;

  if (SYMBOLOGY_INFO[s.symbology]?.twoD && !bc.error) {
    const qr = Math.min(s.height - s.padding * 2, w * 0.45);
    return `<div class="lbl" style="${box};display:flex;gap:1.5mm;align-items:center">
      <div style="width:${qr}mm;height:${qr}mm;flex:none">${bc.svg}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.4mm">
        ${header.replace("text-align:center", "text-align:left")}${name.replace("text-align:center", "text-align:left")}${sku.replace("text-align:center", "text-align:left")}
        ${factsHtml}
        ${price ? `<div style="font-size:${fs}pt;font-weight:700;margin-top:auto">${price}</div>` : ""}
      </div>
    </div>`;
  }

  // The code text is drawn by the barcode itself (classic EAN/UPC digit layout), so give the box room for it.
  const barBox = s.barHeight + (sh.hri ? 3.5 : 0);
  // Detail rows: a centred block whose rows are left-aligned, with every ":" in one column.
  const rows: Array<[string, string, boolean?]> = [];
  if (sh.mfg && d.mfg) rows.push(["Packed", fmtDate(d.mfg, s.dateFormat)]);
  if (sh.exp && d.exp) rows.push(["Best before", fmtDate(d.exp, s.dateFormat)]);
  if (sh.batch && d.batch) rows.push(["Batch", d.batch]);
  if (price) rows.push(["Price", price, true]);
  const rowsHtml = rows.length ? `<div style="display:grid;grid-template-columns:auto auto auto;column-gap:1mm;row-gap:.2mm;align-items:baseline;width:max-content;max-width:100%;margin:0 auto;text-align:left;font-size:${fs}pt">
      ${rows.map(([k, v, strong]) => `<div style="font-weight:600;white-space:nowrap">${k}</div><div>:</div><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${strong ? `font-weight:700` : ""}">${strong ? v : esc(v)}</div>`).join("")}
    </div>` : "";
  return `<div class="lbl" style="${box};display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:.8mm">
    ${header}${name}${sku}
    ${rowsHtml}
    ${err || `<div style="height:${barBox}mm;flex:none">${bc.svg}</div>`}
  </div>`;
}

/** On A4 sheets, a dashed cutting guide around the label, drawn in the middle of the gap. */
export function cutWrap(html: string, s: LabelSettings): string {
  if (s.layout !== "grid" || s.cutLines === false) return html;
  return `<div style="outline:0.2mm dashed #888;outline-offset:${(s.gap / 2).toFixed(2)}mm">${html}</div>`;
}

/** Full print document for many labels. */
export function printDocument(labels: LabelData[], s: LabelSettings): string {
  const body = s.layout === "roll"
    ? labels.map((l) => `<div class="page">${labelHtml(l, s)}</div>`).join("")
    : `<div style="padding:${s.marginTop}mm ${s.marginLeft}mm 0;display:grid;grid-template-columns:repeat(${Math.max(1, s.cols)},${labelWidth(s)}mm);gap:${s.gap}mm">${labels.map((l) => cutWrap(labelHtml(l, s), s)).join("")}</div>`;
  const page = s.layout === "roll" ? `${s.width}mm ${s.height}mm` : "A4 portrait";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page{size:${page};margin:0}
    html,body{margin:0;padding:0;background:#fff}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:${s.width}mm;height:${s.height}mm;overflow:hidden;page-break-after:always;break-after:page}
    .page:last-child{page-break-after:auto;break-after:auto}
    .lbl{break-inside:avoid}
  </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print();window.close()},300)}</script></body></html>`;
}

import { browserPrint, code128Svg, escHtml as esc, printOnReceiptPrinter, toDataUrl } from "@/lib/print-doc";
import { fetchCompany } from "@/lib/api/admin";
import { contentUrl } from "@/lib/api";

export type LoyaltyCardData = {
  member_no: string;
  name: string;
  phone?: string | null;
  tier?: string | null;
  tier_color?: string | null;
  program?: string | null;
  shop?: string | null;
  joined_at?: string | null;
};

type Brand = { company: string; logo: string };

const safeColor = (c?: string | null) => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#1e293b");

/** Company name + logo (as a data: URL) for the card, loaded once per page. */
let brandCache: Promise<Brand> | null = null;
function loadBrand(): Promise<Brand> {
  if (!brandCache) {
    brandCache = (async () => {
      try {
        const co: any = await fetchCompany();
        const logo = co?.logo_filename ? await toDataUrl(contentUrl("company", co.logo_filename)) : "";
        return { company: String(co?.name || ""), logo };
      } catch {
        brandCache = null; // try again next time
        return { company: "", logo: "" };
      }
    })();
  }
  return brandCache;
}

/** Location name only when it adds something to the company name. */
const outlet = (c: LoyaltyCardData, b: Brand) => (c.shop && c.shop !== b.company ? c.shop : "");

/** Receipt-printer version (80/58 mm, black only). */
function receiptHtml(c: LoyaltyCardData, b: Brand, paper: string) {
  const narrow = paper === "58mm";
  const shop = outlet(c, b);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Member card ${esc(c.member_no)}</title>
<style>
  @page { size: ${paper} auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; width: ${narrow ? "48mm" : "72mm"}; margin: 0 auto; padding: 3mm 0; color: #000; background: #fff; text-align: center; }
  .brand { padding: 8px 6px 6px; }
  .brand img { display: block; margin: 0 auto 4px; max-width: ${narrow ? "34mm" : "44mm"}; max-height: ${narrow ? "16mm" : "20mm"}; object-fit: contain; filter: grayscale(1) contrast(1.4); }
  .brand .co { font-size: ${narrow ? "13px" : "15px"}; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
  .brand .shop { font-size: 10px; margin-top: 1px; }
  .card { border: 2px solid #000; border-radius: 8px; overflow: hidden; }
  .band { background: #000; color: #fff; padding: ${narrow ? "6px 4px" : "8px 6px"}; }
  .band h1 { margin: 0; font-size: ${narrow ? "14px" : "17px"}; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .band .sub { font-size: 10px; letter-spacing: .35em; margin-top: 2px; }
  .inner { padding: ${narrow ? "8px 6px" : "10px"}; }
  .name { font-size: ${narrow ? "15px" : "18px"}; font-weight: 800; }
  .tier { display: inline-block; margin-top: 5px; padding: 2px 10px; border: 2px solid #000; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; }
  .bc svg { width: 100%; height: ${narrow ? "13mm" : "15mm"}; display: block; margin-top: 10px; }
  .no { font-family: Consolas, "Courier New", monospace; font-size: ${narrow ? "14px" : "16px"}; font-weight: 700; letter-spacing: .2em; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; }
  .terms { font-size: 9px; margin-top: 6px; line-height: 1.35; }
  .cut { margin-top: 4mm; font-size: 9px; letter-spacing: .3em; }
</style></head><body>
<div class="card">
  ${b.logo || b.company ? `<div class="brand">
    ${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ""}
    ${b.company ? `<div class="co">${esc(b.company)}</div>` : ""}
    ${shop ? `<div class="shop">${esc(shop)}</div>` : ""}
  </div>` : ""}
  <div class="band">
    <h1>${esc(c.program || "Loyalty Club")}</h1>
    <div class="sub">MEMBER CARD</div>
  </div>
  <div class="inner">
    <div class="name">${esc(c.name)}</div>
    ${c.tier ? `<div class="tier">${esc(c.tier)}</div>` : ""}
    <div class="bc">${code128Svg(c.member_no)}</div>
    <div class="no">${esc(c.member_no)}</div>
    <div class="meta"><span>${c.phone ? esc(c.phone) : ""}</span><span>${c.joined_at ? "Since " + esc(String(c.joined_at).slice(0, 10)) : ""}</span></div>
    <div class="terms">Show this card at the counter to earn and redeem points.</div>
  </div>
</div>
<div class="cut">- - - - - - - - - - - -</div>
</body></html>`;
}

/** CR80 card size (85.6 × 54 mm) in the tier colour, for a card printer or cutting out. */
function cr80Html(c: LoyaltyCardData, b: Brand) {
  const color = safeColor(c.tier_color);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Member card ${esc(c.member_no)}</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .card { width: 85.6mm; height: 54mm; border-radius: 3mm; overflow: hidden; position: relative; color: #fff;
          background: linear-gradient(135deg, ${color} 0%, #0f172a 115%); padding: 4mm 5mm; display: flex; flex-direction: column; }
  .card::after { content: ""; position: absolute; right: -14mm; top: -14mm; width: 42mm; height: 42mm; border-radius: 50%; background: rgba(255,255,255,.10); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; position: relative; z-index: 1; }
  .brand { display: flex; align-items: center; gap: 2.2mm; min-width: 0; }
  .logo { width: 10mm; height: 10mm; border-radius: 2mm; background: #fff; padding: .8mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .co { font-size: 3.3mm; font-weight: 900; letter-spacing: .03em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prog { font-size: 2.3mm; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; opacity: .85; margin-top: .6mm; }
  .tier { font-size: 2.4mm; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; border: .3mm solid rgba(255,255,255,.8); border-radius: 99px; padding: .6mm 2.4mm; flex-shrink: 0; }
  .name { margin-top: auto; font-size: 4mm; font-weight: 800; position: relative; z-index: 1; }
  .no { font-family: Consolas, "Courier New", monospace; font-size: 2.8mm; letter-spacing: .25em; opacity: .9; position: relative; z-index: 1; }
  .bc { margin-top: 2mm; background: #fff; border-radius: 1.2mm; padding: 1.2mm 2mm; position: relative; z-index: 1; }
  .bc svg { width: 100%; height: 7.5mm; display: block; }
</style></head><body>
<div class="card">
  <div class="top">
    <div class="brand">
      ${b.logo ? `<div class="logo"><img src="${esc(b.logo)}" alt=""></div>` : ""}
      <div style="min-width:0">
        <div class="co">${esc(b.company || c.shop || c.program || "Loyalty Club")}</div>
        <div class="prog">${esc(c.program || "Rewards")}</div>
      </div>
    </div>
    ${c.tier ? `<div class="tier">${esc(c.tier)}</div>` : ""}
  </div>
  <div class="name">${esc(c.name)}</div>
  <div class="no">${esc(c.member_no)}</div>
  <div class="bc">${code128Svg(c.member_no)}</div>
</div>
</body></html>`;
}

/** Prints a loyalty member card with the company name and logo: on the POS receipt printer, or CR80 card size through the browser. */
export async function printLoyaltyCard(c: LoyaltyCardData, format: "receipt" | "card" = "receipt") {
  const brand = await loadBrand();
  if (format === "card") { browserPrint(cr80Html(c, brand)); return; }
  return printOnReceiptPrinter(paper => receiptHtml(c, brand, paper), `Member card ${c.member_no}`);
}

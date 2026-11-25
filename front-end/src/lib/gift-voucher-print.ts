import type { GiftVoucher } from "@/lib/api/gift-vouchers";
import { code128Svg, escHtml, printOnReceiptPrinter } from "@/lib/print-doc";

const esc = escHtml;

function voucherHtml(v: GiftVoucher, shopName: string, paper: string): string {
  const narrow = paper === "58mm";
  const bodyWidth = narrow ? "48mm" : "72mm";
  const value = Number(v.initial_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Gift voucher ${esc(v.code)}</title>
<style>
  @page { size: ${paper} auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; width: ${bodyWidth}; margin: 0 auto; padding: 3mm 0; color: #000; background: #fff; text-align: center; }
  .card { border: 2px solid #000; border-radius: 6px; overflow: hidden; }
  .band { background: #000; color: #fff; padding: ${narrow ? "6px 4px" : "9px 6px"}; }
  .band .shop { font-size: ${narrow ? "10px" : "12px"}; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .band h1 { margin: 2px 0 0; font-size: ${narrow ? "16px" : "20px"}; font-weight: 900; letter-spacing: .28em; }
  .stars { font-size: 10px; letter-spacing: .5em; margin-top: 2px; }
  .inner { padding: ${narrow ? "8px 6px" : "10px 10px"}; }
  .for { font-size: ${narrow ? "11px" : "12px"}; text-transform: uppercase; letter-spacing: .1em; }
  .for b { display: block; font-size: ${narrow ? "14px" : "16px"}; letter-spacing: 0; text-transform: none; margin-top: 1px; }
  .amt { margin: 8px 0 4px; padding: 6px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .amt small { display: block; font-size: 10px; font-weight: 700; letter-spacing: .25em; }
  .amt span { font-size: ${narrow ? "24px" : "32px"}; font-weight: 900; line-height: 1.1; }
  .msg { font-style: italic; font-size: ${narrow ? "11px" : "13px"}; margin: 8px 2px; }
  .bc { margin: 8px 0 2px; }
  .bc svg { width: 100%; height: ${narrow ? "14mm" : "16mm"}; display: block; }
  .code { font-family: Consolas, "Courier New", monospace; font-size: ${narrow ? "14px" : "17px"}; font-weight: 700; letter-spacing: .15em; }
  .meta { display: flex; justify-content: space-between; gap: 6px; font-size: ${narrow ? "10px" : "11px"}; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; text-align: left; }
  .meta b { display: block; font-size: ${narrow ? "11px" : "12px"}; }
  .terms { font-size: ${narrow ? "9px" : "10px"}; line-height: 1.35; margin-top: 6px; }
  .cut { margin-top: 4mm; font-size: 9px; letter-spacing: .3em; }
</style></head><body>
<div class="card">
  <div class="band">
    ${shopName ? `<div class="shop">${esc(shopName)}</div>` : ""}
    <h1>GIFT VOUCHER</h1>
    <div class="stars">&#9733; &#9733; &#9733;</div>
  </div>
  <div class="inner">
    ${v.recipient_name ? `<div class="for">Specially for<b>${esc(v.recipient_name)}</b></div>` : ""}
    <div class="amt"><small>VALUE</small><span>LKR ${esc(value)}</span></div>
    ${v.message ? `<div class="msg">&ldquo;${esc(v.message)}&rdquo;</div>` : ""}
    <div class="bc">${code128Svg(v.code)}</div>
    <div class="code">${esc(v.code)}</div>
    <div class="meta">
      <div>Issued<b>${esc(String(v.created_at ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10))}</b></div>
      <div style="text-align:right">Valid until<b>${v.expires_at ? esc(v.expires_at) : "No expiry"}</b></div>
    </div>
    <div class="terms">Present this voucher at the counter. Can be used in parts; the balance stays on the voucher. Not exchangeable for cash.</div>
  </div>
</div>
<div class="cut">- - - - - - - - - - - -</div>
</body></html>`;
}

/**
 * Prints a gift voucher on the POS receipt printer. Uses the silent print service with the
 * Receipt printer mapping (and its paper width) when Settings → Printers is in Silent mode;
 * falls back to the browser print dialog otherwise or if the service is not reachable.
 */
export function printGiftVoucher(v: GiftVoucher, shopName = "") {
  return printOnReceiptPrinter(paper => voucherHtml(v, shopName, paper), `Gift voucher ${v.code}`);
}

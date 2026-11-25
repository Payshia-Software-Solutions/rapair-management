import { getPrinterSettings, silentPrint } from "@/lib/api/silent-print";

export const escHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Code 128 bar/space widths for values 0-105; 106 is the stop pattern.
const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
  "232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 " +
  "313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 " +
  "111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 " +
  "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112"
).split(" ");

/** Code 128 (set B) barcode as an inline SVG. Characters outside ASCII 32-126 are dropped. */
export function code128Svg(text: string, height = 56, color = "#000"): string {
  const vals = [...text].map(c => c.charCodeAt(0) - 32).filter(v => v >= 0 && v <= 94);
  const check = vals.reduce((sum, v, i) => sum + v * (i + 1), 104) % 103;
  const seq = [104, ...vals, check, 106];
  const quiet = 10;
  let x = quiet;
  let bars = "";
  for (const v of seq) {
    [...C128[v]].forEach((w, i) => {
      const n = Number(w);
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${n}" height="${height}"/>`;
      x += n;
    });
  }
  const width = x + quiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="${color}">${bars}</svg>`;
}

/** Browser print dialog from a hidden iframe (a popup opened after an await would be blocked). */
export function browserPrint(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  // Wait for images (logos) so they are on the page when it prints; give up after 3 s
  const imgs = Array.from(doc.images).filter(i => !i.complete);
  const loaded = Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; })));
  Promise.race([loaded, new Promise(r => setTimeout(r, 3000))]).then(() => {
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    }, 150);
  });
}

/** Image URL as a data: URL, so it prints without a network fetch; the URL itself if that fails. */
export async function toDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(url);
      r.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Prints HTML on the POS receipt printer. `build` gets the paper width of the Receipt printer
 * mapping. Silent print service in Silent mode; browser dialog otherwise or if the service fails.
 */
export async function printOnReceiptPrinter(build: (paper: "80mm" | "58mm") => string, docName: string) {
  const settings = await getPrinterSettings();
  const paper = settings.byType.Receipt?.paper_width === "58mm" ? "58mm" : "80mm";
  const html = build(paper);
  if (settings.mode === "Silent") {
    const res = await silentPrint(html, "Receipt", paper, docName);
    if (res.success) return;
  }
  browserPrint(html);
}

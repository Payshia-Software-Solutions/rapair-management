/**
 * Barcode encoders that return bar/space module widths (first entry is a bar).
 * - Code 128 with automatic B/C switching and FNC1 (needed for GS1-128).
 * - EAN-13.
 * - GS1 helpers: check digit, GTIN-14, element strings with Application Identifiers.
 */

// Code 128 symbol patterns, values 0..106 (106 = stop, 7 widths).
const P128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

/** Marks an FNC1 in a Code 128 input string (GS1 separator). */
export const FNC1 = "ñ";

const isDigit = (s: string, i: number) => i < s.length && s[i] >= "0" && s[i] <= "9";
const digitRun = (s: string, i: number) => { let n = 0; while (isDigit(s, i + n)) n++; return n; };

/** Code 128 module widths, or null when the text has characters Code 128 set B cannot carry. */
export function encodeCode128(input: string): number[] | null {
  const s = input;
  if (!s) return null;
  const codes: number[] = [];
  let set: "B" | "C" | null = null;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === FNC1) {
      if (set === null) { set = digitRun(s, i + 1) >= 2 ? "C" : "B"; codes.push(set === "C" ? 105 : 104); }
      codes.push(102);
      i++;
      continue;
    }
    const n = digitRun(s, i);
    if (set === "C") {
      if (n >= 2) { codes.push(Number(s.substr(i, 2))); i += 2; continue; }
      codes.push(100); set = "B"; // back to B
      continue;
    }
    // Long even digit runs are packed two per symbol in set C (odd runs: one digit in B first).
    if (n >= 4 && n % 2 === 0) { codes.push(set === null ? 105 : 99); set = "C"; continue; }
    if (set === null) { codes.push(104); set = "B"; }
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 95) return null;
    codes.push(v);
    i++;
  }
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103, 106);
  return codes.flatMap((c) => P128[c].split("").map(Number));
}

/** GS1 mod-10 check digit for the given digits (without the check digit). */
export function gs1CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** A valid GTIN-8/12/13/14 padded to 14 digits, or null. */
export function toGtin14(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim();
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return null;
  if (gs1CheckDigit(c.slice(0, -1)) !== Number(c.slice(-1))) return null;
  return c.padStart(14, "0");
}

const L = ["3211", "2221", "2122", "1411", "1132", "1231", "1114", "1312", "1213", "3112"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** EAN-13 from 12 digits (check digit added) or 13 digits (check digit verified). */
export function encodeEan13(code: string): { widths: number[]; digits: string } | null {
  let c = String(code ?? "").trim();
  if (!/^\d{12,13}$/.test(c)) return null;
  const check = gs1CheckDigit(c.slice(0, 12));
  if (c.length === 12) c += String(check);
  else if (Number(c[12]) !== check) return null;
  const w: number[] = [1, 1, 1];
  const parity = PARITY[Number(c[0])];
  for (let i = 1; i <= 6; i++) {
    const pat = L[Number(c[i])].split("").map(Number);
    w.push(...(parity[i - 1] === "L" ? pat : [...pat].reverse()));
  }
  w.push(1, 1, 1, 1, 1);
  for (let i = 7; i <= 12; i++) w.push(...L[Number(c[i])].split("").map(Number));
  w.push(1, 1, 1);
  return { widths: w, digits: c };
}

export interface Gs1Fields {
  gtin?: string | null;   // AI 01 (14 digits)
  productId?: string;     // AI 240, used when there is no GTIN
  mfg?: string | null;    // AI 11, YYYY-MM-DD
  exp?: string | null;    // AI 17, YYYY-MM-DD
  batch?: string | null;  // AI 10
  price?: number | null;  // AI 3922 (2 decimals)
}

const yymmdd = (d?: string | null) => {
  const m = String(d ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1].slice(2)}${m[2]}${m[3]}` : null;
};
const gs1Text = (s: string, max: number) => s.replace(/[^\x21-\x7E]/g, "").slice(0, max);

/**
 * GS1 element string. `data` is the Code 128 input (FNC1 first, FNC1 after variable-length fields),
 * `hri` the human-readable form with the AIs in brackets.
 */
export function buildGs1(f: Gs1Fields): { data: string; hri: string } | null {
  const fixed: Array<[string, string]> = [];
  const variable: Array<[string, string]> = [];
  if (f.gtin) fixed.push(["01", f.gtin]);
  const mfg = yymmdd(f.mfg); if (mfg) fixed.push(["11", mfg]);
  const exp = yymmdd(f.exp); if (exp) fixed.push(["17", exp]);
  if (!f.gtin && f.productId) { const v = gs1Text(f.productId, 30); if (v) variable.push(["240", v]); }
  if (f.price != null && f.price > 0) variable.push(["3922", String(Math.round(f.price * 100)).slice(0, 15)]);
  if (f.batch) { const v = gs1Text(f.batch, 20); if (v) variable.push(["10", v]); }
  const all = [...fixed, ...variable];
  if (all.length === 0) return null;
  let data = FNC1;
  all.forEach(([ai, v], idx) => {
    data += ai + v;
    const isVariable = idx >= fixed.length;
    if (isVariable && idx < all.length - 1) data += FNC1;
  });
  return { data, hri: all.map(([ai, v]) => `(${ai})${v}`).join("") };
}

/** SVG for module widths. Stretches to its box; all bars scale together, so it stays scannable. */
export function barsSvg(widths: number[], quiet = 10): string {
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet;
  let rects = "";
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="100"/>`;
    x += w;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block" shape-rendering="crispEdges"><g fill="#000">${rects}</g></svg>`;
}

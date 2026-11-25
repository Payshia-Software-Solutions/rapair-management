"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";

/**
 * One layout for every printed document (A4 / A5). Thermal POS receipts keep their own layout.
 *
 *   <PrintDocument title="Goods Received Note" number="GRN-0012" meta={[["Date", "24 Nov 2026"], ["Supplier", "ABC"]]}
 *                  ready={!loading} signatures={["Received by", "Checked by", "Approved by"]}>
 *     ...tables...
 *   </PrintDocument>
 *
 * It provides: the screen toolbar (Close / Print, hidden on paper), the letterhead (logo, company
 * name, address, phone, email, tax number) with the document title and number, the document
 * details, page size and margins, one typographic theme for the body, signature lines and a
 * footer. The print dialog opens by itself once `ready` is true (unless autoPrint is false or the
 * URL has autoprint=0).
 *
 * Body helpers below (PrintTable, PrintTotals, PrintSection, PrintNotes) keep tables consistent.
 */

export type PrintSize = "A4" | "A4-landscape" | "A5" | "A5-landscape";

const PAGE: Record<PrintSize, { css: string; width: string; minHeight: string }> = {
  "A4": { css: "A4 portrait", width: "210mm", minHeight: "297mm" },
  "A4-landscape": { css: "A4 landscape", width: "297mm", minHeight: "210mm" },
  "A5": { css: "A5 portrait", width: "148mm", minHeight: "210mm" },
  "A5-landscape": { css: "A5 landscape", width: "210mm", minHeight: "148mm" },
};

export function useCompany(given?: CompanyRow | null) {
  const [company, setCompany] = useState<CompanyRow | null>(given ?? null);
  useEffect(() => {
    if (given !== undefined) { setCompany(given); return; }
    fetchCompany().then(c => setCompany(c && c.name ? c : null)).catch(() => setCompany(null));
  }, [given]);
  return company;
}

export function PrintDocument({
  title, number, meta = [], ready = true, loading = false, error, size = "A4", company: companyProp,
  signatures = ["Prepared by", "Checked by", "Approved by"], autoPrint = true, footerNote, toolbarExtra, branch, children,
}: {
  /** Branch details that replace the company address / phone / tax number in the letterhead */
  branch?: { name?: string | null; address?: string | null; phone?: string | null; tax_no?: string | null };
  /** Document name, e.g. "Purchase Order" */
  title: string;
  /** Document number shown under the title */
  number?: React.ReactNode;
  /** Label / value pairs shown in the details block (two columns) */
  meta?: [string, React.ReactNode][];
  ready?: boolean;
  loading?: boolean;
  error?: string | null;
  size?: PrintSize;
  /** Pass when the page already loaded the company; otherwise it is fetched */
  company?: CompanyRow | null;
  /** Signature boxes at the bottom; false for none */
  signatures?: string[] | false;
  autoPrint?: boolean;
  /** Small text above the footer line (terms, notes) */
  footerNote?: React.ReactNode;
  /** Extra buttons in the screen toolbar */
  toolbarExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const company = useCompany(companyProp);
  const printed = useRef(false);
  const [logoOk, setLogoOk] = useState(true);
  const page = PAGE[size];

  useEffect(() => {
    if (!autoPrint || printed.current || loading || !ready || error) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoprint") === "0") return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [autoPrint, loading, ready, error]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Tab title (and saved-PDF file name) = "<document number> - <document type> - BizzFlow ERP".
    const num = typeof number === "string" || typeof number === "number" ? String(number).trim() : "";
    const t = [num, title, "BizzFlow ERP"].filter(Boolean).join(" - ");
    const apply = () => { if (document.title !== t) document.title = t; };
    apply();
    // Next.js re-applies the root metadata title after mount/hydration; keep ours in place.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title, number]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 text-sm">Preparing {title.toLowerCase()}…</p>
        </div>
      </div>
    );
  }

  const taxNumber = branch?.tax_no || company?.tax_no;
  const taxNo = taxNumber ? `${company?.tax_label || "Tax No"}: ${taxNumber}` : "";
  const address = branch?.address || company?.address;
  const phone = branch?.phone || company?.phone;

  return (
    <div className="pd-root min-h-screen bg-slate-100 print:bg-white text-slate-900">
      {/* Screen toolbar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 print:hidden px-4 py-2.5">
        <div className="mx-auto flex items-center justify-between gap-3" style={{ maxWidth: page.width }}>
          <span className="text-sm font-semibold truncate">Print preview · {title}{typeof number === "string" ? ` ${number}` : ""}</span>
          <div className="flex gap-2 shrink-0">
            {toolbarExtra}
            <Button variant="ghost" size="sm" onClick={() => window.close()}><X className="w-4 h-4 mr-1.5" /> Close</Button>
            <Button size="sm" onClick={() => window.print()} disabled={!!error}><Printer className="w-4 h-4 mr-1.5" /> Print</Button>
          </div>
        </div>
      </div>

      <div className="py-6 print:py-0 overflow-x-auto">
        <div className="pd mx-auto bg-white shadow-xl print:shadow-none px-[14mm] py-[12mm] print:p-0 flex flex-col"
          style={{ width: page.width, minHeight: page.minHeight }}>
          {/* Letterhead */}
          <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-3">
            <div className="flex items-start gap-3 min-w-0">
              {company?.logo_filename && logoOk && (
                <img src={contentUrl("company", company.logo_filename)} alt="" className="w-14 h-14 object-contain shrink-0" onError={() => setLogoOk(false)} />
              )}
              <div className="min-w-0">
                <div className="text-[15px] font-bold uppercase leading-tight">{company?.name || ""}</div>
                {branch?.name && <div className="text-[10.5px] font-semibold leading-snug">{branch.name}</div>}
                {address && <div className="text-[10.5px] text-slate-600 leading-snug whitespace-pre-line">{address}</div>}
                <div className="text-[10.5px] text-slate-600 leading-snug">{[phone, company?.email].filter(Boolean).join(" · ")}</div>
                {taxNo && <div className="text-[10.5px] text-slate-600 leading-snug">{taxNo}</div>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[18px] font-bold uppercase tracking-tight leading-tight">{title}</div>
              {number && <div className="text-[13px] font-semibold tabular-nums">{number}</div>}
            </div>
          </header>

          {/* Details */}
          {meta.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4 text-[11.5px]">
              {meta.map(([k, v], i) => (
                <div key={i} className="flex gap-3 min-w-0">
                  <dt className="w-[30mm] shrink-0 text-slate-500">{k}</dt>
                  <dd className="font-medium min-w-0 break-words">{v ?? "–"}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Body */}
          <main className="mt-5 flex-1 text-[11.5px]">
            {error ? <p className="text-sm text-red-600">{error}</p> : children}
          </main>

          {/* Sign-off and footer */}
          {signatures && signatures.length > 0 && !error && (
            <div className="pd-keep mt-14 grid gap-10 text-[10.5px] text-center" style={{ gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))` }}>
              {signatures.map(s => <div key={s}><div className="border-t border-slate-500 pt-1.5 text-slate-600">{s}</div></div>)}
            </div>
          )}
          {footerNote && <div className="mt-6 text-[10px] text-slate-600">{footerNote}</div>}
          <footer className="mt-6 pt-2 border-t border-slate-200 text-[9px] text-slate-400 flex justify-between">
            <span>Printed {new Date().toLocaleString("en-GB")}</span>
            <span>{company?.name}</span>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        /* One theme for every document body: no italics, no extra-heavy weights, normal letter spacing */
        .pd, .pd * { font-style: normal !important; }
        .pd .font-black, .pd .font-extrabold { font-weight: 700 !important; }
        .pd [class*="tracking-"] { letter-spacing: 0.01em !important; }
        .pd table { border-collapse: collapse; }
        @media print {
          @page { size: ${page.css}; margin: 12mm 14mm; }
          html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pd { width: auto !important; min-height: 0 !important; }
          .pd thead { display: table-header-group; }
          .pd tr, .pd-keep { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

/* ---------- body helpers ---------- */

export const fmtMoney = (v: any, dash = true) => {
  const n = Number(v || 0);
  if (dash && Math.abs(n) < 0.005) return "–";
  const s = Math.abs(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};

export type PrintColumn = { key: string; label: React.ReactNode; align?: "left" | "right" | "center"; width?: string };

/** Standard line-items table: ruled header, light row lines, right-aligned numbers. */
export function PrintTable({ columns, rows, empty = "No lines." }: {
  columns: PrintColumn[];
  rows: Record<string, React.ReactNode>[];
  empty?: string;
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-y-2 border-slate-900">
          {columns.map(c => (
            <th key={c.key} className={`py-1.5 px-1.5 font-semibold text-[10.5px] uppercase ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="py-4 text-center text-slate-500">{empty}</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200 align-top">
            {columns.map(c => (
              <td key={c.key} className={`py-1.5 px-1.5 ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""}`}>{r[c.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Right-hand totals block; the last line with `grand` gets the double underline. */
export function PrintTotals({ lines }: { lines: { label: React.ReactNode; value: React.ReactNode; grand?: boolean; muted?: boolean }[] }) {
  return (
    <div className="pd-keep mt-3 ml-auto w-[80mm] max-w-full text-[11.5px]">
      {lines.map((l, i) => (
        <div key={i} className={`flex justify-between gap-4 py-1 ${l.grand ? "font-bold border-t border-slate-900 border-b-[3px] border-double mt-1" : ""} ${l.muted ? "text-slate-500" : ""}`}>
          <span>{l.label}</span><span className="tabular-nums">{l.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PrintSection({ title, children, className = "" }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-5 ${className}`}>
      <h3 className="text-[10.5px] font-semibold uppercase border-b border-slate-300 pb-1 mb-2">{title}</h3>
      {children}
    </section>
  );
}

export function PrintNotes({ label = "Notes", children }: { label?: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="pd-keep mt-4 text-[11px]">
      <div className="font-semibold">{label}</div>
      <div className="text-slate-700 whitespace-pre-line">{children}</div>
    </div>
  );
}

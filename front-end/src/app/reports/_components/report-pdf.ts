import type { CompanyRow } from "@/lib/api";
import { contentUrl } from "@/lib/api";

export type PdfPaper = "a4" | "a3" | "letter" | "legal";
export type PdfOrientation = "auto" | "portrait" | "landscape";

/**
 * Builds a real PDF from what's on screen: the shared report header on every page,
 * every <table> in the report body (screen-only bits like buttons removed), and
 * "Page X of Y" in the footer. Text stays selectable; long tables split across pages.
 */
export async function downloadReportPdf(opts: {
  body: HTMLElement;
  company: CompanyRow | null;
  title: string;
  subtitle?: string;
  metaText?: string;
  filename?: string;
  /** Paper size; default A4. */
  format?: PdfPaper;
  /** "auto" picks landscape for wide tables. */
  orientation?: PdfOrientation;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const tables = Array.from(opts.body.querySelectorAll("table"));
  // Real column count: widest row, counting colspans (group header rows have few cells).
  const maxCols = Math.max(0, ...tables.flatMap((t) => Array.from(t.rows).map((r) =>
    Array.from(r.cells).reduce((n, c) => n + (c.colSpan || 1), 0))));
  const orientation = !opts.orientation || opts.orientation === "auto" ? (maxCols > 6 ? "landscape" : "portrait") : opts.orientation;
  const doc = new jsPDF({ orientation, unit: "mm", format: opts.format || "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  // Smaller text when many columns must share a narrow page, so words don't break mid-way.
  const mmPerCol = (pageW - 24) / Math.max(1, maxCols);
  const fontSize = mmPerCol >= 22 ? 8 : mmPerCol >= 17 ? 7 : mmPerCol >= 13 ? 6.2 : 5.5;
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;

  const logo = opts.company?.logo_filename ? await toDataUrl(contentUrl("company", opts.company.logo_filename)) : null;
  const generated = new Date().toLocaleString();
  const companyLines = [
    opts.company?.address,
    [opts.company?.phone, opts.company?.email].filter(Boolean).join(" · "),
    opts.company?.tax_no ? `${opts.company.tax_label || "Tax no."}: ${opts.company.tax_no}` : "",
  ].filter(Boolean) as string[];
  const metaLines = (opts.metaText || "").split("\n").map((s) => s.trim()).filter(Boolean);

  /** Draws the header and returns the Y where content may start. */
  const drawHeader = () => {
    let x = M;
    if (logo) {
      try { doc.addImage(logo, M, M, 14, 14); x = M + 17; } catch { /* unsupported image */ }
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(opts.company?.name || "", x, M + 4);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 116, 139);
    companyLines.forEach((l, i) => doc.text(l, x, M + 8.5 + i * 3.6));

    doc.setTextColor(15, 23, 42).setFont("helvetica", "bold").setFontSize(14);
    doc.text(opts.title, pageW - M, M + 5, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 116, 139);
    let ry = M + 9.5;
    if (opts.subtitle) {
      doc.splitTextToSize(opts.subtitle, pageW / 2).forEach((l: string) => { doc.text(l, pageW - M, ry, { align: "right" }); ry += 3.6; });
    }
    doc.text(`Generated ${generated}`, pageW - M, ry, { align: "right" });

    let y = Math.max(M + 17, M + 8.5 + companyLines.length * 3.6, ry + 2);
    doc.setDrawColor(30, 41, 59).setLineWidth(0.4).line(M, y, pageW - M, y);
    y += 4;
    if (metaLines.length) {
      doc.setFontSize(8.5).setTextColor(51, 65, 85);
      metaLines.forEach((l) => { doc.text(l, M, y); y += 4; });
      y += 1;
    }
    return y;
  };

  const headerBottom = drawHeader();
  let y = headerBottom;

  if (!tables.length) {
    doc.setFontSize(10).setTextColor(100, 116, 139).text("This report has no table data for the selected filters.", M, y + 4);
  }

  tables.forEach((table, i) => {
    const clean = table.cloneNode(true) as HTMLTableElement;
    clean.querySelectorAll("button, svg, [data-pdf-hide], .print\\:hidden").forEach((el) => el.remove());
    const heading = sectionTitle(table);
    if (heading && tables.length > 1) {
      if (y > pageH - 30) { doc.addPage(); y = drawHeader(); }
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(15, 23, 42).text(heading, M, y + 3);
      y += 6;
    }
    autoTable(doc, {
      html: clean,
      startY: y,
      margin: { left: M, right: M, top: headerBottom, bottom: 14 },
      theme: "grid",
      styles: { font: "helvetica", fontSize, cellPadding: fontSize < 7 ? 1.1 : 1.6, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (d) => {
        // Keep right-aligned (numeric) columns right-aligned in the PDF.
        const el = d.cell.raw as HTMLElement | undefined;
        if (el && typeof el.className === "string" && /text-right/.test(el.className)) d.cell.styles.halign = "right";
        // Total rows styled like the screen (bold, shaded).
        const tr = el?.parentElement;
        if (tr && /bg-muted|font-bold|font-semibold/.test(tr.className || "")) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [241, 245, 249]; }
      },
      willDrawPage: (d) => { if (d.pageNumber > 1) drawHeader(); },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + (i < tables.length - 1 ? 8 : 0);
  });

  // Footer: page numbers once the total is known.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(148, 163, 184);
    doc.text(opts.company?.name || "", M, pageH - 6);
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 6, { align: "right" });
  }

  const safe = (opts.filename || opts.title).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "report";
  doc.save(`${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Title of the card / section a table sits in, if there is one. */
function sectionTitle(table: HTMLTableElement): string {
  const card = table.closest("[data-report-section], .rounded-xl, .rounded-lg, section");
  const h = card?.querySelector("h2, h3, [data-report-title], .font-semibold");
  const t = (h?.textContent || "").trim();
  return t.length && t.length < 80 ? t : "";
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/image\/(png|jpe?g)/.test(blob.type)) return null; // jsPDF handles PNG/JPEG reliably
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

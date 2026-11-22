"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReportHeader, useCompany } from "./report-header";
import type { PdfPaper, PdfOrientation } from "./report-pdf";

const PAPERS: { value: PdfPaper; label: string; css: string }[] = [
  { value: "a4", label: "A4", css: "A4" },
  { value: "a3", label: "A3", css: "A3" },
  { value: "letter", label: "Letter", css: "letter" },
  { value: "legal", label: "Legal", css: "legal" },
];
const ORIENTS: { value: PdfOrientation; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
];

/**
 * Frame for every report.
 * - Web view: toolbar (Back, page actions, Print, Download PDF) above a report "page"
 *   that carries the shared report header, so the screen matches the PDF.
 * - ?print=1 (&autoprint=1): clean print view with the same header.
 * Pages pass `printHref` (their print URL with current filters) and keep their own
 * extra actions (e.g. Excel) in `actions`.
 */
export function ReportShell({
  title,
  subtitle,
  actions,
  printMeta,
  printHref,
  filename,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  printMeta?: React.ReactNode;
  printHref?: string;
  filename?: string;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const auto = searchParams?.get("autoprint") === "1";
  const { company, loaded } = useCompany();
  const [generatedAt] = React.useState(() => new Date());
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const metaRef = React.useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!isPrint || !auto || !loaded) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [isPrint, auto, loaded]);

  // Paper choice, remembered per browser.
  const [paper, setPaperState] = React.useState<PdfPaper>("a4");
  const [orient, setOrientState] = React.useState<PdfOrientation>("auto");
  React.useEffect(() => {
    try {
      const p = localStorage.getItem("report.paper") as PdfPaper | null;
      const o = localStorage.getItem("report.orientation") as PdfOrientation | null;
      if (p && PAPERS.some(x => x.value === p)) setPaperState(p);
      if (o && ORIENTS.some(x => x.value === o)) setOrientState(o);
    } catch { /* storage blocked */ }
  }, []);
  const setPaper = (v: PdfPaper) => { setPaperState(v); try { localStorage.setItem("report.paper", v); } catch {} };
  const setOrient = (v: PdfOrientation) => { setOrientState(v); try { localStorage.setItem("report.orientation", v); } catch {} };

  const downloadPdf = async () => {
    if (!bodyRef.current) return;
    setPdfBusy(true);
    try {
      const { downloadReportPdf } = await import("./report-pdf");
      await downloadReportPdf({
        body: bodyRef.current,
        company,
        title,
        subtitle,
        metaText: metaRef.current?.innerText,
        filename,
        format: paper,
        orientation: orient,
      });
    } catch (e: any) {
      toast({ title: "Couldn't create the PDF", description: e?.message, variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const print = () => {
    if (printHref) {
      const sep = printHref.includes("?") ? "&" : "?";
      window.open(printHref.includes("autoprint=") ? printHref : `${printHref}${sep}autoprint=1`, "_blank", "noopener");
    } else {
      window.print();
    }
  };

  const paperPicker = (
    <div className="flex items-center gap-1 rounded-md border bg-background px-1" title="Paper size and orientation for PDF / print">
      <select aria-label="Paper size" className="h-9 bg-transparent px-1 text-sm outline-none" value={paper} onChange={(e) => setPaper(e.target.value as PdfPaper)}>
        {PAPERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <span className="text-muted-foreground">·</span>
      <select aria-label="Orientation" className="h-9 bg-transparent px-1 text-sm outline-none" value={orient} onChange={(e) => setOrient(e.target.value as PdfOrientation)}>
        {ORIENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const header = (
    <ReportHeader company={company} title={title} subtitle={subtitle} generatedAt={generatedAt}
      meta={printMeta ? <div ref={metaRef}>{printMeta}</div> : undefined} />
  );

  if (isPrint) {
    return (
      <>
        <style jsx global>{`
          @media print {
            @page { size: ${PAPERS.find(p => p.value === paper)?.css || "A4"} ${orient === "portrait" ? "portrait" : "landscape"}; margin: 12mm; }
            html, body { background: #fff !important; color: #0f172a !important; }
            .print\\:hidden { display: none !important; }
            .report-body table { width: 100% !important; border-collapse: collapse !important; font-size: 9.5pt !important; }
            .report-body thead th {
              background: #1e293b !important; color: #fff !important; font-weight: 600 !important;
              padding: 6px 8px !important; border: 1px solid #334155 !important;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .report-body tbody td { padding: 5px 8px !important; border-bottom: 1px solid #e2e8f0 !important; color: #334155 !important; }
            .report-body tbody tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .report-body .text-right { text-align: right !important; font-variant-numeric: tabular-nums; }
            .report-body thead { display: table-header-group; }
            .report-body tr { break-inside: avoid; }
          }
        `}</style>

        <div className="print:hidden sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
            <p className="font-medium">{title}</p>
            <div className="flex gap-2">
              {paperPicker}
              <Button variant="outline" onClick={() => void downloadPdf()} disabled={pdfBusy}>
                {pdfBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Download PDF
              </Button>
              <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
            </div>
          </div>
        </div>

        <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
          <div className="mx-auto max-w-6xl bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
            {header}
            <div ref={bodyRef} className="report-body mt-5">{children}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <DashboardLayout title={title}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground">
            <Link href="/reports"><ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> All reports</Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {actions}
            {paperPicker}
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print</Button>
            <Button onClick={() => void downloadPdf()} disabled={pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4 mr-2" aria-hidden="true" />}
              Download PDF
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          {header}
          <div ref={bodyRef} className="report-body mt-5 space-y-5">{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}

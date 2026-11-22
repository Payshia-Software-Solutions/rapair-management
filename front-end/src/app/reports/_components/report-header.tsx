"use client";

import React from "react";
import { contentUrl, type CompanyRow } from "@/lib/api";

/**
 * The one report header: company (logo, name, address, phone, tax no.) on the left,
 * report title, subtitle and generated time on the right, then the filter summary.
 * Used by the on-screen report, the print view and (as data) the PDF download.
 */
export function ReportHeader({
  company, title, subtitle, meta, generatedAt,
}: {
  company: CompanyRow | null;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  generatedAt: Date;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between print:flex-row print:border-slate-800">
        <div className="flex min-w-0 items-start gap-3">
          {company?.logo_filename ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contentUrl("company", company.logo_filename)} alt="" className="h-12 w-12 shrink-0 rounded object-contain" />
          ) : null}
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{company?.name || " "}</p>
            {company?.address ? <p className="text-muted-foreground print:text-slate-600">{company.address}</p> : null}
            <p className="text-muted-foreground print:text-slate-600">
              {[company?.phone, company?.email].filter(Boolean).join(" · ")}
            </p>
            {company?.tax_no ? <p className="text-muted-foreground print:text-slate-600">{company.tax_label || "Tax no."}: {company.tax_no}</p> : null}
          </div>
        </div>
        <div className="sm:text-right print:text-right">
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground print:text-slate-600">{subtitle}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums print:text-slate-500">Generated {generatedAt.toLocaleString()}</p>
        </div>
      </div>
      {meta ? (
        <div data-report-meta className="rounded-md border bg-muted/30 px-3 py-2 text-sm print:border-slate-300 print:bg-slate-50">{meta}</div>
      ) : null}
    </header>
  );
}

/** Company details, loaded once per page view. */
export function useCompany() {
  const [company, setCompany] = React.useState<CompanyRow | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    import("@/lib/api")
      .then(({ fetchCompany }) => fetchCompany())
      .then((c) => { if (live) setCompany(c); })
      .catch(() => {})
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  return { company, loaded };
}

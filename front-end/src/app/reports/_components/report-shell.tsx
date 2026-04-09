"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function ReportShell({
  title,
  subtitle,
  actions,
  printMeta,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  printMeta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const auto = searchParams?.get("autoprint") === "1";

  React.useEffect(() => {
    if (!isPrint) return;
    if (!auto) return;
    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [isPrint, auto]);

  if (isPrint) {
    return (
      <>
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            html,
            body {
              background: #fff !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        <div className="print:hidden sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="font-semibold">{title}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => window.print()}>Print / Save as PDF</Button>
            </div>
          </div>
        </div>

        <div className="bg-muted/20 min-h-screen py-6 print:bg-white print:py-0">
          <div className="mx-auto max-w-5xl px-4">
            <div className="bg-white border shadow-sm rounded-md p-6 print:border-0 print:shadow-none print:rounded-none">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-2xl font-bold leading-tight">{title}</div>
                  {subtitle ? <div className="text-sm text-muted-foreground mt-1">{subtitle}</div> : null}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Printed: {new Date().toLocaleString()}</div>
                </div>
              </div>
              {printMeta ? <div className="mt-4 text-sm text-muted-foreground">{printMeta}</div> : null}
              <div className="mt-4">{children}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/reports">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-muted-foreground mt-1">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </DashboardLayout>
  );
}

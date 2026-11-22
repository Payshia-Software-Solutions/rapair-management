"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-shell";
import { REPORT_GROUPS } from "@/lib/reports-catalog";
import { moduleAllowed, useSaasModules } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  return <Suspense fallback={null}><ReportsHub /></Suspense>;
}

function ReportsHub() {
  const modules = useSaasModules();
  const [q, setQ] = useState("");
  // /reports?group=sales (from the sidebar) opens that group.
  const router = useRouter();
  const group = useSearchParams().get("group");

  const groups = useMemo(() => REPORT_GROUPS.filter((g) => moduleAllowed(modules, g.module)), [modules]);
  const term = q.trim().toLowerCase();
  const shown = groups
    .filter((g) => !group || g.id === group)
    .map((g) => ({ ...g, items: g.items.filter((r) => !term || `${r.title} ${r.desc}`.toLowerCase().includes(term)) }))
    .filter((g) => g.items.length);

  const pick = (id: string | null) => router.replace(id ? `/reports?group=${id}` : "/reports", { scroll: false });

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-5">
        <PageHeader title="Reports" description="View any report on screen, print it, or download it as PDF. Every report uses the same company header." />

        <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input className="h-9 pl-9" placeholder="Find a report…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a report" />
          </div>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Report group">
            <Button size="sm" variant={!group ? "secondary" : "ghost"} role="tab" aria-selected={!group} onClick={() => pick(null)}>All</Button>
            {groups.map((g) => (
              <Button key={g.id} size="sm" variant={group === g.id ? "secondary" : "ghost"} role="tab" aria-selected={group === g.id} onClick={() => pick(g.id)}>
                <g.icon className="h-4 w-4 mr-1.5" aria-hidden="true" /> {g.label}
              </Button>
            ))}
          </div>
        </Card>

        {!modules ? <Card><LoadingState /></Card> : shown.length === 0 ? (
          <Card><EmptyState title="No reports match" description="Try a different search or group." /></Card>
        ) : (
          shown.map((g) => (
            <section key={g.id} className="space-y-2" aria-labelledby={`rg-${g.id}`}>
              <h2 id={`rg-${g.id}`} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <g.icon className="h-4 w-4" aria-hidden="true" /> {g.label}
                <span className="font-normal">· {g.items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((r) => (
                  <Link key={r.href} href={r.href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className={cn("flex h-full items-start gap-3 p-4 transition-colors group-hover:bg-muted/40")}>
                      <div className="rounded-md bg-muted p-2 text-muted-foreground"><r.icon className="h-4 w-4" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight">{r.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{r.desc}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}

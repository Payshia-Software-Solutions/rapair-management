"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, Loader2, Percent, Receipt, Save, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { runTaxChain, round2 } from "@/lib/pricing/pos-totals";

type Tax = { id: number; code: string; name: string; rate_percent: number | string; apply_on: string; sort_order?: number | string };

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | string) => `${Number(n || 0).toFixed(2)}%`;

/**
 * Applicable taxes with their calculation order, and a live receipt preview that uses the
 * same tax chain as the POS (`runTaxChain`). Service charge is set per location; the rate
 * here is only for the preview.
 */
export function TaxSetupCard({ loading, saving, allTaxes, enabledTaxIds, onToggle, onSave }: {
  loading: boolean;
  saving: boolean;
  allTaxes: Tax[];
  enabledTaxIds: number[];
  onToggle: (id: number) => void;
  onSave: () => void;
}) {
  const [sample, setSample] = useState("4800");
  const [scRate, setScRate] = useState("10");

  const ordered = useMemo(
    () => [...allTaxes].sort((a, b) => (Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100)) || String(a.code).localeCompare(String(b.code))),
    [allTaxes],
  );
  const enabled = ordered.filter(t => enabledTaxIds.includes(t.id));

  const preview = useMemo(() => {
    const base = Math.max(0, Number(sample) || 0);
    const lines = runTaxChain(base, enabled as any, true);
    const sc = round2(base * ((Number(scRate) || 0) / 100));
    const taxTotal = round2(lines.reduce((s, l) => s + l.amount, 0));
    const total = round2(base + taxTotal + sc);
    return { base, lines, sc, taxTotal, total, effective: base > 0 ? (taxTotal / base) * 100 : 0 };
  }, [sample, scRate, enabled]);

  // A tax "on subtotal + taxes above" placed first has nothing above it
  const firstCompound = enabled.length > 0 && enabled[0].apply_on === "base_plus_previous";

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg">Taxes &amp; calculation</CardTitle>
            </div>
            <CardDescription>Choose the taxes on your bills. They are worked out top to bottom, in this order.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/master-data/taxes"><Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Edit tax rates</Link>
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />} Save taxes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg" />)}</div>
        ) : (
          <div className="grid lg:grid-cols-5">
            {/* Tax chain */}
            <div className="lg:col-span-3 p-6 space-y-2 lg:border-r">
              {ordered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No active taxes in master data. Add them under Edit tax rates.</p>
              )}
              {ordered.map((t) => {
                const on = enabledTaxIds.includes(t.id);
                const step = enabled.findIndex(e => e.id === t.id);
                const compound = t.apply_on === "base_plus_previous";
                return (
                  <div key={t.id}>
                    <label
                      className={cn(
                        "flex items-center gap-4 rounded-xl border p-3 cursor-pointer transition-colors",
                        on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}>
                        {on ? step + 1 : "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{t.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="font-mono">{pct(t.rate_percent)}</Badge>
                          <Badge variant="outline" className={cn("font-normal", compound && "border-amber-400 text-amber-700 dark:text-amber-300")}>
                            {compound ? "On subtotal + taxes above" : "On subtotal"}
                          </Badge>
                        </span>
                      </span>
                      <span className="text-right tabular-nums text-sm hidden sm:block">
                        {on && <span className="font-semibold">LKR {money(preview.lines[step]?.amount ?? 0)}</span>}
                      </span>
                      <Switch checked={on} onCheckedChange={() => onToggle(t.id)} aria-label={`Apply ${t.name}`} />
                    </label>
                    {on && step < enabled.length - 1 && (
                      <div className="flex justify-center py-0.5 text-muted-foreground"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></div>
                    )}
                  </div>
                );
              })}
              {firstCompound && (
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {enabled[0].name} is first, so there are no taxes above it; it works the same as "On subtotal". Change the order in Edit tax rates.
                </p>
              )}
            </div>

            {/* Receipt preview */}
            <div className="lg:col-span-2 p-6 bg-muted/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Receipt className="h-4 w-4" aria-hidden="true" /> Bill preview</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tx-sample" className="text-xs">Sample subtotal (LKR)</Label>
                  <Input id="tx-sample" type="number" min={0} value={sample} onChange={e => setSample(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tx-sc" className="text-xs">Service charge %</Label>
                  <Input id="tx-sc" type="number" min={0} max={100} value={scRate} onChange={e => setScRate(e.target.value)} className="h-9" />
                </div>
              </div>

              <div className="mx-auto max-w-sm rounded-md bg-white p-5 font-mono text-[13px] text-black shadow-sm ring-1 ring-black/10">
                <Row label="Subtotal" value={preview.base} />
                {preview.lines.map((l, i) => (
                  <Row key={i} label={`${l.code || l.name} (${pct(l.rate_percent)})`} value={l.amount} />
                ))}
                {Number(scRate) > 0 && <Row label={`SC (${pct(scRate)})`} value={preview.sc} />}
                <div className="my-2 border-t-2 border-black" />
                <Row label="TOTAL" value={preview.total} bold />
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-background p-2.5">
                  <dt className="text-muted-foreground">Total tax</dt>
                  <dd className="font-semibold tabular-nums">LKR {money(preview.taxTotal)}</dd>
                </div>
                <div className="rounded-md border bg-background p-2.5">
                  <dt className="text-muted-foreground">Effective tax rate</dt>
                  <dd className="font-semibold tabular-nums">{preview.effective.toFixed(2)}%</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Service charge is set per location and is worked out on the subtotal. Locations with their own tax list use that list instead of this one.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-0.5", bold && "font-bold text-[15px]")}>
      <span>{label}</span>
      <span className="tabular-nums">LKR {money(value)}</span>
    </div>
  );
}

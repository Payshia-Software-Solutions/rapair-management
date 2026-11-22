"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSystemSettings, updateSystemSettings } from "@/lib/api";
import {
  DASHBOARDS,
  DEFAULT_DASHBOARD,
  HOME_DASHBOARD_SETTING,
  loadSaasModules,
  moduleAllowed,
  type DashboardKey,
} from "@/lib/dashboards";

/** Company-wide choice of the dashboard everyone opens after login. */
export function HomeDashboardCard() {
  const { toast } = useToast();
  const [modules, setModules] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<DashboardKey>(DEFAULT_DASHBOARD);
  const [value, setValue] = useState<DashboardKey>(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [s, m] = await Promise.all([fetchSystemSettings().catch(() => ({} as Record<string, string>)), loadSaasModules()]);
        setModules(m);
        const k = (s?.[HOME_DASHBOARD_SETTING] as DashboardKey) || DEFAULT_DASHBOARD;
        const valid = DASHBOARDS.some((d) => d.key === k) ? k : DEFAULT_DASHBOARD;
        setSaved(valid);
        setValue(valid);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const options = DASHBOARDS.filter((d) => moduleAllowed(modules, d.module));

  const save = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({ [HOME_DASHBOARD_SETTING]: value });
      setSaved(value);
      toast({ title: "Home dashboard saved", description: "Applies the next time someone signs in." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message || "Only administrators can change this.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Home dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Where everyone lands after signing in. Steward / order-taking accounts still open the POS.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div role="radiogroup" aria-label="Home dashboard" className="grid gap-2">
          {options.map((d) => {
            const on = value === d.key;
            return (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setValue(d.key)}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                )}
              >
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                  {on && <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{d.label}</span>
                  <span className="block text-xs text-muted-foreground">{d.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Button onClick={save} disabled={loading || saving || value === saved} className="w-full">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
        Save home dashboard
      </Button>
    </Card>
  );
}

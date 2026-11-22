"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Tablet } from "lucide-react";
import type { KotRoute } from "@/lib/api/printqueue";

/**
 * How this terminal prints kitchen tickets. Same per-terminal setting as the POS ⋮ menu
 * ("Kitchen ticket route"). Only the settings for the chosen method are shown below it.
 */
export function KitchenTicketModeCard({ mode, onChange }: { mode: KotRoute; onChange: (m: KotRoute) => void }) {
  const options: Array<{ id: KotRoute; title: string; desc: string; icon: React.ReactNode }> = [
    { id: "local", title: "Direct from this terminal", desc: "Printers are connected to this POS PC. BizzFlow Printer runs here.", icon: <Monitor className="w-5 h-5" aria-hidden="true" /> },
    { id: "queue", title: "Through a kitchen PC", desc: "Tablets / other terminals send tickets to a kitchen PC that prints them.", icon: <Tablet className="w-5 h-5" aria-hidden="true" /> },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kitchen ticket printing</CardTitle>
        <CardDescription>Applies to this device. Steward tablets always print through a kitchen PC.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Kitchen ticket printing" className="grid sm:grid-cols-2 xl:grid-cols-1 gap-3">
          {options.map(o => {
            const on = mode === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(o.id)}
                className={`text-left rounded-lg border p-4 flex gap-3 transition-colors ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
              >
                <span className={`mt-0.5 ${on ? "text-primary" : "text-muted-foreground"}`}>{o.icon}</span>
                <span>
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

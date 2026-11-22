"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import type { AiStep } from "@/lib/api/intelligence";
import { cn } from "@/lib/utils";

/**
 * Live progress for a Business Intelligence question: each server step as it happens,
 * the plan the model wrote (in plain words), and an elapsed-time counter.
 */
export function AiProgress({ steps, compact = false }: { steps: AiStep[]; compact?: boolean }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - started) / 1000));

  const plan = steps.find((s): s is Extract<AiStep, { stage: "plan" }> => s.stage === "plan");
  const lines = steps
    .filter((s) => s.stage !== "plan")
    .map((s) => s.stage === "found" ? { key: "found", text: `Found ${s.rows} record${s.rows === 1 ? "" : "s"}`, retry: false }
      : { key: s.stage, text: s.text, retry: s.stage === "retry" });
  if (!lines.length) lines.push({ key: "start", text: "Sending your question", retry: false });

  return (
    <div className={cn("space-y-2 text-sm", compact && "text-xs")} role="status" aria-live="polite">
      <ol className="space-y-1.5">
        {lines.map((l, i) => {
          const active = i === lines.length - 1;
          return (
            <li key={`${l.key}-${i}`} className={cn("flex items-start gap-2", active ? "text-foreground" : "text-muted-foreground")}>
              <span className="mt-0.5 shrink-0">
                {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : l.retry ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  : <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
              </span>
              <span>{l.text}{active ? "…" : ""}</span>
            </li>
          );
        })}
      </ol>

      {plan && plan.steps.length > 0 && (
        <div className="rounded-md border bg-background/60 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Plan</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
            {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">{secs}s</p>
    </div>
  );
}

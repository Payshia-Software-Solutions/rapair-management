"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, RotateCcw, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  cancelPrintJob, fetchLocalPrintJobs, fetchPrintStations, fetchQueueJobs, retryPrintJob,
  type LocalPrintJob, type PrintStation, type QueueJob,
} from "@/lib/api/printqueue";
import { usePOS } from "../../context/POSContext";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Waiting",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  queued:    { label: "Waiting",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  printing:  { label: "Printing",  cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  done:      { label: "Printed",   cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  failed:    { label: "Failed",    cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};
const Pill = ({ s }: { s: string }) => {
  const x = STATUS[s] || { label: s, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${x.cls}`}>{x.label}</span>;
};
const time = (v: string | number | null) => {
  if (!v) return "";
  const d = typeof v === "number" ? new Date(v) : new Date(String(v).replace(" ", "T"));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * POS print queue: kitchen tickets on the server queue for this location (KOT/BOT sent to the
 * kitchen PC, with retry / cancel), and the jobs of the BizzFlow Printer app on this terminal.
 */
export function PrintQueueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { canCheckout, selectedLocation } = usePOS();
  // Print stations of this location (Kitchen KOT, Bar BOT ...) to filter kitchen tickets by
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [station, setStation] = useState("");
  useEffect(() => {
    if (!open || !selectedLocation) return;
    fetchPrintStations(Number(selectedLocation)).then(s => setStations(s.filter(x => Number(x.is_active)))).catch(() => setStations([]));
  }, [open, selectedLocation]);
  const [tab, setTab] = useState<"kitchen" | "local">("kitchen");
  const [filter, setFilter] = useState<"all" | "open" | "failed">("all");
  const [jobs, setJobs] = useState<QueueJob[] | null>(null);
  const [local, setLocal] = useState<{ jobs: LocalPrintJob[]; running: boolean; supported: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [q, l] = await Promise.all([
      fetchQueueJobs(filter, station).catch(() => [] as QueueJob[]),
      fetchLocalPrintJobs(),
    ]);
    setJobs(q); setLocal(l);
  }, [filter, station]);

  useEffect(() => {
    if (!open) return;
    void load();
    const t = setInterval(load, 5000); // live while open
    return () => clearInterval(t);
  }, [open, load]);

  const act = async (id: number, kind: "retry" | "cancel") => {
    setBusy(id);
    try {
      if (kind === "retry") await retryPrintJob(id); else await cancelPrintJob(id);
      toast({ title: kind === "retry" ? "Sent again" : "Ticket cancelled" });
      await load();
    } catch (e: any) {
      toast({ title: kind === "retry" ? "Couldn't retry" : "Couldn't cancel", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const failedCount = (jobs || []).filter(j => j.status === "failed").length;
  const waitingCount = (jobs || []).filter(j => j.status === "pending" || j.status === "printing").length;
  const localOpen = (local?.jobs || []).filter(j => j.status === "queued" || j.status === "printing").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0 gap-0 flex flex-col overflow-hidden sm:h-[min(760px,calc(100dvh-2rem))]">
        <div className="pl-5 pr-14 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>Print queue</DialogTitle>
          <DialogDescription className="mt-0.5">Kitchen tickets and this terminal&rsquo;s prints, last 24 hours. Updates every few seconds.</DialogDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="tablist" className="inline-flex rounded-md bg-muted p-1">
              {([
                ["kitchen", `Kitchen PC queue${failedCount ? ` · ${failedCount} failed` : waitingCount ? ` · ${waitingCount} waiting` : ""}`],
                ["local", `Printed on this PC${localOpen ? ` · ${localOpen} printing` : ""}`],
              ] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
                  className={`h-8 px-3 rounded-sm text-sm font-medium ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "kitchen" && (
              <select value={filter} onChange={e => setFilter(e.target.value as any)} aria-label="Show"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="all">All</option>
                <option value="open">Waiting / printing</option>
                <option value="failed">Failed</option>
              </select>
            )}
            <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={() => void load()}>
              <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" /> Refresh
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {tab === "kitchen"
              ? "KOT / BOT tickets sent to the server for the kitchen PC to print (from tablets and terminals set to “Through a kitchen PC”)."
              : "Everything the BizzFlow Printer app on this PC printed: bills, receipts and tickets printed directly from here."}
          </p>
          {tab === "kitchen" && stations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by station">
              {[{ id: "", label: "All stations" }, ...stations.map(s => ({ id: String(s.id), label: `${s.ticket_label} · ${s.name}` }))].map(o => (
                <button key={o.id || "all"} type="button" onClick={() => setStation(o.id)} aria-pressed={station === o.id}
                  className={`h-7 px-2.5 rounded-full border text-xs font-medium ${station === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "kitchen" ? (
            jobs === null ? (
              <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : jobs.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No kitchen tickets sent through the kitchen PC in the last 24 hours.</div>
            ) : (
              <ul className="divide-y">
                {jobs.map(j => (
                  <li key={j.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{j.title}</span>
                        <Pill s={j.status} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Sent {time(j.created_at)}{j.created_by_name ? ` by ${j.created_by_name}` : ""}
                        {j.device_name ? ` · ${j.device_name}` : ""}
                        {j.done_at && j.status === "done" ? ` · printed ${time(j.done_at)}` : ""}
                        {j.attempts > 1 ? ` · ${j.attempts} tries` : ""}
                      </div>
                      {j.error && j.status !== "cancelled" && (
                        <div className="mt-0.5 text-xs text-destructive flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />{j.error}</div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {j.status === "failed" && (
                        <Button size="sm" variant="outline" className="h-8" disabled={busy === j.id} onClick={() => act(j.id, "retry")}>
                          {busy === j.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" />} Retry
                        </Button>
                      )}
                      {canCheckout && (j.status === "pending" || j.status === "failed") && (
                        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled={busy === j.id}
                          aria-label={`Cancel ${j.title}`} title="Cancel this ticket (it won't print)"
                          onClick={() => { if (window.confirm(`Cancel ${j.title}? It won't print.`)) void act(j.id, "cancel"); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : local === null ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : !local.running ? (
            <div className="p-6 text-sm text-muted-foreground">BizzFlow Printer isn&rsquo;t running on this terminal, so prints open in the browser. Start it from the Start menu.</div>
          ) : !local.supported ? (
            <div className="p-6 text-sm text-muted-foreground">BizzFlow Printer is running but is an older version. Install the latest version to see its jobs here.</div>
          ) : local.jobs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nothing printed on this terminal since the printer app started.</div>
          ) : (
            <ul className="divide-y">
              {local.jobs.map(j => (
                <li key={j.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{j.title}</span>
                      <Pill s={j.status} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {time(j.createdAt)} · {j.printer || "Windows default"} · {j.width}
                      {j.source === "queue" ? " · from kitchen queue" : ""}
                      {j.durationMs ? ` · ${(j.durationMs / 1000).toFixed(1)}s` : ""}
                    </div>
                    {j.error && <div className="mt-0.5 text-xs text-destructive">{j.error}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

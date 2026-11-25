"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Database, Download, Loader2, Plus, ShieldCheck, CloudOff, Cloud } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard, StatCard, EmptyState, theadClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api/client";

type Backup = { name: string; size: number; created_at: string };
type Info = { backups: Backup[]; keep: number; offsite: boolean; last: string | null };

const mb = (b: number) => (b / 1048576).toFixed(b < 1048576 ? 2 : 1) + " MB";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "success") throw new Error(data?.message || "Request failed");
  return data.data as T;
}

export default function BackupsPage() {
  const { toast } = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setInfo(await call<Info>("/api/backup/list")); }
    catch (e: any) { toast({ title: "Could not load backups", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const backupNow = async () => {
    setBusy(true);
    try {
      const r = await call<{ name: string; size: number; tables: number; rows: number }>("/api/backup/create", { method: "POST", body: "{}" });
      toast({ title: "Backup created", description: `${r.tables} tables, ${r.rows.toLocaleString()} rows, ${mb(r.size)}` });
      void load();
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const download = async (name: string) => {
    setDownloading(name);
    try {
      const res = await api(`/api/backup/download?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Download failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  return (
    <DashboardLayout title="Backups">
      <div className="space-y-6">
        <PageHeader
          title="Database Backups"
          description="Full copies of this company's data. A backup runs every night; you can also make one now and download it."
          actions={<Button onClick={backupNow} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Back up now</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Last backup" value={info?.last || "None yet"} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard label="Copies kept" value={info ? `${info.backups.length} of ${info.keep}` : "–"} hint="Older ones are removed" icon={<Database className="h-4 w-4" />} />
          <StatCard label="Off-site copy" value={info?.offsite ? "On" : "Off"} hint={info?.offsite ? "Each backup is also sent to the backup server" : "Ask your provider to set one up"} icon={info?.offsite ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />} />
        </div>

        <SectionCard title="Backups on the server" description="Keep a downloaded copy somewhere safe. To restore, contact your system administrator: restoring replaces all current data.">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !info || info.backups.length === 0 ? (
            <EmptyState title="No backups yet" description="Make the first one now with Back up now." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">File</th>
                    <th className="px-4 py-2 font-medium text-right">Size</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {info.backups.map(b => (
                    <tr key={b.name} className="border-t">
                      <td className="px-4 py-2.5 tabular-nums">{b.created_at}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{b.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{mb(b.size)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="outline" size="sm" onClick={() => download(b.name)} disabled={downloading === b.name}>
                          {downloading === b.name ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />} Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

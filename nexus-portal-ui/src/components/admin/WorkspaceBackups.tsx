"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Loader2, RefreshCw, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { adminApi, errMsg } from '@/lib/adminApi';

type Backup = { name: string; size: number; created_at?: string };
type List = { slug: string; backups: Backup[]; keep: number };
type Result = { restored: string; statements: number; safety_backup: { name: string; size: number } };

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer transition-colors';
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Backups of the workspace database (kept on the workspace server) and restoring one.
 * A restore replaces the current data, so the admin must type the workspace ID; the server backs up
 * the current data first, so a restore can itself be undone by restoring that safety backup.
 */
export default function WorkspaceBackups({ tenantId, refreshKey }: { tenantId: string | number; refreshKey?: number }) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setList(await adminApi<List>(`/admin/tenants/backups?id=${tenantId}`)); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [tenantId]);

  // Load after the render (not inside the effect body), and again when a database update made a new backup
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  const slug = list?.slug ?? '';

  const restore = async () => {
    if (!picked) return;
    setRestoring(true); setError(null); setResult(null);
    try {
      setResult(await adminApi<Result>('/admin/tenants/restore', { id: tenantId, backup: picked, confirm: typed.trim() }));
      setPicked(null); setTyped('');
      void load();
    } catch (e) { setError(errMsg(e)); }
    finally { setRestoring(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <Archive size={14} aria-hidden="true" /> Backups
        </span>
        <button type="button" onClick={() => void load()} disabled={loading || restoring} aria-label="Refresh backups"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer">
          {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
        </button>
      </div>

      <div className="space-y-4 p-4 text-xs text-slate-700 dark:text-slate-300">
        {error && (
          <p role="alert" className="flex items-start gap-2 text-nx-danger">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{error}</span>
          </p>
        )}

        {result && (
          <p className="flex items-start gap-2 font-semibold text-nx-success [overflow-wrap:anywhere]">
            <CheckCircle2 size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            Restored {result.restored} ({result.statements} statements). The data from before the restore was saved as {result.safety_backup.name}.
          </p>
        )}

        {list && list.backups.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">No backups yet. One is taken before every database update.</p>
        )}

        {list && list.backups.length > 0 && (
          <>
            <p className="text-slate-500 dark:text-slate-400">Newest first. The latest {list.keep} are kept.</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {list.backups.map(b => (
                <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] font-semibold text-slate-900 dark:text-white [overflow-wrap:anywhere]">{b.created_at}</span>
                    <span className="text-slate-500 dark:text-slate-400">{size(b.size)} · {b.name}</span>
                  </span>
                  <button type="button" onClick={() => { setPicked(picked === b.name ? null : b.name); setTyped(''); setResult(null); }} disabled={restoring}
                    className={`${btn} border border-nx-danger/40 text-nx-danger hover:bg-nx-danger-soft`}>
                    <RotateCcw size={13} aria-hidden="true" /> Restore…
                  </button>
                  {picked === b.name && (
                    <div className="w-full space-y-2 rounded-lg border border-nx-danger/30 bg-nx-danger-soft p-3">
                      <p className="font-semibold text-nx-danger">
                        This replaces all current data in this workspace with the backup from {b.created_at}. Anything entered after that is lost
                        (a backup of the current data is taken first, so you can undo this).
                      </p>
                      <label className="block space-y-1">
                        <span>Type the workspace ID <code className="font-mono font-bold">{slug}</code> to confirm:</span>
                        <input value={typed} onChange={e => setTyped(e.target.value)} disabled={restoring} autoComplete="off"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[12px] dark:border-slate-700 dark:bg-slate-900" />
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void restore()} disabled={restoring || !slug || typed.trim() !== slug}
                          className={`${btn} bg-nx-danger text-white hover:opacity-90`}>
                          {restoring ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}
                          {restoring ? 'Backing up and restoring…' : 'Restore this backup'}
                        </button>
                        <button type="button" onClick={() => setPicked(null)} disabled={restoring}
                          className={`${btn} border border-slate-200 text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200`}>Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

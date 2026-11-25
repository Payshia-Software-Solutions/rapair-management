"use client";

import React, { useEffect, useState } from 'react';
import { Layers, Loader2, AlertTriangle, CheckCircle2, Archive, Search } from 'lucide-react';
import { adminApi, errMsg } from '@/lib/adminApi';

type Backup = { name: string; size: number; created_at?: string; tables?: number; rows?: number; offsite?: string | null };
type Diff = {
  missing_tables: string[];
  missing_columns: { table: string; column: string; definition: string }[];
  missing_indexes: { table: string; index: string; columns: string[]; unique: boolean }[];
  fingerprint: string;
  last_backup: Backup | null;
};
type Result = { backup: Backup | null; applied: string[]; errors: string[]; remaining: number };

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer transition-colors';
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Brings one workspace's database up to the current ERP schema. The admin reviews the exact changes first;
 * the workspace server takes a full backup before applying them and refuses if the list changed meanwhile.
 * Only adds tables, columns and indexes. Nothing is dropped or altered.
 */
export default function WorkspaceSchema({ tenantId, onBackup }: { tenantId: string | number; onBackup?: () => void }) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'update' | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const check = async () => {
    setBusy('check'); setError(null); setResult(null); setConfirmed(false);
    try { setDiff(await adminApi<Diff>(`/admin/tenants/schema-diff?id=${tenantId}`)); }
    catch (e) { setError(errMsg(e)); setDiff(null); }
    finally { setBusy(null); }
  };

  // Check in the background as soon as the tenant page opens (read-only; nothing changes until "Back up and update")
  useEffect(() => {
    const t = setTimeout(() => void check(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const update = async () => {
    if (!diff) return;
    setBusy('update'); setError(null);
    try {
      setResult(await adminApi<Result>('/admin/tenants/schema-update', { id: tenantId, fingerprint: diff.fingerprint }));
      setDiff(null);
      onBackup?.();
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); setConfirmed(false); }
  };

  const total = diff ? diff.missing_tables.length + diff.missing_columns.length + diff.missing_indexes.length : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <Layers size={14} aria-hidden="true" /> Database updates
        </span>
        <button type="button" onClick={() => void check()} disabled={busy !== null}
          className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}>
          {busy === 'check' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Search size={13} aria-hidden="true" />}
          Check for updates
        </button>
      </div>

      <div className="space-y-4 p-4 text-xs text-slate-700 dark:text-slate-300">
        {!diff && !result && !error && (
          <p className="text-slate-500 dark:text-slate-400">
            {busy === 'check'
              ? 'Checking this workspace for missing tables and columns…'
              : 'Checks for new tables and columns this workspace is missing. You review them before anything changes.'}
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-nx-danger">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{error}</span>
          </p>
        )}

        {diff && total === 0 && (
          <p className="flex items-center gap-2 font-semibold text-nx-success">
            <CheckCircle2 size={14} aria-hidden="true" /> Up to date. Nothing to change.
          </p>
        )}

        {diff && total > 0 && (
          <>
            <p className="font-semibold text-slate-900 dark:text-white">{total} change{total === 1 ? '' : 's'} to apply (additions only):</p>
            <div className="max-h-72 space-y-3 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-[12px] dark:bg-slate-800/60">
              {diff.missing_tables.length > 0 && (
                <div>
                  <p className="mb-1 font-sans font-bold text-slate-600 dark:text-slate-400">New tables ({diff.missing_tables.length})</p>
                  <ul className="space-y-0.5">{diff.missing_tables.map(t => <li key={t}>+ {t}</li>)}</ul>
                </div>
              )}
              {diff.missing_columns.length > 0 && (
                <div>
                  <p className="mb-1 font-sans font-bold text-slate-600 dark:text-slate-400">New columns ({diff.missing_columns.length})</p>
                  <ul className="space-y-0.5">
                    {diff.missing_columns.map(c => <li key={`${c.table}.${c.column}`} className="[overflow-wrap:anywhere]">+ {c.table}.{c.column} <span className="text-slate-500">{c.definition}</span></li>)}
                  </ul>
                </div>
              )}
              {diff.missing_indexes.length > 0 && (
                <div>
                  <p className="mb-1 font-sans font-bold text-slate-600 dark:text-slate-400">New indexes ({diff.missing_indexes.length})</p>
                  <ul className="space-y-0.5">
                    {diff.missing_indexes.map(i => <li key={`${i.table}.${i.index}`}>+ {i.table}.{i.index} ({i.columns.join(', ')}){i.unique ? ' unique' : ''}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <p className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
              <Archive size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                A full backup of this database is taken first. If the backup fails, nothing is changed.
                {diff.last_backup && <> Last backup: {diff.last_backup.name} ({size(diff.last_backup.size)}, {diff.last_backup.created_at}).</>}
              </span>
            </p>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy !== null} className="mt-0.5" />
              <span>I reviewed these changes and want to apply them to this workspace.</span>
            </label>

            <button type="button" onClick={() => void update()} disabled={!confirmed || busy !== null}
              className={`${btn} bg-nx-accent text-white hover:opacity-90`}>
              {busy === 'update' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
              {busy === 'update' ? 'Backing up and updating…' : 'Back up and update'}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-2">
            <p className={`flex items-center gap-2 font-semibold ${result.errors.length || result.remaining ? 'text-nx-warning' : 'text-nx-success'}`}>
              {result.errors.length || result.remaining ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
              {result.backup
                ? `Applied ${result.applied.length} change${result.applied.length === 1 ? '' : 's'}${result.remaining ? `, ${result.remaining} still missing` : ''}.`
                : 'Nothing needed changing.'}
            </p>
            {result.backup && (
              <p className="text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere]">
                Backup saved on the workspace server: {result.backup.name} ({size(result.backup.size)}, {result.backup.tables} tables, {result.backup.rows} rows)
                {result.backup.offsite && result.backup.offsite.startsWith('failed') ? `. Off-site copy ${result.backup.offsite}` : result.backup.offsite ? '. Off-site copy saved.' : '.'}
              </p>
            )}
            {result.errors.length > 0 && (
              <ul role="alert" className="space-y-0.5 font-mono text-[12px] text-nx-danger">
                {result.errors.map((e, i) => <li key={i} className="[overflow-wrap:anywhere]">{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

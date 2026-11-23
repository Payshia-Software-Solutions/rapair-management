"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { adminApi, errMsg } from '@/lib/adminApi';

type Info = {
  slug: string;
  status: string;
  db_host: string | null;
  db_name: string | null;
  db_user: string | null;
  has_password: boolean;
  plan_code: string | null;
  provision_step: string | null;
  last_error: string | null;
  domains: { domain: string; kind: string }[];
  created_at: string | null;
};

const label = 'block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider';
const value = 'font-mono text-[13px] font-semibold text-slate-900 dark:text-white [overflow-wrap:anywhere]';

/** Where the workspace's data lives, read live from the workspace server. The password is never shown. */
export default function WorkspaceDatabase({ tenantId }: { tenantId: string | number }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await adminApi<Info>(`/admin/tenants/workspace-info?id=${tenantId}`));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const field = (name: string, v: React.ReactNode) => (
    <div className="space-y-1.5">
      <span className={label}>{name}</span>
      <p className={value}>{v || '—'}</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <Database size={14} aria-hidden="true" /> Database
        </span>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh database details"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer">
          {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
        </button>
      </div>

      <div className="p-4">
        {error ? (
          <p role="alert" className="flex items-start gap-2 text-xs text-nx-danger">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="[overflow-wrap:anywhere]">{error}</span>
          </p>
        ) : !info ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading from the workspace server…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {field('Host', info.db_host)}
              {field('Database', info.db_name)}
              {field('User', info.db_user)}
              {field('Password', info.has_password ? 'Stored encrypted (not shown)' : 'Not set')}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {field('Status', info.status)}
              {field('Workspace ID', info.slug)}
              {field('Plan', info.plan_code)}
              {field('Created', info.created_at)}
            </div>
            {field('Domains', info.domains.length ? info.domains.map(d => `${d.domain} (${d.kind})`).join(', ') : null)}
            {info.last_error && info.status !== 'active' && (
              <p className="text-xs text-nx-danger [overflow-wrap:anywhere]">Last error: {info.last_error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

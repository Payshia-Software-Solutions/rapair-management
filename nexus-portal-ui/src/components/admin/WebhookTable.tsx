"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { adminApi, errMsg } from '@/lib/adminApi';

export type WebhookEvent = {
  id: number; event_type: string; status: 'pending' | 'sending' | 'sent' | 'failed'; attempts: number;
  next_attempt_at: string | null; last_http_code: number | null; last_error: string | null;
  sent_at: string | null; created_at: string; tenant_name: string | null; tenant_slug: string | null; product_name: string | null;
};

const LABELS: Record<string, string> = {
  'tenant.created': 'Create workspace',
  'subscription.plan_changed': 'Plan change',
  'subscription.suspended': 'Suspend',
  'subscription.resumed': 'Resume',
  'tenant.deleted': 'Delete',
  'domain.added': 'Add domain',
  'domain.removed': 'Remove domain',
};

const STATUS_CLS: Record<string, string> = {
  sent: 'bg-nx-success-soft text-nx-success dark:bg-nx-success dark:text-nx-success',
  pending: 'bg-nx-warning-soft text-nx-warning dark:bg-nx-warning dark:text-nx-warning',
  sending: 'bg-nx-info-soft text-nx-info dark:bg-nx-info dark:text-nx-info',
  failed: 'bg-nx-danger-soft text-nx-danger dark:bg-nx-danger dark:text-nx-danger',
};

/** Provisioning events sent to products (all, or one tenant's). Failed/pending ones can be retried. */
export default function WebhookTable({ tenantId, showTenant = true, refreshKey = 0 }: { tenantId?: number | string; showTenant?: boolean; refreshKey?: number }) {
  const [rows, setRows] = useState<WebhookEvent[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  // Load on mount, when the parent asks (refreshKey) and after a retry (tick)
  useEffect(() => {
    let alive = true;
    adminApi<WebhookEvent[]>(`/admin/webhooks${tenantId ? `?tenant_id=${tenantId}` : ''}`)
      .then(r => { if (alive) { setRows(r); setError(null); } })
      .catch((e: unknown) => { if (alive) { setError(errMsg(e)); setRows([]); } });
    return () => { alive = false; };
  }, [tenantId, refreshKey, tick]);

  const retry = async (id: number) => {
    setBusy(id);
    try { await adminApi('/admin/webhooks/retry', { id }); }
    catch (e: unknown) { setError(errMsg(e)); }
    finally { setBusy(null); setTick(x => x + 1); }
  };

  if (rows === null) return <div className="flex items-center gap-2 p-4 text-[13px] text-nx-text-subtle"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (error) return <p role="alert" className="p-4 text-[13px] text-nx-danger">{error}</p>;
  if (rows.length === 0) return <p className="p-4 text-[13px] text-nx-text-muted">Nothing sent yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-nx-line text-left text-[12px] text-nx-text-muted dark:border-nx-line-dark">
            <th className="px-4 py-2 font-medium">When</th>
            {showTenant && <th className="px-4 py-2 font-medium">Tenant</th>}
            <th className="px-4 py-2 font-medium">Event</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Detail</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-nx-line last:border-0 align-top dark:border-nx-line-dark">
              <td className="whitespace-nowrap px-4 py-2.5 text-nx-text-muted">{new Date(r.created_at.replace(' ', 'T')).toLocaleString()}</td>
              {showTenant && <td className="px-4 py-2.5">{r.tenant_name}<div className="text-[11px] text-nx-text-subtle">{r.product_name}</div></td>}
              <td className="px-4 py-2.5">{LABELS[r.event_type] || r.event_type}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLS[r.status] || ''}`}>{r.status}</span>
                {r.attempts > 1 && <span className="ml-1.5 text-[11px] text-nx-text-subtle">{r.attempts} tries</span>}
              </td>
              <td className="max-w-[320px] px-4 py-2.5 text-[12px] text-nx-text-muted">
                {r.status === 'sent' ? (r.sent_at ? `Delivered ${new Date(r.sent_at.replace(' ', 'T')).toLocaleTimeString()}` : 'Delivered')
                  : r.last_error ? <span className="break-words">{r.last_error}{r.status === 'pending' && r.next_attempt_at ? ` · retries ${new Date(r.next_attempt_at.replace(' ', 'T')).toLocaleTimeString()}` : ''}</span>
                  : r.status === 'pending' ? 'Waiting to send' : ''}
              </td>
              <td className="px-4 py-2.5 text-right">
                {(r.status === 'failed' || r.status === 'pending') && (
                  <button onClick={() => void retry(r.id)} disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-md border border-nx-line px-2 py-1 text-[12px] hover:bg-nx-surface-muted disabled:opacity-50 dark:border-nx-line-dark dark:hover:bg-nx-line-dark">
                    {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

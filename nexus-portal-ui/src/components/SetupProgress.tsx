"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

/**
 * Live workspace setup progress (client subscription page and Nexus admin).
 * Polls the progress endpoint every few seconds and shows the real step the workspace server is on.
 * `detail` (admin only) also shows the technical error text.
 */

type Progress = {
  provision_status: 'none' | 'pending' | 'ready' | 'failed' | string;
  provision_error: string | null;
  workspace_url: string | null;
  now: string;
  event: {
    status: 'pending' | 'sending' | 'sent' | 'failed' | string;
    attempts: number;
    last_error?: string | null;
    had_error?: boolean;
    next_attempt_at: string | null;
    created_at: string;
    sent_at: string | null;
  } | null;
  erp: { status: string | null; step: string | null; last_error?: string | null } | null;
  erp_error?: string | null;
};

const STEPS = [
  'Request received',
  'Creating your database',
  'Installing BizzFlow ERP',
  'Setting up modules',
  'Creating your admin login',
  'Connecting your address',
  'Ready to use',
];
// Steps the workspace server records, in order (see server/app/tenancy/Provisioner.php)
const ERP_STEPS = ['database', 'template', 'schema', 'seed', 'domain', 'active'];

/** MySQL "YYYY-MM-DD HH:MM:SS" (server time) -> ms. Only differences between two server times are used. */
const ms = (d: string | null | undefined) => (d ? new Date(d.replace(' ', 'T')).getTime() : NaN);

const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

function stepsDone(p: Progress): number {
  if (p.provision_status === 'ready') return STEPS.length;
  if (p.erp) {
    const i = p.erp.step ? ERP_STEPS.indexOf(p.erp.step) : -1;
    return Math.min(STEPS.length - 1, 1 + (i + 1));
  }
  const e = p.event;
  if (e && (e.status === 'sending' || e.status === 'sent' || e.attempts > 0)) return 1;
  return 0;
}

export default function SetupProgress({
  endpoint,
  detail = false,
  onFinished,
}: {
  endpoint: string;
  detail?: boolean;
  onFinished?: (status: string) => void;
}) {
  const [p, setP] = useState<Progress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const finishedRef = useRef<string | null>(null);
  // Callers may pass a new function each render; keep the latest without restarting the polling
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(endpoint);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== 'success') throw new Error(json.message || `Request failed (${res.status})`);
      setP(json.data);
      setFetchedAt(Date.now());
      setLoadError(null);
      const st = json.data.provision_status;
      if ((st === 'ready' || st === 'failed') && finishedRef.current !== st) {
        finishedRef.current = st;
        onFinishedRef.current?.(st);
      }
      if (st === 'pending') finishedRef.current = null;
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [endpoint]);

  // Poll while setup runs; one request at a time
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      await load();
      if (!stop) timer = setTimeout(run, 3000);
    };
    void run();
    return () => { stop = true; clearTimeout(timer); };
  }, [load]);

  // Re-render every second for the timers
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!p) {
    return (
      <p className="flex items-center gap-2 text-xs text-nx-text-subtle">
        {loadError ? <AlertCircle size={14} aria-hidden="true" /> : <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {loadError ? `Could not load the setup status: ${loadError}` : 'Checking setup status…'}
      </p>
    );
  }

  const done = stepsDone(p);
  const ready = p.provision_status === 'ready';
  const failed = p.provision_status === 'failed';
  const pct = ready ? 100 : Math.max(4, Math.round((done / STEPS.length) * 100));

  // Server-time arithmetic, advanced by the time since the last poll
  const serverNow = ms(p.now) + Math.max(0, clock - fetchedAt);
  const e = p.event;
  const elapsed = e ? (serverNow - ms(e.created_at)) / 1000 : NaN;
  const retrying = !ready && !failed && e?.status === 'pending' && e.attempts > 0 && (e.had_error || !!e.last_error);
  const retryIn = retrying && e?.next_attempt_at ? (ms(e.next_attempt_at) - serverNow) / 1000 : NaN;
  const waiting = !ready && !failed && e?.status === 'pending' && e.attempts === 0;

  const current = ready ? 'Your workspace is ready.'
    : failed ? 'Setup stopped.'
    : retrying ? 'Retrying setup…'
    : waiting ? 'Waiting to start…'
    : `${STEPS[done]}…`;

  const technical = detail ? [e?.last_error, p.erp?.last_error, p.erp_error, failed ? p.provision_error : null].filter(Boolean) as string[] : [];

  return (
    <div className="space-y-4">
      {/* Bar */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span aria-live="polite" className={`font-semibold ${failed ? 'text-nx-danger' : ready ? 'text-nx-success' : 'text-nx-ink dark:text-white'}`}>{current}</span>
          <span className="shrink-0 tabular-nums text-nx-text-subtle">
            {pct}%{!ready && !failed && Number.isFinite(elapsed) ? ` · ${fmtDuration(elapsed)}` : ''}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark"
          role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={`h-full rounded-full motion-safe:transition-all motion-safe:duration-700 ${failed ? 'bg-nx-danger' : ready ? 'bg-nx-success' : 'bg-nx-accent'} ${!ready && !failed ? 'motion-safe:animate-pulse' : ''}`}
            style={{ width: `${pct}%` }} />
        </div>
        {!ready && !failed && (
          <p className="mt-1.5 text-[11px] text-nx-text-subtle">This usually takes 1 to 3 minutes. You can leave this page; setup continues and the login is emailed to you.</p>
        )}
      </div>

      {/* Steps */}
      <ol className="space-y-2.5">
        {STEPS.map((label, i) => {
          const state = i < done ? 'done' : i === done && failed ? 'error' : i === done && !ready ? 'active' : 'todo';
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                state === 'done' ? 'bg-nx-success text-white'
                : state === 'error' ? 'bg-nx-danger text-white'
                : state === 'active' ? 'bg-nx-info-soft text-nx-info'
                : 'bg-nx-surface-muted text-nx-text-subtle dark:bg-nx-line-dark'}`}>
                {state === 'done' ? <Check size={13} aria-hidden="true" />
                  : state === 'error' ? <AlertCircle size={13} aria-hidden="true" />
                  : state === 'active' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={state === 'todo' ? 'text-nx-text-subtle' : 'font-medium text-nx-ink dark:text-white'}>{label}</span>
              <span className="sr-only">{state === 'done' ? '(done)' : state === 'active' ? '(in progress)' : state === 'error' ? '(failed)' : ''}</span>
            </li>
          );
        })}
      </ol>

      {retrying && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-nx-warning-soft p-3 text-xs text-nx-warning">
          <RefreshCw size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Attempt {e!.attempts} did not finish. Trying again automatically
            {Number.isFinite(retryIn) && retryIn > 0 ? ` in ${fmtDuration(retryIn)}` : ' now'}.
          </span>
        </p>
      )}

      {technical.length > 0 && (
        <div className="rounded-lg border border-nx-danger/30 bg-nx-danger-soft p-3 text-xs text-nx-danger">
          <p className="mb-1 font-semibold">Technical detail (admins only)</p>
          {technical.map((t, i) => <p key={i} className="[overflow-wrap:anywhere]">{t}</p>)}
        </div>
      )}
    </div>
  );
}

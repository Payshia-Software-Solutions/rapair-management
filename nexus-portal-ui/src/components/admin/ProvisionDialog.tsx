"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Mail, Rocket, X, Database, Send, Globe } from 'lucide-react';
import { adminApi, adminFetch, errMsg } from '@/lib/adminApi';

type Props = {
  open: boolean;
  tenantId: string | number;
  tenantName: string;
  adminEmail?: string | null;
  onClose: () => void;
  onFinished: (ok: boolean) => void;
};

type Status = {
  provision_status: string;
  workspace_url: string | null;
  provision_error: string | null;
  event: { status: 'pending' | 'sending' | 'sent' | 'failed'; attempts: number; last_error: string | null } | null;
};

type Phase = 'confirm' | 'running' | 'ready' | 'failed';

/** Steps tied to real server state. A step only completes when the server says so. */
const STEPS = [
  { label: 'Request queued', icon: Send },
  { label: 'Sent to the ERP server', icon: Globe },
  { label: 'Creating the database, admin user and login', icon: Database },
  { label: 'Workspace live and login emailed', icon: Mail },
];

/** Index of the step in progress, given the server state. 4 means everything is done. */
function activeStep(s: Status | null): number {
  if (!s) return 0;
  if (s.provision_status === 'ready') return 4;
  const ev = s.event?.status;
  if (ev === 'sent') return 3;
  if (ev === 'sending') return 2;
  if (ev === 'pending') return 1;
  return 0;
}

export default function ProvisionDialog({ open, tenantId, tenantName, adminEmail, onClose, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const pollRef = useRef<number | null>(null);
  const kickRef = useRef<number | null>(null);
  const statusRef = useRef<Status | null>(null);

  // Reset whenever the dialog opens
  useEffect(() => {
    if (open) { setPhase('confirm'); setStatus(null); setError(null); }
  }, [open]);

  // Escape closes, unless a provisioning run is in progress
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'running') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, onClose]);

  useEffect(() => { if (open) primaryRef.current?.focus(); }, [open, phase]);

  // Stop timers on unmount or close
  const stopTimers = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (kickRef.current) window.clearInterval(kickRef.current);
    pollRef.current = null;
    kickRef.current = null;
  };
  useEffect(() => stopTimers, []);
  useEffect(() => { if (!open) stopTimers(); }, [open]);

  const poll = async () => {
    try {
      const res = await adminFetch(`/admin/tenants/provision-status?id=${tenantId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'success') return;
      const s: Status = body.data;
      statusRef.current = s;
      setStatus(s);
      if (s.provision_status === 'ready') {
        setPhase('ready');
        stopTimers();
      } else if (s.event?.status === 'failed' || s.provision_status === 'failed') {
        setError(s.event?.last_error || s.provision_error || 'Setting up the workspace failed.');
        setPhase('failed');
        stopTimers();
      } else if (
        s.event?.status === 'pending' && (s.event.attempts ?? 0) > 0 && s.event.last_error &&
        !/^Waiting for an earlier event/.test(s.event.last_error)
      ) {
        // The send already failed and is only waiting for its automatic retry (minutes to hours away).
        // Show the error now instead of spinning; "Try again" replaces the waiting event.
        setError(`${s.event.last_error} (it will also retry automatically)`);
        setPhase('failed');
        stopTimers();
      }
    } catch {
      // Transient network error: keep polling
    }
  };

  // Ask the server to deliver the queued event. The call blocks while the ERP works, so it runs alongside polling.
  const kick = () => {
    adminApi('/admin/webhooks/run', {}).catch(() => { /* polling shows the real state */ });
  };

  const start = async () => {
    setError(null);
    setPhase('running');
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      await adminApi('/admin/tenants/provision', { id: Number(tenantId) });
    } catch (e) {
      setError(errMsg(e));
      setPhase('failed');
      return;
    }
    kick();
    let kicks = 0;
    kickRef.current = window.setInterval(() => {
      // Re-send while the event is still only queued (for example, the delivery worker was busy)
      if (kicks++ < 6 && activeStep(statusRef.current) <= 1) kick();
    }, 8000);
    pollRef.current = window.setInterval(() => { setNow(Date.now()); void poll(); }, 1500);
    void poll();
  };

  if (!open) return null;

  const step = activeStep(status);
  const done = phase === 'ready' ? STEPS.length : step;
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  // Within the active step, creep forward slowly so the bar moves. Never past the step boundary.
  const creep = phase === 'running' ? Math.min(22, elapsed * 0.8) : 0;
  const percent = phase === 'ready' ? 100 : Math.min(96, Math.round(done * 25 + (phase === 'running' && done < STEPS.length ? creep : 0)));

  const close = () => { if (phase !== 'running') onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-nx-ink/50 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="prov-title" aria-describedby="prov-desc"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-nx-line bg-white shadow-2xl dark:border-nx-line-dark dark:bg-nx-surface-dark">

        <div className="flex items-start justify-between gap-4 border-b border-nx-line px-6 py-5 dark:border-nx-line-dark">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-accent-soft text-nx-accent dark:bg-nx-accent/15 dark:text-nx-accent-light">
              <Rocket size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="prov-title" className="text-base font-semibold text-nx-ink dark:text-white">
                {phase === 'confirm' ? 'Create workspace' : phase === 'ready' ? 'Workspace is live' : phase === 'failed' ? 'Setup failed' : 'Creating workspace'}
              </h2>
              <p id="prov-desc" className="text-xs text-nx-text-muted dark:text-nx-text-subtle">{tenantName}</p>
            </div>
          </div>
          <button type="button" onClick={close} disabled={phase === 'running'} aria-label="Close"
            className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-ink disabled:opacity-40 dark:hover:bg-nx-line-dark dark:hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {phase === 'confirm' && (
            <>
              <p className="text-sm text-nx-text-muted dark:text-nx-text-subtle">This creates a new, empty workspace on the shared deployment:</p>
              <ul className="space-y-2 text-sm text-nx-ink dark:text-white">
                <li className="flex gap-2"><Database size={15} className="mt-0.5 shrink-0 text-nx-accent" /> A dedicated database for this tenant</li>
                <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-nx-accent" /> An administrator account with a generated password</li>
                <li className="flex gap-2"><Mail size={15} className="mt-0.5 shrink-0 text-nx-accent" /> A welcome email with the login to <span className="font-medium">{adminEmail || 'the admin email'}</span></li>
              </ul>
              <p className="rounded-lg bg-nx-surface-muted p-3 text-xs text-nx-text-muted dark:bg-nx-line-dark dark:text-nx-text-subtle">This can take up to a minute. You can keep this page open.</p>
            </>
          )}

          {(phase === 'running' || phase === 'ready' || phase === 'failed') && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-nx-ink dark:text-white" aria-live="polite">
                    {phase === 'ready' ? 'Done' : phase === 'failed' ? 'Stopped' : STEPS[Math.min(step, STEPS.length - 1)].label}
                  </span>
                  <span className="tabular-nums text-nx-text-muted dark:text-nx-text-subtle">{percent}%</span>
                </div>
                <div role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
                  className="h-2.5 overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark">
                  <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${phase === 'failed' ? 'bg-nx-danger' : phase === 'ready' ? 'bg-nx-success' : 'bg-nx-accent'}`}
                    style={{ width: `${percent}%` }} />
                </div>
              </div>

              <ol className="space-y-3">
                {STEPS.map((s, i) => {
                  const complete = i < done || phase === 'ready';
                  const current = phase === 'running' && i === done;
                  return (
                    <li key={s.label} className={`flex items-center gap-3 text-sm ${complete ? 'text-nx-ink dark:text-white' : current ? 'text-nx-accent dark:text-nx-accent-light' : 'text-nx-text-subtle'}`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-nx-success-soft text-nx-success' : current ? 'bg-nx-accent-soft text-nx-accent dark:bg-nx-accent/15' : 'bg-nx-surface-muted text-nx-text-subtle dark:bg-nx-line-dark'}`}>
                        {complete ? <CheckCircle2 size={14} /> : current ? <Loader2 size={13} className="animate-spin" /> : <s.icon size={12} />}
                      </span>
                      <span className={current ? 'font-medium' : ''}>{s.label}</span>
                    </li>
                  );
                })}
              </ol>

              {phase === 'failed' && error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-nx-danger/30 bg-nx-danger-soft p-3 text-xs text-nx-danger">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="[overflow-wrap:anywhere]">{error}</span>
                </p>
              )}
              {phase === 'ready' && status?.workspace_url && (
                <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle">
                  Workspace: <a href={status.workspace_url} target="_blank" rel="noreferrer" className="font-mono font-medium text-nx-accent hover:underline">{status.workspace_url.replace(/^https?:\/\//, '')}</a>
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-nx-line bg-nx-surface-soft px-6 py-4 dark:border-nx-line-dark dark:bg-nx-surface-dark-2">
          {phase === 'confirm' && (
            <>
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-nx-ink hover:bg-nx-surface-muted dark:text-white dark:hover:bg-nx-line-dark">Cancel</button>
              <button ref={primaryRef} type="button" onClick={() => void start()} className="flex items-center gap-2 rounded-lg bg-nx-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nx-accent">
                <Rocket size={14} aria-hidden="true" /> Create workspace
              </button>
            </>
          )}
          {phase === 'running' && (
            <span className="flex items-center gap-2 text-xs text-nx-text-muted dark:text-nx-text-subtle"><Loader2 size={13} className="animate-spin" /> Working…</span>
          )}
          {phase === 'ready' && (
            <button ref={primaryRef} type="button" onClick={() => onFinished(true)} className="rounded-lg bg-nx-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-nx-accent">Done</button>
          )}
          {phase === 'failed' && (
            <>
              <button type="button" onClick={() => onFinished(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-nx-ink hover:bg-nx-surface-muted dark:text-white dark:hover:bg-nx-line-dark">Close</button>
              <button ref={primaryRef} type="button" onClick={() => void start()} className="rounded-lg bg-nx-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-nx-accent">Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

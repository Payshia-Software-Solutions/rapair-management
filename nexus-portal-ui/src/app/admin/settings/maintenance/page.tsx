"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Power, Wrench } from 'lucide-react';
import { adminFetch, cardCls, inputCls } from '@/lib/adminApi';

type State = { on: boolean; message: string; custom_message: string; until: string | null };

/** One switch that closes every ERP workspace (all tenants) for maintenance. */
export default function MaintenancePage() {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (s: State) => {
    setState(s);
    setMessage(s.custom_message);
    setUntil(s.until ? s.until.replace(' ', 'T') : '');
  };

  useEffect(() => {
    adminFetch('/admin/settings/maintenance').then(r => r.json()).then(d => {
      if (d.status === 'success') apply(d.data);
      else setNote({ ok: false, text: d.message || 'Could not load the maintenance setting.' });
    }).catch(() => setNote({ ok: false, text: 'Could not load the maintenance setting.' }));
  }, []);

  const save = async (on: boolean) => {
    if (on && !state?.on && !confirm('Close ALL workspaces for maintenance? Every tenant sees the maintenance page within 30 seconds.')) return;
    setBusy(true); setNote(null);
    try {
      const res = await adminFetch('/admin/settings/maintenance/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on, message, until: until ? until.replace('T', ' ') : '' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== 'success') throw new Error(d.message || 'Saving failed.');
      apply(d.data);
      setNote({ ok: true, text: d.message });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Saving failed.' });
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Maintenance mode</h1>
        <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">
          Closes every BizzFlow workspace at once. Users see a maintenance page and the API refuses requests until you switch it off. Data is not touched.
        </p>
      </div>

      {!state ? (
        <div className="flex items-center gap-2 text-sm text-nx-text-muted"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className={`${cardCls} max-w-2xl p-4 sm:p-6 space-y-5`}>
          <div className={`flex items-center gap-3 rounded-xl border p-4 ${state.on ? 'border-nx-warning/40 bg-nx-warning-soft' : 'border-nx-success/30 bg-nx-success-soft'}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${state.on ? 'text-nx-warning' : 'text-nx-success'}`}>
              <Wrench size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${state.on ? 'text-nx-warning' : 'text-nx-success'}`}>
                {state.on ? 'Maintenance is ON: all workspaces are closed' : 'Maintenance is off: workspaces are open'}
              </p>
              {state.on && state.until && <p className="text-xs text-nx-text-muted">Expected back: {state.until}</p>}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-nx-text-muted">Message shown to users</span>
            <textarea rows={3} maxLength={500} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="We are carrying out scheduled maintenance. BizzFlow will be back shortly."
              className={`${inputCls} mt-1 w-full`} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-nx-text-muted">Expected back at (optional, Sri Lanka time)</span>
            <input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} className={`${inputCls} mt-1 w-full sm:w-64`} />
          </label>

          {note && (
            <p role="status" className={`flex items-center gap-2 text-xs ${note.ok ? 'text-nx-success' : 'text-nx-danger'}`}>
              {note.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {note.text}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {state.on ? (
              <>
                <button type="button" disabled={busy} onClick={() => save(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-nx-success px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />} Switch off, reopen workspaces
                </button>
                <button type="button" disabled={busy} onClick={() => save(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-nx-line px-4 py-2.5 text-sm font-semibold text-nx-ink disabled:opacity-60 dark:border-nx-line-dark dark:text-white">
                  Update message
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => save(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-nx-warning px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Turn on maintenance
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

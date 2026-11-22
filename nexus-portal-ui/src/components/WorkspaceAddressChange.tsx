"use client";

import React, { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

const inputCls = 'h-11 w-full rounded-xl border border-nx-line bg-white px-3.5 text-sm text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white';

type Step = 'closed' | 'details' | 'code';

/** Change the workspace address: new name + password, then a 6-digit code emailed to the account. */
export default function WorkspaceAddressChange({ url, onChanged }: { url: string; onChanged: () => void }) {
  const [step, setStep] = useState<Step>('closed');
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Preview: same protocol, domain and port as today, with the first part replaced
  const preview = (() => {
    try {
      const u = new URL(url);
      const rest = u.host.split('.').slice(1).join('.');
      return `${label || 'your-name'}.${rest}`;
    } catch { return label || 'your-name'; }
  })();

  const post = async (path: string, body: object) => {
    const res = await adminFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    return data;
  };

  const close = () => { setStep('closed'); setPassword(''); setCode(''); setLabel(''); setMsg(null); };

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const d = await post('/client/workspace/address/request', { label: label.trim().toLowerCase(), password });
      setPassword('');
      setStep('code');
      setMsg({ ok: true, text: d.message });
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await post('/client/workspace/address/confirm', { code });
      onChanged();
      close();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  };

  if (step === 'closed') {
    return (
      <button onClick={() => setStep('details')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-nx-accent hover:underline dark:text-nx-accent-light">
        <Pencil size={12} aria-hidden="true" /> Change address
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-nx-line bg-nx-surface-soft p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark-2">
      {step === 'details' ? (
        <form onSubmit={request} className="space-y-3">
          <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle">
            Your old address stops working straight away. You can change it once every 30 days.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="ws-label" className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">New address name</label>
            <input id="ws-label" value={label} onChange={e => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              maxLength={42} required autoComplete="off" className={inputCls} placeholder="your-company" />
            <p className="font-mono text-[11px] text-nx-text-subtle break-all">{preview}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ws-password" className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">Your password</label>
            <input id="ws-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={busy || label.length < 3 || !password}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Send code
            </button>
            <button type="button" onClick={close} className="inline-flex h-10 items-center rounded-xl border border-nx-line px-5 text-sm font-semibold text-nx-ink dark:border-nx-line-dark dark:text-white">Cancel</button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="ws-code" className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">6-digit code</label>
            <input id="ws-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" required className={`${inputCls} font-mono tracking-[0.4em]`} />
            <p className="text-[11px] text-nx-text-subtle">Changing to <span className="font-mono">{preview}</span></p>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={busy || code.length !== 6}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Confirm change
            </button>
            <button type="button" onClick={close} className="inline-flex h-10 items-center rounded-xl border border-nx-line px-5 text-sm font-semibold text-nx-ink dark:border-nx-line-dark dark:text-white">Cancel</button>
          </div>
        </form>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-xs font-medium ${msg.ok ? 'text-nx-success' : 'text-nx-danger'}`}>{msg.text}</p>}
    </div>
  );
}

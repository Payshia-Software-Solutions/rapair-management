"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Globe, Loader2, MessageCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

const SUPPORT_WHATSAPP = '94770481363';
const card = 'rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark';
const eyebrow = 'text-[11px] font-medium uppercase tracking-wider text-nx-text-subtle dark:text-nx-text-strong';
const inputCls = 'h-11 w-full rounded-xl border border-nx-line bg-white px-3.5 text-sm text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white';

type DomainInfo = { domain: string; status: 'pending' | 'active'; txt_host: string; txt_value: string; cname_target: string };
type View = { allowed: boolean; ready: boolean; domain: DomainInfo | null };

function CopyValue({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="min-w-0">
      <p className={eyebrow}>{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-nx-line bg-nx-surface-muted px-2.5 py-2 font-mono text-[11px] text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white">{value || '—'}</code>
        <button type="button" aria-label={`Copy ${label}`} disabled={!value}
          onClick={() => { void navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
          className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark">
          {done ? <Check size={14} className="text-nx-success" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

/** Connect your own domain: add it, set two DNS records, verify. */
export default function CustomDomainCard() {
  const [view, setView] = useState<View | null>(null);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState<'' | 'add' | 'verify' | 'remove'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const call = useCallback(async (path: string, body?: object) => {
    const res = await adminFetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    return data.data as View;
  }, []);

  useEffect(() => {
    call('/client/domain').then(setView).catch(() => setView(null));
  }, [call]);

  const run = async (kind: 'add' | 'verify' | 'remove', path: string, body?: object, okText?: string) => {
    setBusy(kind); setMsg(null);
    try {
      const v = await call(path, body ?? {});
      setView(v);
      if (kind === 'add') setDomain('');
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(''); }
  };

  if (!view) return null;
  const d = view.domain;
  const upgradeHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi, I would like a custom domain for my workspace.')}`;

  return (
    <section aria-label="Custom domain" className={`${card} p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <Globe size={15} className="text-nx-accent dark:text-nx-accent-light" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold text-nx-ink dark:text-white">Custom domain</h3>
      </div>

      {!view.allowed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-nx-text-muted dark:text-nx-text-subtle">Open your workspace on your own domain, like erp.yourcompany.com. Included in higher plans.</p>
          <a href={upgradeHref} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-nx-accent px-4 text-[13px] font-semibold text-white hover:opacity-90">
            <MessageCircle size={14} aria-hidden="true" /> Ask about upgrading
          </a>
        </div>
      ) : !d ? (
        <form onSubmit={e => { e.preventDefault(); void run('add', '/client/domain/add', { domain }); }} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="cd-domain" className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">Your domain</label>
            <input id="cd-domain" value={domain} onChange={e => setDomain(e.target.value)} placeholder="erp.yourcompany.com"
              autoComplete="off" inputMode="url" required className={inputCls} disabled={!view.ready} />
            <p className="text-[11px] text-nx-text-subtle">You must be able to add DNS records for this domain. You can connect one domain.</p>
          </div>
          <button type="submit" disabled={busy !== '' || !domain.trim() || !view.ready}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent disabled:opacity-60">
            {busy === 'add' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Continue
          </button>
        </form>
      ) : d.status === 'active' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold text-nx-ink dark:text-white">{d.domain}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-nx-success"><Check size={12} aria-hidden="true" /> Connected</p>
          </div>
          <button type="button" disabled={busy !== ''}
            onClick={() => { if (confirm(`Disconnect ${d.domain}? Your workspace will stop opening on it.`)) void run('remove', '/client/domain/remove', {}, 'Domain disconnected.'); }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-nx-line px-4 text-sm font-semibold text-nx-danger dark:border-nx-line-dark">
            {busy === 'remove' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-nx-text-muted dark:text-nx-text-subtle">
            Add these two records at your DNS provider for <strong className="font-mono text-nx-ink dark:text-white">{d.domain}</strong>, then press Verify. DNS changes can take a few minutes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyValue label="1. TXT record name" value={d.txt_host} />
            <CopyValue label="TXT record value" value={d.txt_value} />
            <CopyValue label={`2. CNAME record name`} value={d.domain} />
            <CopyValue label="CNAME points to" value={d.cname_target} />
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={busy !== ''} onClick={() => void run('verify', '/client/domain/verify', {}, 'Your domain is connected.')}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent disabled:opacity-60">
              {busy === 'verify' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Verify
            </button>
            <button type="button" disabled={busy !== ''} onClick={() => void run('remove', '/client/domain/remove', {})}
              className="inline-flex h-10 items-center rounded-xl border border-nx-line px-5 text-sm font-semibold text-nx-ink dark:border-nx-line-dark dark:text-white">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-xs font-medium ${msg.ok ? 'text-nx-success' : 'text-nx-danger'}`}>{msg.text}</p>}
    </section>
  );
}

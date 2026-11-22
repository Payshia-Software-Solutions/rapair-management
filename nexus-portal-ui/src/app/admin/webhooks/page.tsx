"use client";

import React, { useState } from 'react';
import { Webhook, Loader2, Send } from 'lucide-react';
import WebhookTable from '@/components/admin/WebhookTable';
import { adminApi, cardCls, errMsg } from '@/lib/adminApi';

/** Every provisioning event sent to products, newest first. */
export default function WebhooksPage() {
  const [refresh, setRefresh] = useState(0);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const runNow = async () => {
    setRunning(true);
    setNote(null);
    try {
      const r = await adminApi<{ sent: number; not_sent: number }>('/admin/webhooks/run', {});
      setNote(r.sent || r.not_sent ? `Sent ${r.sent}, not sent ${r.not_sent}.` : 'Nothing was due.');
    } catch (e: unknown) {
      setNote(errMsg(e));
    } finally {
      setRunning(false);
      setRefresh(x => x + 1);
    }
  };

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Webhook size={20} /> Provisioning log</h1>
          <p className="mt-1 text-[13px] text-nx-text-muted">
            Workspace changes sent to products. Failed sends retry automatically for a day; you can retry any time.
          </p>
        </div>
        <button onClick={() => void runNow()} disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg border border-nx-line px-3.5 py-2 text-[13px] hover:bg-nx-surface-muted disabled:opacity-60 dark:border-nx-line-dark dark:hover:bg-nx-line-dark">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send due now
        </button>
      </div>
      {note && <p className="text-[13px] text-nx-text-muted">{note}</p>}
      <div className={cardCls}>
        <WebhookTable refreshKey={refresh} />
      </div>
    </div>
  );
}

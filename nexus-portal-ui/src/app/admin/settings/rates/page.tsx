"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { RefreshCcw, Save, Loader2, DollarSign, TrendingUp, AlertCircle, Globe, Plus, X } from 'lucide-react';

export default function ExchangeRatesPage() {
  const [rates,       setRates]       = useState<any[]>([]);
  const [sources,     setSources]     = useState<string[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [syncSummary, setSyncSummary] = useState<any[] | null>(null);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [message,     setMessage]     = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchRates = async (force = false) => {
    if (force) setSyncing(true); else setLoading(true);
    try {
      if (force) {
        const res  = await adminFetch(`/admin/settings/exchange-rates/preview`, { method: 'POST', });
        const data = await res.json();
        if (data.status === 'success') setSyncSummary(data.data);
      } else {
        const res  = await adminFetch(`/admin/settings/exchange-rates`, { });
        const data = await res.json();
        if (data.status === 'success') { setRates(data.data.rates); setSources(data.data.sources); setActiveSource(data.data.active_source); }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setSyncing(false); }
  };

  useEffect(() => { fetchRates(); }, []);

  const handleApplySync = async () => {
    if (!syncSummary) return;
    setSyncing(true);
    try {
      const res  = await adminFetch(`/admin/settings/exchange-rates/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: syncSummary }) });
      const data = await res.json();
      if (data.status === 'success') { setMessage({ type: 'success', text: data.message }); setSyncSummary(null); fetchRates(); }
    } catch { setMessage({ type: 'error', text: 'Failed to apply changes' }); }
    finally { setSyncing(false); }
  };

  const handleReset = async (code: string) => {
    try {
      const res = await adminFetch(`/admin/settings/exchange-rates/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency_code: code }) });
      if (res.ok) { setMessage({ type: 'success', text: `Rate for ${code} reset to market!` }); fetchRates(); }
    } catch { setMessage({ type: 'error', text: 'Failed to reset rate' }); }
  };

  const handleSourceChange = async (source: string) => {
    try {
      const res = await adminFetch(`/admin/settings/exchange-rates/source`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
      if (res.ok) { setActiveSource(source); setMessage({ type: 'success', text: `Sync source changed to ${source}` }); fetchRates(true); }
    } catch { setMessage({ type: 'error', text: 'Failed to update sync source' }); }
  };

  const handleUpdate = async (code: string, newRate: string) => {
    setSaving(code);
    try {
      const res  = await adminFetch(`/admin/settings/exchange-rates/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency_code: code, rate: parseFloat(newRate) }) });
      const data = await res.json();
      setMessage(data.status === 'success' ? { type: 'success', text: `Rate for ${code} updated!` } : { type: 'error', text: data.message });
      if (data.status === 'success') fetchRates();
    } catch { setMessage({ type: 'error', text: 'Failed to connect to server' }); }
    finally { setSaving(null); setTimeout(() => setMessage(null), 3000); }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-nx-text-subtle">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading rates…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Exchange Rates</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Market sync & manual override</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Source selector */}
          <div className="flex items-center gap-2 rounded-lg border border-nx-line bg-white px-3 py-2 dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <Globe size={13} className="text-nx-text-subtle" />
            <select value={activeSource} onChange={e => handleSourceChange(e.target.value)}
              className="bg-transparent text-[13px] text-nx-ink dark:text-white outline-none cursor-pointer">
              {sources.map(s => <option key={s} value={s}>{s.replace('-', ' ').toUpperCase()}</option>)}
            </select>
          </div>
          <button onClick={() => fetchRates(true)} disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-nx-accent px-3 py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            {syncing ? '…' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Alert */}
      {message && (
        <div className={`flex items-center gap-2.5 rounded-lg border p-3 text-[13px] font-medium ${
          message.type === 'success'
            ? 'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success'
            : 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger dark:border-nx-danger/30 dark:text-nx-danger'
        }`}>
          <AlertCircle size={14} />{message.text}
        </div>
      )}

      {/* Rates Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rates.map(rate => (
          <div key={rate.id} className="rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark p-4 group">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-accent-soft dark:bg-nx-accent/10">
                  <span className="text-[10px] font-bold text-nx-accent dark:text-nx-accent-light">{rate.currency_code}</span>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-nx-ink dark:text-white">{rate.currency_code}</div>
                  <div className="text-[10px] text-nx-text-subtle">{rate.is_manual ? 'Override' : 'Market'}</div>
                </div>
              </div>
              <TrendingUp size={13} className={rate.is_manual ? 'text-nx-warning' : 'text-nx-success'} />
            </div>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
              <input type="number" defaultValue={rate.rate}
                onBlur={e => { if (parseFloat(e.target.value) !== parseFloat(rate.rate)) handleUpdate(rate.currency_code, e.target.value); }}
                className="w-full rounded-lg border border-nx-line bg-nx-surface-muted py-2 pl-7 pr-2 text-[12px] font-mono font-semibold text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 transition-all" />
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-nx-surface-muted dark:border-nx-line-dark pt-2.5">
              <span className="text-[10px] text-nx-text-subtle">
                {new Date(rate.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <div className="flex items-center gap-1">
                {rate.is_manual && rate.currency_code !== 'USD' && (
                  <button onClick={() => handleReset(rate.currency_code)} className="text-[10px] font-medium text-nx-accent hover:text-nx-accent-strong transition-colors">
                    Reset
                  </button>
                )}
                {saving === rate.currency_code && <Loader2 size={10} className="animate-spin text-nx-accent" />}
              </div>
            </div>
          </div>
        ))}

        {/* Add new placeholder */}
        <div className="cursor-not-allowed rounded-xl border border-dashed border-nx-line dark:border-nx-line-dark p-4 flex flex-col items-center justify-center gap-2 hover:border-nx-accent/40 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-surface-muted dark:bg-nx-line-dark">
            <Plus size={15} className="text-nx-text-subtle" />
          </div>
          <span className="text-[11px] font-medium text-nx-text-subtle">New CCY</span>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-nx-warning/30 bg-nx-warning-soft p-4">
        <AlertCircle size={15} className="text-nx-warning dark:text-nx-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold text-nx-warning dark:text-nx-warning">Financial Accuracy Notice</p>
          <p className="mt-0.5 text-[12px] text-nx-warning dark:text-nx-warning">Manual edits become permanent overrides and will not be auto-synced until reset.</p>
        </div>
      </div>

      {/* Sync Summary Modal */}
      {syncSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-xl border border-nx-line bg-white shadow-2xl dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-5 py-4">
              <div>
                <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Sync Preview</h3>
                <p className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">Market shift via {activeSource.toUpperCase()}</p>
              </div>
              <button onClick={() => setSyncSummary(null)} className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
              {syncSummary.map(item => (
                <div key={item.code} className="flex items-center justify-between rounded-lg border border-nx-line bg-nx-surface-soft dark:border-nx-line-dark dark:bg-nx-surface-dark-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-nx-ink dark:text-white">{item.code}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      item.status === 'Updated' ? 'bg-nx-success-soft text-nx-success dark:bg-nx-success-soft dark:text-nx-success' :
                      item.status === 'No Change' ? 'bg-nx-surface-muted text-nx-text-subtle dark:bg-nx-line-dark' :
                      'bg-nx-warning-soft text-nx-warning dark:bg-nx-warning-soft dark:text-nx-warning'
                    }`}>{item.status}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-nx-text-subtle line-through">{Number(item.old).toFixed(3)}</span>
                    <TrendingUp size={9} className="text-nx-accent" />
                    <span className="font-semibold text-nx-ink dark:text-white">{Number(item.new).toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-nx-line dark:border-nx-line-dark p-4">
              <button onClick={handleApplySync} disabled={syncing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
                {syncing && <Loader2 size={14} className="animate-spin" />}
                {syncing ? 'Applying…' : 'Confirm & Apply Rates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

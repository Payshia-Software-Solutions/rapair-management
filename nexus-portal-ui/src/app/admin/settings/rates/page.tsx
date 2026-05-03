"use client";

import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, 
  Save, 
  Loader2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<any[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<any[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchRates = async (force = false) => {
    if (force) setSyncing(true);
    else setLoading(true);
    
    try {
      if (force) {
        // Just preview, don't update DB yet
        const res = await fetch(`${API_BASE}/admin/settings/exchange-rates/preview`, { 
          method: 'POST',
          credentials: 'include' 
        });
        const data = await res.json();
        if (data.status === 'success') {
          setSyncSummary(data.data);
        }
      } else {
        const res = await fetch(`${API_BASE}/admin/settings/exchange-rates`, { credentials: 'include' });
        const data = await res.json();
        if (data.status === 'success') {
          setRates(data.data.rates);
          setSources(data.data.sources);
          setActiveSource(data.data.active_source);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleApplySync = async () => {
    if (!syncSummary) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/exchange-rates/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: syncSummary })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ type: 'success', text: data.message });
        setSyncSummary(null);
        fetchRates();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to apply changes' });
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings/exchange-rates/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency_code: code })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Rate for ${code} reset to market!` });
        fetchRates();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reset rate' });
    }
  };

  const handleSourceChange = async (source: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings/exchange-rates/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source })
      });
      if (res.ok) {
        setActiveSource(source);
        setMessage({ type: 'success', text: `Sync source changed to ${source}` });
        fetchRates(true); // Force sync after source change
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update sync source' });
    }
  };

  const handleUpdate = async (code: string, newRate: string) => {
    setSaving(code);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/exchange-rates/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency_code: code, rate: parseFloat(newRate) })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ type: 'success', text: `Rate for ${code} updated successfully!` });
        fetchRates();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                <Globe size={20} />
             </div>
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Global Finance</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Currency Exchange Rates</h1>
          <p className="text-slate-500 font-medium">Manage localized pricing and manual overrides for multi-currency billing.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-white/5 p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sync Source:</span>
            <select 
              value={activeSource}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none pr-2 cursor-pointer"
            >
              {sources.map(s => <option key={s} value={s}>{s.replace('-', ' ').toUpperCase()}</option>)}
            </select>
          </div>
          <button 
            onClick={() => fetchRates(true)}
            disabled={syncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {syncSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/5"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Sync Summary</h3>
                  <p className="text-xs text-slate-500 font-medium">Market synchronization results via {activeSource.toUpperCase()}</p>
                </div>
                <button 
                  onClick={() => setSyncSummary(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400"
                >
                  <TrendingUp className="rotate-45" size={20} />
                </button>
              </div>

              <div className="space-y-3 mb-8">
                {syncSummary.map((item: any) => (
                  <div key={item.code} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-slate-900 dark:text-white">{item.code}</div>
                      <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        item.status === 'Updated' ? 'bg-emerald-500/10 text-emerald-500' : 
                        item.status === 'No Change' ? 'bg-slate-500/10 text-slate-400' : 
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-400 font-black uppercase mb-0.5">Rate Shift</div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400 line-through">{Number(item.old).toFixed(4)}</span>
                        <TrendingUp size={10} className="text-indigo-500" />
                        <span className="text-slate-900 dark:text-white font-bold">{Number(item.new).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleApplySync}
                disabled={syncing}
                className="w-full btn-premium py-4 rounded-2xl text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing && <Loader2 className="animate-spin" size={16} />}
                {syncing ? 'Applying...' : 'Confirm & Apply Rates'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-8 p-4 rounded-xl flex items-center gap-3 border ${
              message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
            }`}
          >
            <AlertCircle size={20} />
            <span className="text-sm font-bold">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rates.map((rate) => (
          <div key={rate.id} className="glass p-6 group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-sm">
                  {rate.currency_code}
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{rate.currency_code}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                      {rate.is_manual ? 'Manual Override' : 'Market Rate'}
                    </div>
                    {rate.is_manual && rate.currency_code !== 'USD' && (
                      <button 
                        onClick={() => handleReset(rate.currency_code)}
                        className="text-[9px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-tighter bg-indigo-500/5 px-1.5 py-0.5 rounded transition-all"
                      >
                        Reset to Market
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <TrendingUp size={18} className={rate.is_manual ? 'text-amber-500' : 'text-emerald-500'} />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate (1 USD =)</label>
                <div className="relative">
                   <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="number" 
                     defaultValue={rate.rate}
                     onBlur={(e) => {
                       if (parseFloat(e.target.value) !== parseFloat(rate.rate)) {
                         handleUpdate(rate.currency_code, e.target.value);
                       }
                     }}
                     className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                   />
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="text-[10px] text-slate-400 font-medium">
                  Last Sync: {new Date(rate.updated_at).toLocaleDateString()}
                </div>
                {saving === rate.currency_code && (
                  <Loader2 className="animate-spin text-indigo-500" size={16} />
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-4 group hover:border-indigo-500/50 transition-all cursor-pointer">
           <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-all">
             <TrendingUp size={24} />
           </div>
           <div>
             <div className="font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-all">Add Currency</div>
             <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Coming Soon</p>
           </div>
        </div>
      </div>
      
      <div className="mt-12 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
        <AlertCircle className="text-amber-500 shrink-0" size={24} />
        <div>
          <h4 className="text-sm font-bold text-amber-500 mb-1 tracking-tight">Financial Accuracy Notice</h4>
          <p className="text-xs text-amber-500/80 leading-relaxed">
            Market rates are automatically synced every 24 hours. If you manually edit a rate, it becomes a **Permanent Override** and will not be updated by the API until you reset it. Use manual rates for stable corporate pricing.
          </p>
        </div>
      </div>
    </div>
  );
}

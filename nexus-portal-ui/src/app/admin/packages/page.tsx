"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2,
  RefreshCcw,
  CreditCard,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/packages`, { credentials: 'include' });
      const data = await res.json();
      setPackages(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8 lg:p-12 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">License Packages</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Define and manage commercial subscription tiers and module access.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-3 glass glass-hover text-slate-400 rounded-xl transition-all">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20">
            <Plus size={20} /> Create New Tier
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Package Identity</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pricing (USD)</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Enabled Modules</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Support Services</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Infrastructure / Server</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5 font-bold text-slate-900 dark:text-white">{pkg.name}</td>
                <td className="px-6 py-5 text-center font-black text-indigo-600 dark:text-indigo-400">
                  ${pkg.monthly_price}
                </td>
                <td className="px-6 py-5">
                   <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {JSON.parse(pkg.modules || '[]').map((m: string) => (
                        <span key={m} className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tight border border-slate-200 dark:border-white/5">
                          {m}
                        </span>
                      ))}
                   </div>
                </td>
                <td className="px-6 py-5">
                   <div className="flex flex-wrap gap-1 max-w-[250px]">
                      {JSON.parse(pkg.services || '[]').map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-bold uppercase tracking-tight border border-emerald-500/10">
                          {s}
                        </span>
                      ))}
                   </div>
                </td>
                <td className="px-6 py-5">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 font-mono italic">
                        {pkg.server_info || 'Cloud Standard'}
                      </span>
                   </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    pkg.is_public == 1 
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-slate-400 bg-slate-400/10 border-slate-400/20'
                  }`}>
                    {pkg.is_public == 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                    {pkg.is_public == 1 ? 'Public' : 'Hidden'}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                   <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link 
                        href={`/admin/packages/edit/${pkg.id}`}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-lg transition-all" 
                        title="Edit Plan"
                      >
                        <Edit size={16} />
                      </Link>
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this package?')) {
                            await fetch(`${API_BASE}/admin/packages/delete`, {
                              method: 'POST',
                              headers: {'Content-Type': 'application/json'},
                              credentials: 'include',
                              body: JSON.stringify({id: pkg.id})
                            });
                            fetchData();
                          }
                        }}
                        className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                        title="Delete Plan"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

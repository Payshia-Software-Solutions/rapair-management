"use client";

import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw,
  Search,
  MoreVertical,
  Layers,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, { credentials: 'include' });
      const data = await res.json();
      setTenants(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/admin/tenants/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 lg:p-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">SaaS Tenants</h1>
          <p className="text-slate-500 font-medium">Global directory of all active and trial enterprise instances.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm w-72 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
            />
          </div>
          <button 
            onClick={() => router.push('/admin/tenants/create')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-xs font-black uppercase tracking-widest"
          >
            <Plus size={18} /> Register Instance
          </button>
          <button onClick={fetchData} className="p-3 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 rounded-xl transition-all border border-slate-200 dark:border-white/5">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Enterprise Identity</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Plan Tier</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Application License</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure API Key</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-xs">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white">{tenant.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-wider mt-0.5">{tenant.slug}.nexus.io</div>
                      </div>
                   </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="px-3 py-1 bg-indigo-500/10 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-500/20">
                    {tenant.package_name}
                  </span>
                </td>
                <td className="px-6 py-5">
                   <div className="flex items-center gap-2">
                      <code className="text-[9px] font-mono bg-slate-100 dark:bg-white/5 px-2 py-1 rounded border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400">
                        {tenant.license_key}
                      </code>
                   </div>
                </td>
                <td className="px-6 py-5">
                   <div className="flex items-center gap-2">
                      <code className="text-[9px] font-mono bg-indigo-50 dark:bg-indigo-500/5 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        {tenant.api_key}
                      </code>
                   </div>
                </td>
                <td className="px-6 py-5 text-center">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                     tenant.status === 'Active' 
                     ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' 
                     : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                   }`}>
                     {tenant.status}
                   </span>
                </td>
                <td className="px-6 py-5 text-right">
                   <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => router.push(`/admin/tenants/edit/${tenant.id}`)}
                        className="p-2 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-500 rounded-lg transition-all" 
                        title="Edit Configuration"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(tenant.id)}
                        className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                        title="Delete Instance"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button className="p-2 hover:bg-white/5 text-slate-500 rounded-lg transition-all">
                        <MoreVertical size={18} />
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

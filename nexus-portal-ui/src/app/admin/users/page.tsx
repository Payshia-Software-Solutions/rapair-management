"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UserCheck, 
  MoreVertical,
  RefreshCcw
} from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      // Role protection
      const authRes = await fetch(`${API_BASE}/auth/check`, { credentials: 'include' });
      if (authRes.ok) {
         const authData = await authRes.json();
         if (authData.role !== 'super_admin') {
            router.push('/admin/dashboard');
            return;
         }
      } else {
         router.push('/admin/login');
         return;
      }

      const res = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
      const data = await res.json();
      setUsers(data.data || []);
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
          <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Client Accounts</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Provision and manage authorized identities for enterprise clients.</p>
        </div>
        <button onClick={fetchData} className="p-3 glass glass-hover text-slate-400 rounded-xl transition-all">
          <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        <div className="glass p-8 h-fit">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <UserCheck size={20} className="text-indigo-600 dark:text-indigo-400" /> Authorize Identity
          </h3>
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            const res = await fetch(`${API_BASE}/admin/users/create`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              credentials: 'include',
              body: JSON.stringify(data)
            });
            if (res.ok) {
              alert('Account provisioned successfully');
              (e.target as HTMLFormElement).reset();
              fetchData();
            }
          }}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Username</label>
              <input name="username" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
              <input name="password" required type="password" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all" />
            </div>
            <button type="submit" className="w-full btn-premium py-4 mt-6 text-xs font-black uppercase tracking-widest">Authorize Access</button>
          </form>
        </div>

        <div className="lg:col-span-3 glass overflow-hidden">
          <div className="p-8 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Verified Directory</h3>
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black tracking-widest uppercase border border-indigo-500/20">{users.length} Identities</span>
          </div>
          <table className="w-full text-left">
             <thead>
                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                   <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Identity</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Company / Tenant</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {users.map((u) => (
                   <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
                               {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <div className="text-sm font-bold text-slate-900 dark:text-white">{u.full_name}</div>
                               <div className="text-xs text-slate-500 font-mono tracking-tight">@{u.username}</div>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                            u.role === 'super_admin' ? 'bg-amber-500/10 text-amber-600' : 'bg-indigo-500/10 text-indigo-600'
                         }`}>
                            {u.role === 'super_admin' ? 'Master' : 'Client'}
                         </span>
                      </td>
                      <td className="px-8 py-5">
                         <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{u.tenant_name || '—'}</div>
                         <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{u.tenant_name ? 'Enterprise Tenant' : 'System Wide'}</div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <MoreVertical size={16} />
                         </button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

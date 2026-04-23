"use client";

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCcw,
  Search,
  MoreVertical
} from 'lucide-react';

export default function ERPRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/requests`, { credentials: 'include' });
      const data = await res.json();
      setRequests(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRequests = requests.filter(req => 
    req.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 lg:p-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">ERP Requests</h1>
          <p className="text-slate-500 font-medium">Manage and approve incoming enterprise deployment requests.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm w-72 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <button onClick={fetchData} className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Company & Contact</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Type</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Requested On</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRequests.map((req) => (
              <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5">
                  <div className="font-bold text-white">{req.company_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{req.email}</div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-white/5">
                    {req.business_type}
                  </span>
                </td>
                <td className="px-6 py-5 text-sm text-slate-400">
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    {req.status === 'Pending' && (
                      <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-400/20">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                   <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-all" title="Approve Request">
                        <CheckCircle2 size={18} />
                      </button>
                      <button className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all" title="Reject Request">
                        <XCircle size={18} />
                      </button>
                      <button className="p-2 hover:bg-white/5 text-slate-500 rounded-lg transition-all ml-2">
                        <MoreVertical size={18} />
                      </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRequests.length === 0 && !loading && (
          <div className="py-20 text-center">
            <div className="text-slate-600 font-bold">No deployment requests found</div>
          </div>
        )}
      </div>
    </div>
  );
}

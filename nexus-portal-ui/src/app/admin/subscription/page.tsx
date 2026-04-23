"use client";

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Zap, 
  Activity, 
  CreditCard,
  RefreshCcw,
  FileText,
  Download
} from 'lucide-react';

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const handleDownload = (id: number, type: string = '') => {
    const link = document.createElement('a');
    link.href = `${API_BASE}/admin/billing/download?id=${id}${type ? `&type=${type}` : ''}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, billRes] = await Promise.all([
        fetch(`${API_BASE}/client/subscription`, { credentials: 'include' }),
        fetch(`${API_BASE}/client/billing/history`, { credentials: 'include' })
      ]);
      
      if (subRes.ok) {
        const subData = await subRes.ok ? await subRes.json() : null;
        setSubscription(subData?.data);
      }
      
      if (billRes.ok) {
        const billData = await billRes.json();
        setBillingHistory(billData.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 animate-pulse font-bold">
        Synchronizing billing profile...
      </div>
    );
  }

  if (!subscription) {
     return (
        <div className="p-12 text-center">
           <div className="text-rose-400 font-bold">Subscription profile not found.</div>
        </div>
     );
  }

  return (
    <div className="p-8 lg:p-12 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Subscription & Billing</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your enterprise license, active capabilities, and payment profile.</p>
        </div>
        <button onClick={fetchData} className="p-3 glass glass-hover text-slate-400 rounded-xl transition-all">
          <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
         <div className="grid lg:grid-cols-3 gap-8">
            {/* Package Card */}
            <div className="glass p-8 relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
               <div className="flex items-center justify-between mb-8">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                     <Trophy size={24} />
                  </div>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                     {subscription.status}
                  </div>
               </div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Active Plan</div>
               <h3 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">{subscription.package_name}</h3>
               <div className="text-2xl font-black text-indigo-400 mb-6">
                  ${subscription.monthly_price} <span className="text-xs text-slate-500 font-medium">/ month</span>
               </div>
               <div className="pt-6 border-t border-slate-200 dark:border-white/5">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Subscription Identity</div>
                  <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-4 font-mono text-xs break-all border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300">
                     {subscription.license_key}
                  </div>
               </div>
            </div>

            {/* Modules Card */}
            <div className="lg:col-span-2 glass p-8">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                     <Zap className="text-indigo-400" size={20} /> Included Capabilities
                  </h3>
               </div>
               <div className="grid sm:grid-cols-2 gap-4">
                  {subscription.package_modules?.map((mod: string, i: number) => (
                     <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 group hover:border-indigo-500/30 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                           <Activity size={18} />
                        </div>
                        <div>
                           <div className="text-sm font-bold text-slate-900 dark:text-white">{mod}</div>
                           <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Module</div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Billing Details */}
         <div className="glass p-8">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3 text-slate-900 dark:text-white">
               <CreditCard className="text-indigo-400" size={20} /> Enterprise Billing Profile
            </h3>
            <div className="grid md:grid-cols-4 gap-8">
               <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Company Registered</div>
                  <div className="font-bold text-slate-900 dark:text-white">{subscription.name}</div>
               </div>
               <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Business Identity</div>
                  <div className="font-bold text-slate-900 dark:text-white">@{subscription.slug}</div>
               </div>
               <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Administrative Contact</div>
                  <div className="font-bold text-slate-900 dark:text-white">{subscription.admin_email}</div>
               </div>
               <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Next Billing Cycle</div>
                  <div className="font-bold text-indigo-500 dark:text-indigo-400">
                     {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
               </div>
            </div>
         </div>

         {/* Billing History */}
         <div className="glass overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
               <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                  <FileText className="text-indigo-400" size={20} /> Enterprise Billing Ledger
               </h3>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Showing {billingHistory.length} Record(s)</div>
            </div>
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice Number</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Billing Period</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Amount</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Due Date</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {billingHistory.map((inv) => (
                     <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                        <td className="px-8 py-5">
                           <div className="font-mono text-xs text-indigo-500 dark:text-indigo-400 font-bold">{inv.invoice_number}</div>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-slate-900 dark:text-white">{inv.billing_month}</td>
                        <td className="px-8 py-5 text-center font-black text-slate-900 dark:text-white">${inv.amount}</td>
                        <td className="px-8 py-5 text-center text-sm text-slate-500 dark:text-slate-400">{new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-8 py-5">
                           <div className="flex items-center justify-end gap-3">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                inv.status === 'Paid' 
                                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                                : inv.status === 'Overdue'
                                ? 'text-rose-500 bg-rose-500/10 border-rose-400/20'
                                : 'text-amber-500 bg-amber-500/10 border-amber-400/20'
                             }`}>
                                {inv.status}
                             </span>
                              <button 
                                onClick={() => handleDownload(inv.id, 'invoice')}
                                className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                                title="Download Invoice"
                              >
                                <FileText size={16} />
                              </button>
                              {inv.status === 'Paid' && (
                                <button 
                                  onClick={() => handleDownload(inv.id, 'receipt')}
                                  className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 text-emerald-500 hover:text-emerald-400 rounded-lg transition-all"
                                  title="Download Receipt"
                                >
                                  <Download size={16} />
                                </button>
                              )}
                           </div>
                        </td>
                     </tr>
                  ))}
                  {billingHistory.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                           <div className="text-slate-500 dark:text-slate-600 font-bold">No billing records found for this enterprise profile.</div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  ShieldCheck, 
  Clock, 
  Zap, 
  CheckCircle2, 
  Calendar,
  Lock,
  ArrowLeft,
  FileText,
  Activity,
  CreditCard,
  Download,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from '@/lib/api';

const ALL_ERP_MODULES = [
  { id: 'serviceCenter', label: 'Service Center', desc: 'Job cards & repair tracking' },
  { id: 'inventory', label: 'Inventory Management', desc: 'Stock & batch tracking' },
  { id: 'vendors', label: 'Vendor Management', desc: 'Supplier & payment profile' },
  { id: 'crm', label: 'CRM', desc: 'Customer lifecycle' },
  { id: 'sales', label: 'Sales', desc: 'Invoicing & retail' },
  { id: 'accounting', label: 'Finance & Accounting', desc: 'Ledgers & reconciliation' },
  { id: 'hrm', label: 'Human Resources', desc: 'Payroll & attendance' },
  { id: 'masterData', label: 'Master Data', desc: 'Core system parameters' },
  { id: 'promotions', label: 'Marketing & Promotions', desc: 'Campaigns & BOGO offers' },
]

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saasData, setSaasData] = useState<any>(null);

  const loadSaas = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/saas/config`);
      const data = await res.json();
      if (data.status === 'success') {
        setSaasData(data.data);
      }
    } catch (err) {
      console.error("SaaS Check Failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/saas/sync`);
      const data = await res.json();
      if (data.status === 'success') {
        setSaasData(data.data);
      }
    } catch (err) {
      console.error("SaaS Sync Failed", err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadSaas();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  const isModuleIncluded = (modId: string) => {
    if (!saasData?.modules) return false;
    if (saasData.modules.includes('*')) return true;
    return saasData.modules.includes(modId);
  }

  if (loading) {
    return (
      <DashboardLayout title="Subscription & Billing">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Subscription & Billing">
      <div className="p-3 sm:p-4 md:p-8 w-full space-y-3 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-6">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <button 
                onClick={() => router.back()}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0"
            >
                <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg md:text-3xl font-black tracking-tighter uppercase italic truncate">Subscription & Billing</h1>
          </div>
          <p className="text-[11px] md:text-sm text-muted-foreground font-medium pl-8 md:pl-11">Manage license, entitlements & history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-2 lg:pl-0">
           {saasData?.api_connected === false ? (
              <Badge variant="outline" className="px-2 py-1 bg-red-500/10 text-red-500 border-red-500/20 font-black uppercase tracking-widest text-[8px] animate-pulse">
                 Sync: Error
              </Badge>
           ) : (
              <Badge variant="outline" className="px-2 py-1 bg-emerald-500/5 text-emerald-500 border-emerald-500/20 font-black uppercase tracking-widest text-[8px]">
                 Sync: Stable
              </Badge>
           )}
           <Badge variant="outline" className="px-2 py-1 bg-blue-500/5 text-blue-400 border-blue-500/20 font-black uppercase tracking-widest text-[8px]">
              #01-SG
           </Badge>
           <Button 
                variant="outline" 
                onClick={handleSync}
                disabled={syncing}
                className="h-8 px-3 rounded-xl border-white/5 bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase tracking-widest gap-2 ml-auto lg:ml-0"
            >
                <RefreshCw className={syncing ? "animate-spin w-3 h-3" : "w-3 h-3"} />
                {syncing ? 'Syncing' : 'Sync Now'}
            </Button>
        </div>
      </div>

      {saasData?.api_connected === false && (
         <motion.div 
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4"
         >
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
               <p className="text-sm font-black text-red-500 uppercase tracking-tight">Master API Connection Failed</p>
               <p className="text-xs text-red-400 font-medium">
                  We could not reach the Nexus Licensing Server. The system is currently running on cached credentials (Restricted Mode). Some feature updates may be delayed until connectivity is restored.
               </p>
            </div>
         </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-3 md:gap-8">
        {/* Left Column: Plan Summary */}
        <div className="lg:col-span-1 space-y-3 md:space-y-6">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass p-3 sm:p-6 md:p-8 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
                <div className="flex items-center gap-3 mb-4 md:mb-8">
                    <div className="p-2 md:p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg shadow-blue-600/20">
                        <ShieldCheck className="text-white" size={20} />
                    </div>
                    <div>
                        <div className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Plan</div>
                        <div className="text-lg md:text-2xl font-black uppercase italic tracking-tighter">{saasData?.name || 'Pro Tier'}</div>
                    </div>
                </div>

                <div className="space-y-2 md:space-y-6">
                    <div className="flex items-center justify-between p-2.5 md:p-4 bg-muted/30 rounded-xl md:rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 md:gap-3">
                            <Calendar className="text-blue-400 shrink-0" size={16} />
                            <span className="text-xs md:text-sm font-bold">Renewal</span>
                        </div>
                        <span className="text-xs md:text-sm font-black text-white text-right">{formatDate(saasData?.renewal_date)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 md:p-4 bg-muted/30 rounded-xl md:rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 md:gap-3">
                            <CreditCard className="text-emerald-400 shrink-0" size={16} />
                            <span className="text-xs md:text-sm font-bold">Price</span>
                        </div>
                        <span className="text-xs md:text-sm font-black text-white">${saasData?.monthly_price || '0.00'}/mo</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 md:p-4 bg-muted/30 rounded-xl md:rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 md:gap-3">
                            <Activity className="text-amber-400 shrink-0" size={16} />
                            <span className="text-xs md:text-sm font-bold">Status</span>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none uppercase text-[9px] md:text-[10px] font-black">{saasData?.status || 'Active'}</Badge>
                    </div>
                </div>

                <div className="mt-4 pt-4 md:mt-8 md:pt-8 border-t border-white/5">
                    <div className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">License Key</div>
                    <div className="p-2.5 md:p-4 bg-slate-900 rounded-lg md:rounded-xl font-mono text-[10px] md:text-xs text-primary break-all border border-white/5">
                        {saasData?.license_key}
                    </div>
                </div>
            </motion.div>

            <div className="p-3 md:p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl md:rounded-3xl flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={16} />
                <p className="text-[10px] md:text-xs text-amber-500/80 font-medium">
                    To upgrade your plan, contact your account manager or visit the Nexus Enterprise Portal.
                </p>
            </div>
        </div>

        {/* Right Column: Entitlements & Invoices */}
        <div className="lg:col-span-2 space-y-3 md:space-y-8">
            {/* Feature Audit */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass p-3 sm:p-8"
            >
                <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter italic mb-3 md:mb-6">Module Entitlements</h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 md:gap-4">
                    {ALL_ERP_MODULES.map((mod) => {
                        const included = isModuleIncluded(mod.id);
                        return (
                            <div key={mod.id} className={`flex items-center gap-2 md:gap-4 p-2.5 md:p-5 rounded-xl md:rounded-2xl border transition-all ${
                                included ? "bg-emerald-500/5 border-emerald-500/10" : "bg-red-500/5 border-red-500/10 opacity-60 grayscale"
                            }`}>
                                <div className={`p-1.5 md:p-2.5 rounded-lg md:rounded-xl shrink-0 ${included ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                                    {included ? <CheckCircle2 size={14} className="md:w-5 md:h-5" /> : <Lock size={14} className="md:w-5 md:h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] md:text-sm font-bold truncate">{mod.label}</div>
                                    <div className="text-[9px] md:text-[10px] text-muted-foreground font-medium truncate hidden sm:block">{mod.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Invoices */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass p-3 sm:p-8"
            >
                <div className="flex items-center justify-between gap-2 mb-4 md:mb-8">
                    <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter italic">Billing History</h3>
                    <Button variant="outline" size="sm" className="rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest h-7 md:h-9 px-2 md:px-4">
                        <Download size={12} className="mr-1" /> All
                    </Button>
                </div>

                {/* Mobile: Card Layout */}
                <div className="md:hidden space-y-2">
                    {saasData?.invoices && saasData.invoices.length > 0 ? (
                        saasData.invoices.map((inv: any, idx: number) => (
                            <div key={idx} className="p-3 bg-muted/20 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                            <FileText className="text-blue-400" size={12} />
                                        </div>
                                        <span className="text-xs font-black">{inv.invoice_number}</span>
                                    </div>
                                    <Badge className={`text-[8px] font-black uppercase tracking-widest ${
                                        inv.status === 'Paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                    }`}>
                                        {inv.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-muted-foreground font-medium">{inv.due_date}</span>
                                        <span className="text-xs font-black text-white">${inv.amount}</span>
                                    </div>
                                    <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
                                        <Download size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 italic">
                            No transaction history found
                        </div>
                    )}
                </div>

                {/* Desktop: Table Layout */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice #</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {saasData?.invoices && saasData.invoices.length > 0 ? (
                                saasData.invoices.map((inv: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                    <FileText className="text-blue-400" size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-white">{inv.invoice_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-muted-foreground">{inv.due_date}</td>
                                        <td className="px-6 py-4 text-sm font-black text-white">${inv.amount}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={`text-[9px] font-black uppercase tracking-widest ${
                                                inv.status === 'Paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                            }`}>
                                                {inv.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
                                                <Download size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 italic">
                                        No transaction history found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

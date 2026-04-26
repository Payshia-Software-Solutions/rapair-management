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

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saasData, setSaasData] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);

  const allPossibleModules = React.useMemo(() => {
    const modulesMap = new Map<string, string>();
    
    const extract = (m: any) => {
        try {
            if (Array.isArray(m)) return m;
            if (typeof m === 'string') {
                if (m.startsWith('[')) return JSON.parse(m);
                return m.split(',').map((s: string) => s.trim());
            }
        } catch(e) {}
        return [];
    };

    extract(saasData?.modules).forEach(m => {
        if (m && m !== '*') modulesMap.set(m.toLowerCase(), m.toUpperCase());
    });

    availablePlans.forEach(p => {
        extract(p.modules).forEach(m => {
            if (m && m !== '*') modulesMap.set(m.toLowerCase(), m.toUpperCase());
        });
    });

    return Array.from(modulesMap.entries()).map(([id, label]) => ({
        id,
        label,
        desc: 'Module defined by Nexus Master API.'
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [saasData, availablePlans]);

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

  const loadPackages = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/saas/packages`);
      const data = await res.json();
      if (data.status === 'success') {
        setAvailablePlans(data.data);
      }
    } catch (err) {
      console.error("Packages Fetch Failed", err);
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
    loadPackages();
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
    const currentModules = Array.isArray(saasData.modules) ? saasData.modules : (typeof saasData.modules === 'string' ? (saasData.modules.startsWith('[') ? JSON.parse(saasData.modules) : saasData.modules.split(',').map((s:string)=>s.trim())) : []);
    return currentModules.some((m: string) => m.toLowerCase() === modId.toLowerCase());
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
      <div className="p-4 md:p-6 w-full space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => router.back()}
                className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
            >
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic truncate">Subscription & Billing</h1>
          </div>
          <p className="text-xs md:text-base text-muted-foreground font-medium pl-10 md:pl-12">Manage license, entitlements & history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-2 lg:pl-0">
           {saasData?.api_connected === false ? (
              <Badge variant="outline" className="px-2 py-1 bg-red-500/10 text-red-500 border-red-500/20 font-black uppercase tracking-widest text-[10px] animate-pulse">
                 Sync: Error
              </Badge>
           ) : (
              <Badge variant="outline" className="px-2 py-1 bg-emerald-500/5 text-emerald-500 border-emerald-500/20 font-black uppercase tracking-widest text-[10px]">
                 Sync: Stable
              </Badge>
           )}
           <Badge variant="outline" className="px-2 py-1 bg-blue-500/5 text-blue-400 border-blue-500/20 font-black uppercase tracking-widest text-[10px]">
              #01-SG
           </Badge>
           <Button 
                variant="outline" 
                onClick={handleSync}
                disabled={syncing}
                className="h-9 px-4 rounded-xl border-border dark:border-white/5 bg-background dark:bg-white/5 hover:bg-accent/10 text-[10px] font-black uppercase tracking-widest gap-2 ml-auto lg:ml-0"
            >
                <RefreshCw className={syncing ? "animate-spin w-4 h-4" : "w-4 h-4"} />
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
                className="bg-card dark:bg-card/40 border border-border dark:border-white/5 rounded-2xl md:rounded-3xl shadow-sm p-4 sm:p-6 md:p-8 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
                <div className="flex items-center gap-4 mb-4 md:mb-6">
                    <div className="p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg shadow-blue-600/20">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-widest">Active Plan</div>
                        <div className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-foreground">{saasData?.name}</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 md:p-4 bg-muted/30 dark:bg-muted/20 rounded-xl border border-border dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
                            <span className="text-sm md:text-base font-bold">Renewal</span>
                        </div>
                        <span className="text-sm md:text-base font-black text-foreground text-right">{formatDate(saasData?.renewal_date)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 md:p-4 bg-muted/30 dark:bg-muted/20 rounded-xl border border-border dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <CreditCard className="text-emerald-600 dark:text-emerald-400 shrink-0" size={18} />
                            <span className="text-sm md:text-base font-bold">Price</span>
                        </div>
                        <span className="text-sm md:text-base font-black text-foreground">${saasData?.monthly_price || saasData?.price || '0.00'}/mo</span>
                    </div>
                    <div className="flex items-center justify-between p-3 md:p-4 bg-muted/30 dark:bg-muted/20 rounded-xl border border-border dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <Activity className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
                            <span className="text-sm md:text-base font-bold">Status</span>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-none uppercase text-[10px] md:text-xs font-black">{saasData?.status}</Badge>
                    </div>
                </div>

                 <div className="mt-4 pt-4 md:mt-8 md:pt-8 border-t border-border dark:border-white/5">
                    <div className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">License Key</div>
                    <div className="p-2.5 md:p-4 bg-muted/50 dark:bg-slate-900 rounded-lg md:rounded-xl font-mono text-[10px] md:text-xs text-primary break-all border border-border dark:border-white/5">
                        {saasData?.license_key}
                    </div>
                </div>
            </motion.div>

            {availablePlans.length > 0 && (
                <div className="space-y-4">
                     <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground pl-1">Available Upgrade Plans</h3>
                     <div className="space-y-3">
                        {availablePlans.filter(p => p.name !== saasData?.name).map((plan, idx) => (
                             <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                className="bg-card dark:bg-card/40 border border-border dark:border-white/5 p-4 rounded-2xl shadow-sm group hover:border-primary/50 transition-all cursor-pointer"
                             >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="font-black italic uppercase text-xl group-hover:text-primary transition-colors tracking-tighter">{plan.name}</div>
                                    <div className="text-xl font-black text-foreground">
                                        ${plan.monthly_price || plan.price || '0'}
                                        <span className="text-[10px] text-muted-foreground ml-0.5">/mo</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(() => {
                                        let mods: string[] = [];
                                        try {
                                            if (Array.isArray(plan.modules)) {
                                                mods = plan.modules;
                                            } else if (typeof plan.modules === 'string') {
                                                // Handle potential JSON string or comma-separated
                                                if (plan.modules.startsWith('[')) {
                                                    mods = JSON.parse(plan.modules);
                                                } else {
                                                    mods = plan.modules.split(',');
                                                }
                                            }
                                        } catch (e) {
                                            mods = [];
                                        }

                                        return mods.map((m: string, i: number) => {
                                            const label = m.replace(/[\[\]"']/g, '').trim();
                                            if (!label || label === '*') return null;
                                            return (
                                                <Badge key={i} variant="outline" className="text-[10px] uppercase border-primary/20 bg-primary/5 text-primary py-0.5 h-6 px-2 font-black tracking-tight">
                                                    {label}
                                                </Badge>
                                            );
                                        }).filter(Boolean).slice(0, 5);
                                    })()}
                                    {/* Handle All Access '*' */}
                                    {(typeof plan.modules === 'string' && plan.modules.includes('*')) || (Array.isArray(plan.modules) && plan.modules.includes('*')) ? (
                                        <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-none text-[10px] uppercase font-black px-2 py-0.5 h-6">All ERP Access</Badge>
                                    ) : null}
                                </div>
                             </motion.div>
                        ))}
                     </div>
                </div>
            )}

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
                className="bg-card dark:bg-card/40 border border-border dark:border-white/5 rounded-2xl md:rounded-3xl shadow-sm p-4 sm:p-6"
            >
                <h3 className="text-base md:text-xl font-black uppercase tracking-tighter italic mb-4 md:mb-6">Module Entitlements</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {allPossibleModules.map((mod) => {
                        const included = isModuleIncluded(mod.id);
                        return (
                             <div key={mod.id} className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-all ${
                                included ? "bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/20" : "bg-muted/50 dark:bg-red-500/5 border-border dark:border-red-500/10 opacity-60 grayscale"
                            }`}>
                                <div className={`p-2 md:p-3 rounded-lg md:rounded-xl shrink-0 ${included ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "bg-muted dark:bg-red-500/10 text-muted-foreground dark:text-red-500"}`}>
                                    {included ? <CheckCircle2 size={18} className="md:w-6 md:h-6" /> : <Lock size={18} className="md:w-6 md:h-6" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm md:text-base font-bold truncate text-foreground">{mod.label}</div>
                                    <div className="text-[10px] md:text-xs text-muted-foreground font-medium truncate hidden sm:block">{mod.desc}</div>
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
                className="bg-card dark:bg-card/40 border border-border dark:border-white/5 rounded-2xl md:rounded-3xl shadow-sm p-4 sm:p-6"
            >
                <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
                    <h3 className="text-base md:text-xl font-black uppercase tracking-tighter italic">Billing History</h3>
                    <Button variant="outline" size="sm" className="rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest h-8 md:h-9 px-3 md:px-4">
                        <Download size={14} className="mr-2" /> All
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
                                        <span className="text-xs font-black text-foreground">${inv.amount}</span>
                                    </div>
                                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
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
                <div className="hidden md:block overflow-hidden rounded-2xl border border-border dark:border-white/5 bg-muted/10 dark:bg-white/[0.02]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/70">Invoice #</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/70">Due Date</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/70">Amount</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/70">Status</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/70 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {saasData?.invoices && saasData.invoices.length > 0 ? (
                                saasData.invoices.map((inv: any, idx: number) => (
                                     <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                    <FileText className="text-blue-600 dark:text-blue-400" size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-foreground">{inv.invoice_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-muted-foreground">{inv.due_date}</td>
                                        <td className="px-6 py-4 text-sm font-black text-foreground">${inv.amount}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={`text-[9px] font-black uppercase tracking-widest ${
                                                inv.status === 'Paid' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                                            }`}>
                                                {inv.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
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

"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, RefreshCcw, DollarSign, Users, AlertCircle, FileText, Download, 
  Calendar, Clock, ShieldAlert, ArrowRight, Building, CheckCircle, Send, Loader2
} from 'lucide-react';

export default function ReportsPage() {
  const [tenants,    setTenants]    = useState<any[]>([]);
  const [packages,   setPackages]   = useState<any[]>([]);
  const [payments,   setPayments]   = useState<any[]>([]);
  const [invoices,   setInvoices]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<'financial' | 'unpaid' | 'operational'>('financial');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  
  // Track reminder email status for each invoice id
  const [remindingStatus, setRemindingStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  
  // Billing month filter for unpaid report (default to current month/year format)
  const [filterMonth, setFilterMonth] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};

      const [tenantsRes, packagesRes, paymentsRes, invoicesRes] = await Promise.all([
        adminFetch(`/admin/tenants`, { headers }),
        adminFetch(`/admin/packages`, { headers }),
        adminFetch(`/admin/billing/payments/all`, { headers }),
        adminFetch(`/admin/billing/list`, { headers })
      ]);

      const tenantsData  = await tenantsRes.json();
      const packagesData = await packagesRes.json();
      const paymentsData = await paymentsRes.json();
      const invoicesData = await invoicesRes.json();

      setTenants(tenantsData.data || []);
      setPackages(packagesData.data || []);
      setPayments(paymentsData.data || []);
      setInvoices(invoicesData.data || []);
      
      // Auto-select latest billing month from invoices list if available
      const months = Array.from(new Set((invoicesData.data || []).map((inv: any) => inv.billing_month).filter(Boolean)));
      if (months.length > 0) {
        setFilterMonth(months[0] as string);
      }
    } catch (err) {
      console.error('Failed to fetch report data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendReminder = async (invoiceId: string) => {
    setRemindingStatus(prev => ({ ...prev, [invoiceId]: 'loading' }));
    try {
      const headers: Record<string, string> = {};
      
      const res = await adminFetch(`/admin/billing/resend?id=${invoiceId}&type=invoice`, { 
        headers
      });
      
      if (res.ok) {
        setRemindingStatus(prev => ({ ...prev, [invoiceId]: 'success' }));
        setTimeout(() => {
          setRemindingStatus(prev => ({ ...prev, [invoiceId]: 'idle' }));
        }, 3000);
      } else {
        setRemindingStatus(prev => ({ ...prev, [invoiceId]: 'error' }));
      }
    } catch {
      setRemindingStatus(prev => ({ ...prev, [invoiceId]: 'error' }));
    }
  };

  // Simple currency conversion helper
  const getAmountInSelected = (amount: number, fromCurrency: string) => {
    const from = (fromCurrency || 'USD').toUpperCase();
    const to = selectedCurrency.toUpperCase();
    if (from === to) return amount;
    if (from === 'USD' && to === 'LKR') return amount * 300;
    if (from === 'LKR' && to === 'USD') return amount / 300;
    if (from === 'EUR' && to === 'USD') return amount * 1.1;
    if (from === 'USD' && to === 'EUR') return amount / 1.1;
    return amount;
  };

  // Helper to calculate credit days aging
  const getCreditDaysAnalysis = (dueDateStr: string) => {
    if (!dueDateStr) return { text: 'No due date', type: 'unknown', days: 0 };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return { text: `${diffDays} days left`, type: 'current', days: diffDays };
    } else if (diffDays === 0) {
      return { text: 'Due today', type: 'today', days: 0 };
    } else {
      return { text: `${Math.abs(diffDays)} days overdue`, type: 'overdue', days: diffDays };
    }
  };

  // Unique billing months found in invoices
  const billingMonthsList = Array.from(new Set(invoices.map(inv => inv.billing_month).filter(Boolean)));

  // ── 1. Financial Metrics ──────────────────────────────────────────
  const totalRevenue = payments.reduce((acc, p) => {
    return acc + getAmountInSelected(parseFloat(p.amount || 0), p.currency);
  }, 0);

  const outstandingRevenue = invoices.reduce((acc, inv) => {
    if (inv.status !== 'Paid') {
      return acc + getAmountInSelected(parseFloat(inv.amount || 0), inv.currency);
    }
    return acc;
  }, 0);

  const projectedMRR = tenants.reduce((acc, tenant) => {
    if (tenant.status === 'Active' || tenant.status === 'Trial') {
      const pkg = packages.find(p => p.id == tenant.package_id);
      const price = pkg ? parseFloat(pkg.monthly_price || 0) : 0;
      return acc + getAmountInSelected(price, tenant.currency || 'USD');
    }
    return acc;
  }, 0);

  const getRevenueByMonth = () => {
    const monthlyData: Record<string, number> = {};
    payments.forEach(p => {
      const date = new Date(p.created_at);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const amt = getAmountInSelected(parseFloat(p.amount || 0), p.currency);
      monthlyData[monthYear] = (monthlyData[monthYear] || 0) + amt;
    });
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .slice(-6);
  };

  const revenueByMonth = getRevenueByMonth();
  const maxMonthRev = Math.max(...revenueByMonth.map(d => d.amount), 1);

  // ── 2. Unpaid & Credit Days Analysis ─────────────────────────────
  // Filter invoices that are unpaid for the selected billing month
  const unpaidInvoices = invoices.filter(inv => {
    const isUnpaid = inv.status !== 'Paid';
    const matchesMonth = filterMonth === 'all' || inv.billing_month === filterMonth;
    return isUnpaid && matchesMonth;
  });

  // Credit days grouping / aging buckets for all unpaid invoices globally
  const agingGroups = {
    current: { count: 0, amount: 0 },   // Due date in future
    overdue30: { count: 0, amount: 0 }, // 1-30 days overdue
    overdue60: { count: 0, amount: 0 }, // 31-60 days overdue
    overdue90: { count: 0, amount: 0 }, // 60+ days overdue
  };

  invoices.forEach(inv => {
    if (inv.status === 'Paid') return;
    const amount = getAmountInSelected(parseFloat(inv.amount || 0), inv.currency);
    const analysis = getCreditDaysAnalysis(inv.due_date);
    
    if (analysis.type === 'current' || analysis.type === 'today') {
      agingGroups.current.count++;
      agingGroups.current.amount += amount;
    } else {
      const daysOverdue = Math.abs(analysis.days);
      if (daysOverdue <= 30) {
        agingGroups.overdue30.count++;
        agingGroups.overdue30.amount += amount;
      } else if (daysOverdue <= 60) {
        agingGroups.overdue60.count++;
        agingGroups.overdue60.amount += amount;
      } else {
        agingGroups.overdue90.count++;
        agingGroups.overdue90.amount += amount;
      }
    }
  });

  // ── 3. Operational Metrics ────────────────────────────────────────
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === 'Active').length;
  const trialTenants = tenants.filter(t => t.status === 'Trial').length;
  const suspendedTenants = tenants.filter(t => t.status === 'Suspended' || t.status === 'Expired').length;

  const tierDistribution = packages.map(pkg => {
    const count = tenants.filter(t => t.package_id == pkg.id).length;
    return { name: pkg.name, count, price: pkg.monthly_price };
  }).filter(t => t.count > 0);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-nx-text-subtle">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Processing global directory…
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full print:p-0">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white flex items-center gap-2">
            <BarChart size={18} className="text-nx-accent" /> Global Platform Reports & Collections
          </h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">System-wide outstanding balances and credit days aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Currency Switcher */}
          <div className="flex items-center gap-1.5 rounded-lg border border-nx-line bg-white px-2.5 py-1.5 dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Reporting CCY:</span>
            <select 
              value={selectedCurrency} 
              onChange={e => setSelectedCurrency(e.target.value)}
              className="bg-transparent text-[12px] font-semibold text-nx-ink dark:text-white outline-none cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="LKR">LKR (Rs)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <button onClick={fetchData} className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
            <RefreshCcw size={15} />
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-nx-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-nx-accent-strong transition-colors shadow-sm">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-nx-line dark:border-nx-line-dark print:hidden">
        <button 
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${
            activeTab === 'financial' 
              ? 'border-nx-accent text-nx-accent dark:border-nx-accent-light dark:text-nx-accent-light' 
              : 'border-transparent text-nx-text-muted hover:text-nx-ink dark:text-nx-text-subtle dark:hover:text-white'
          }`}
        >
          Financial Overview
        </button>
        <button 
          onClick={() => setActiveTab('unpaid')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${
            activeTab === 'unpaid' 
              ? 'border-nx-accent text-nx-accent dark:border-nx-accent-light dark:text-nx-accent-light' 
              : 'border-transparent text-nx-text-muted hover:text-nx-ink dark:text-nx-text-subtle dark:hover:text-white'
          }`}
        >
          Unpaid Month & Credit Days
        </button>
        <button 
          onClick={() => setActiveTab('operational')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${
            activeTab === 'operational' 
              ? 'border-nx-accent text-nx-accent dark:border-nx-accent-light dark:text-nx-accent-light' 
              : 'border-transparent text-nx-text-muted hover:text-nx-ink dark:text-nx-text-subtle dark:hover:text-white'
          }`}
        >
          Operational & Tiers
        </button>
      </div>

      {/* ── 1. Financial Overview Tab ── */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-nx-line bg-white p-5 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">Projected MRR</span>
              <p className="mt-2 text-2xl font-bold text-nx-ink dark:text-white">
                {selectedCurrency} {projectedMRR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-success font-medium">Active tenant subscription projection</span>
            </div>

            <div className="rounded-xl border border-nx-line bg-white p-5 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">Total Received</span>
              <p className="mt-2 text-2xl font-bold text-nx-ink dark:text-white">
                {selectedCurrency} {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-text-muted dark:text-nx-text-subtle">Accumulated solved payments</span>
            </div>

            <div className="rounded-xl border border-nx-line bg-white p-5 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">Outstanding Receivables</span>
              <p className="mt-2 text-2xl font-bold text-nx-ink dark:text-white">
                {selectedCurrency} {outstandingRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-warning font-medium">Pending & Overdue invoices</span>
            </div>
          </div>

          <div className="rounded-xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-nx-ink dark:text-white">Monthly Collections Timeline</h3>
              <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Rolling payment aggregates</p>
            </div>
            {revenueByMonth.length === 0 ? (
              <div className="py-12 text-center text-xs text-nx-text-subtle">No payments logged yet.</div>
            ) : (
              <div className="space-y-3">
                {revenueByMonth.map((d, i) => {
                  const percent = (d.amount / maxMonthRev) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-12 text-[12px] font-medium text-nx-text-muted dark:text-nx-text-subtle">{d.month}</span>
                      <div className="flex-1 bg-nx-surface-muted dark:bg-nx-line-dark h-6 rounded-md overflow-hidden relative">
                        <div className="bg-nx-accent/80 h-full rounded-md" style={{ width: `${percent}%` }} />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white drop-shadow-sm font-mono">
                          {selectedCurrency} {d.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Unpaid & Credit Days Tab ── */}
      {activeTab === 'unpaid' && (
        <div className="space-y-6">
          
          {/* Aging buckets / Credit Days cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">Current (Within Term)</span>
              <p className="mt-1.5 text-xl font-bold text-nx-ink dark:text-white">
                {selectedCurrency} {agingGroups.current.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-success">{agingGroups.current.count} invoices pending due</span>
            </div>
            
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">1–30 Days Overdue</span>
              <p className="mt-1.5 text-xl font-bold text-nx-warning">
                {selectedCurrency} {agingGroups.overdue30.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-warning">{agingGroups.overdue30.count} invoices overdue</span>
            </div>

            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
              <span className="text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block">31–60 Days Overdue</span>
              <p className="mt-1.5 text-xl font-bold text-nx-warning">
                {selectedCurrency} {agingGroups.overdue60.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-warning">{agingGroups.overdue60.count} invoices overdue</span>
            </div>

            <div className="rounded-xl border border-nx-danger/30 bg-nx-danger-soft p-4">
              <span className="text-[11px] font-medium text-nx-danger uppercase tracking-wider block">60+ Days Overdue</span>
              <p className="mt-1.5 text-xl font-bold text-nx-danger">
                {selectedCurrency} {agingGroups.overdue90.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-nx-danger">{agingGroups.overdue90.count} invoices critical</span>
            </div>
          </div>

          {/* Month Unpaid Directory */}
          <div className="rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <div className="p-5 border-b border-nx-line dark:border-nx-line-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-nx-ink dark:text-white">Unpaid Client Balances</h3>
                <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Filter unpaid invoices by billing month</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-nx-text-subtle" />
                <select 
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="rounded-lg border border-nx-line bg-white px-3 py-1.5 text-[12px] font-semibold text-nx-ink dark:border-nx-line-dark dark:bg-nx-surface-dark-2 dark:text-white outline-none cursor-pointer"
                >
                  <option value="all">All Months</option>
                  {billingMonthsList.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                    {['Tenant', 'Invoice Info', 'Billing Month', 'Amount Due', 'Credit / Overdue Status', 'Due Date', 'Action'].map((h, i) => (
                      <th key={i} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark text-[13px]">
                  {unpaidInvoices.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-nx-text-subtle">No unpaid invoices found for the selected month/criteria.</td></tr>
                  ) : unpaidInvoices.map((inv) => {
                    const daysAnalysis = getCreditDaysAnalysis(inv.due_date);
                    const status = remindingStatus[inv.id] || 'idle';
                    return (
                      <tr key={inv.id} className="hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Building size={13} className="text-nx-text-subtle" />
                            <span className="font-medium text-nx-ink dark:text-white">{inv.tenant_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <code className="font-mono text-xs text-nx-accent dark:text-nx-accent-light">{inv.invoice_number}</code>
                        </td>
                        <td className="px-5 py-3.5 text-nx-text-muted dark:text-nx-text-subtle">{inv.billing_month}</td>
                        <td className="px-5 py-3.5 font-semibold text-nx-ink dark:text-white">
                          {inv.currency || 'USD'} {inv.amount}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            daysAnalysis.type === 'overdue' 
                              ? 'bg-nx-danger-soft text-nx-danger border border-nx-danger/30 dark:bg-nx-danger-soft dark:border-nx-danger/30'
                              : 'bg-nx-success-soft text-nx-success border border-nx-success/30 dark:bg-nx-success-soft dark:border-nx-success/30'
                          }`}>
                            <Clock size={10} />
                            {daysAnalysis.text}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-nx-text-muted dark:text-nx-text-subtle">
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleSendReminder(inv.id)}
                            disabled={status === 'loading'}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                              status === 'loading'
                                ? 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                                : status === 'success'
                                ? 'bg-nx-success-soft border-nx-success/30 text-nx-success dark:bg-nx-success-soft dark:border-nx-success/30'
                                : status === 'error'
                                ? 'bg-nx-danger-soft border-nx-danger/30 text-nx-danger dark:bg-nx-danger-soft dark:border-nx-danger/30'
                                : 'bg-nx-accent border-transparent text-white hover:bg-nx-accent-strong shadow-sm'
                            }`}
                          >
                            {status === 'loading' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : status === 'success' ? (
                              <CheckCircle size={12} />
                            ) : status === 'error' ? (
                              <AlertCircle size={12} />
                            ) : (
                              <Send size={12} />
                            )}
                            {status === 'loading'
                              ? 'Sending...'
                              : status === 'success'
                              ? 'Sent!'
                              : status === 'error'
                              ? 'Failed'
                              : 'Remind'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Operational & Tiers Tab ── */}
      {activeTab === 'operational' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark text-center">
              <span className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block font-medium">Total Directory</span>
              <p className="mt-1 text-2xl font-bold text-nx-ink dark:text-white">{totalTenants}</p>
            </div>
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark text-center">
              <span className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block font-medium">Active Subscriptions</span>
              <p className="mt-1 text-2xl font-bold text-nx-success">{activeTenants}</p>
            </div>
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark text-center">
              <span className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block font-medium">Trial Accounts</span>
              <p className="mt-1 text-2xl font-bold text-nx-accent">{trialTenants}</p>
            </div>
            <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark text-center">
              <span className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider block font-medium">Suspended Tiers</span>
              <p className="mt-1 text-2xl font-bold text-nx-danger">{suspendedTenants}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-nx-ink dark:text-white">Tier Popularity Distribution</h3>
                <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Registration density mapped against product tiers</p>
              </div>

              {tierDistribution.length === 0 ? (
                <div className="py-12 text-center text-xs text-nx-text-subtle">No active package allocations found.</div>
              ) : (
                <div className="space-y-4">
                  {tierDistribution.map((t, idx) => {
                    const pct = (t.count / totalTenants) * 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-nx-ink dark:text-white">{t.name} Suite</span>
                          <span className="text-nx-text-subtle">{t.count} accounts ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-nx-surface-muted dark:bg-nx-line-dark overflow-hidden">
                          <div className="bg-nx-accent h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-nx-ink dark:text-white">Operational Health Summary</h3>
                <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">SaaS state representation</p>
              </div>

              <div className="space-y-3.5">
                {[
                  { name: 'Active Subscriptions', count: activeTenants, color: 'bg-nx-success' },
                  { name: 'Onboarding Trial Cycles', count: trialTenants, color: 'bg-nx-accent' },
                  { name: 'Inactive / Suspended Accounts', count: suspendedTenants, color: 'bg-nx-danger' },
                ].map((s, i) => {
                  const pct = totalTenants > 0 ? (s.count / totalTenants) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center justify-between border border-nx-line dark:border-nx-line-dark rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                        <span className="text-[12px] font-medium text-nx-ink dark:text-white">{s.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-nx-ink dark:text-white">{s.count} ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notice / Audit footer */}
      <div className="rounded-xl border border-nx-line bg-nx-surface-soft dark:border-nx-line-dark dark:bg-nx-surface-dark p-4 text-center text-xs text-nx-text-subtle">
        Nexus Portal Audit System · Reports compiled dynamically at {new Date().toLocaleTimeString()}
      </div>

    </div>
  );
}

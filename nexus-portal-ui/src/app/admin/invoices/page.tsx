"use client";

import React, { useState, useEffect } from 'react';
import { 
  CreditCard,
  RefreshCcw,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreVertical,
  Building,
  Edit2,
  Download,
  Mail,
  Send,
  X,
  DollarSign,
  FileText,
  Trash2
} from 'lucide-react';

export default function GlobalInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResendModal, setShowResendModal] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  
  // Billing Cycle Progress State
  const [billingModal, setBillingModal] = useState({
    isOpen: false,
    step: 'idle', // idle, fetching, processing, completed
    total: 0,
    processed: 0,
    currentTenant: '',
    selectedMonth: new Date().toLocaleString('default', { month: 'long' }),
    selectedYear: new Date().getFullYear().toString(),
    results: { created: 0, skipped: 0, details: [] as any[] }
  });

  const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/billing/list`, { credentials: 'include' });
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateInvoice = async (id: number, data: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/billing/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, ...data })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      alert('Failed to update invoice');
    }
  };

  const updateStatus = async (id: number, status: string) => {
    if (!confirm(`Mark invoice #${id} as ${status}?`)) return;
    updateInvoice(id, { status });
  };

  const handleEditAmount = async (id: number, currentAmount: string) => {
    const newAmount = prompt('Enter new amount:', currentAmount);
    if (newAmount !== null && !isNaN(parseFloat(newAmount))) {
      updateInvoice(id, { amount: parseFloat(newAmount) });
    }
  };

  const handleDownload = (id: number) => {
    const link = document.createElement('a');
    link.href = `${API_BASE}/admin/billing/download?id=${id}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResend = async () => {
    if (!showResendModal) return;
    setIsResending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/billing/resend?id=${showResendModal.id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        fetchData();
        setShowResendModal(null);
      }
    } catch (err) {
      alert('Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) {
      alert('Please enter a valid amount');
      return;
    }

    setIsPaying(true);
    try {
      const res = await fetch(`${API_BASE}/admin/billing/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          id: showPaymentModal.id, 
          status: 'Paid',
          paid_amount: amount,
          payment_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
        })
      });
      if (res.ok) {
        fetchData();
        setShowPaymentModal(null);
        setPaymentAmount('');
      }
    } catch (err) {
      alert('Failed to process payment');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/billing/delete?id=${id}`, { 
        method: 'POST',
        credentials: 'include' 
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      alert('Failed to delete invoice');
    }
  };

  const handleRunBilling = async () => {
    const period = `${billingModal.selectedMonth} ${billingModal.selectedYear}`;
    setBillingModal(prev => ({ ...prev, step: 'fetching', processed: 0, total: 0 }));
    
    try {
      // 1. Fetch all active tenants
      const tenantsRes = await fetch(`${API_BASE}/admin/tenants`, { credentials: 'include' });
      const tenantsData = await tenantsRes.json();
      const activeTenants = tenantsData.data || [];
      
      setBillingModal(prev => ({ ...prev, step: 'processing', total: activeTenants.length }));
      
      let created = 0;
      let skipped = 0;
      const details = [];
      
      // 2. Process one by one
      for (let i = 0; i < activeTenants.length; i++) {
        const tenant = activeTenants[i];
        setBillingModal(prev => ({ ...prev, currentTenant: tenant.name, processed: i + 1 }));
        
        try {
          const res = await fetch(`${API_BASE}/admin/billing/run-cycle?tenant_id=${tenant.id}&period=${encodeURIComponent(period)}`, { 
            method: 'POST',
            credentials: 'include' 
          });
          const data = await res.json();
          if (data.processed > 0) {
            created++;
            details.push({ name: tenant.name, status: 'Generated', amount: tenant.monthly_price });
          } else {
            skipped++;
            details.push({ name: tenant.name, status: 'Skipped', reason: 'Already exists' });
          }
        } catch (e) {
          skipped++;
          details.push({ name: tenant.name, status: 'Error', reason: 'Connection failed' });
        }
      }
      
      setBillingModal(prev => ({ 
        ...prev, 
        step: 'completed', 
        results: { created, skipped, details } 
      }));
      fetchData();
    } catch (err) {
      alert('Failed to start billing cycle');
      setBillingModal(prev => ({ ...prev, isOpen: false, step: 'idle' }));
    }
  };

  const filtered = invoices.filter(i => 
    i.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 lg:p-12 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Payments & Invoices</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Global oversight of enterprise billing cycles and financial status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setBillingModal(prev => ({ ...prev, isOpen: true, step: 'idle' }))}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white text-xs font-black tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <CreditCard size={18} />
            Run Billing Cycle
          </button>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search invoices or companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm w-64 lg:w-80 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
            />
          </div>
          <button onClick={fetchData} className="p-3 glass glass-hover text-slate-400 rounded-xl transition-all">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Enterprise Tenant</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice Details</th>
              <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Amount</th>
              <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Status</th>
              <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Email Status</th>
              <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Building size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{inv.tenant_name}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Account ID: {inv.tenant_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="font-mono text-xs text-indigo-500 dark:text-indigo-400 font-bold mb-1">{inv.invoice_number}</div>
                  <div className="text-xs text-slate-500 font-medium">Period: {inv.billing_month}</div>
                </td>
                <td className="px-8 py-5 text-center">
                  <div className="flex items-center justify-center gap-2 group/amt">
                    <span className="font-black text-slate-900 dark:text-white">${inv.amount}</span>
                    <button 
                      onClick={() => handleEditAmount(inv.id, inv.amount)}
                      className="p-1 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/amt:opacity-100 transition-all"
                      title="Edit Amount"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5 ${
                    inv.status === 'Paid' 
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                    : inv.status === 'Overdue'
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                    : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {inv.status === 'Paid' && <CheckCircle size={10} />}
                    {inv.status === 'Pending' && <Clock size={10} />}
                    {inv.status === 'Overdue' && <AlertCircle size={10} />}
                    {inv.status}
                  </span>
                </td>
                <td className="px-8 py-5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5 ${
                      inv.email_status === 'Sent' 
                      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                      : inv.email_status === 'Failed'
                      ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                      : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {inv.email_status === 'Sent' ? <Send size={10} /> : <Mail size={10} />}
                      {inv.email_status || 'Pending'}
                    </span>
                    {inv.last_sent_at && (
                      <span className="text-[9px] text-slate-400 font-medium">
                        {new Date(inv.last_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => setShowResendModal(inv)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 rounded-lg transition-all"
                      title="Resend Email"
                    >
                      <Mail size={16} />
                    </button>
                    <button 
                      onClick={() => handleDownload(inv.id, 'invoice')}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 rounded-lg transition-all"
                      title="Download Invoice"
                    >
                      <FileText size={16} />
                    </button>
                    {inv.status === 'Paid' && (
                      <button 
                        onClick={() => handleDownload(inv.id, 'receipt')}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 text-emerald-500 hover:text-emerald-400 rounded-lg transition-all"
                        title="Download Receipt"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    {inv.status !== 'Paid' && (
                      <button 
                        onClick={() => setShowPaymentModal(inv)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        Confirm Payment
                      </button>
                    )}
                    {inv.status === 'Paid' && (
                      <button 
                        onClick={() => updateStatus(inv.id, 'Pending')}
                        className="px-3 py-1.5 bg-slate-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-500 transition-all"
                      >
                        Revert to Pending
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                      title="Delete Invoice"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400 rounded-lg transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <div className="text-slate-500 font-bold">No matching billing records found.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Resend Confirmation Modal */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Mail size={24} />
                </div>
                <button 
                  onClick={() => setShowResendModal(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Resend Invoice?</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                You are about to re-dispatch <span className="font-bold text-indigo-500">{showResendModal.invoice_number}</span> to the enterprise client.
              </p>

              <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-6 mb-8 border border-slate-100 dark:border-white/5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400">
                      <Building size={14} />
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{showResendModal.tenant_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400">
                      <Mail size={14} />
                    </div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{showResendModal.admin_email}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowResendModal(null)}
                  className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResend}
                  disabled={isResending}
                  className="flex-1 py-4 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResending ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {isResending ? 'Sending...' : 'Send Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <DollarSign size={24} />
                </div>
                <button 
                  onClick={() => setShowPaymentModal(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Confirm Payment</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                Enter the amount received from <span className="font-bold text-emerald-500">{showPaymentModal.tenant_name}</span>.
              </p>

              <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-6 mb-8 border border-slate-100 dark:border-white/5 text-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Invoice Balance</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">${showPaymentModal.amount}</div>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Payment Amount ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`e.g. ${showPaymentModal.amount}`}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-lg font-bold focus:border-emerald-500 outline-none transition-all text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowPaymentModal(null)}
                  className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePayment}
                  disabled={isPaying}
                  className="flex-1 py-4 bg-emerald-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : (
                    <DollarSign size={16} />
                  )}
                  {isPaying ? 'Processing...' : 'Confirm Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Billing Cycle Progress Modal */}
      {billingModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                  <CreditCard size={28} />
                </div>
                {billingModal.step === 'completed' && (
                  <button 
                    onClick={() => setBillingModal(prev => ({ ...prev, isOpen: false }))}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-all"
                  >
                    <X size={24} />
                  </button>
                )}
              </div>

              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
                {billingModal.step === 'idle' && 'Billing Period'}
                {billingModal.step === 'fetching' && 'Initializing Cycle...'}
                {billingModal.step === 'processing' && 'Processing Billing'}
                {billingModal.step === 'completed' && 'Cycle Completed'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                {billingModal.step === 'idle' && 'Select the target month and year for this billing cycle.'}
                {billingModal.step === 'fetching' && 'Accessing BizzFlow Master API to scope enterprise tenants.'}
                {billingModal.step === 'processing' && `Generating and dispatching invoices for ${billingModal.total} active accounts.`}
                {billingModal.step === 'completed' && 'The monthly billing cycle has been executed successfully.'}
              </p>

              {billingModal.step === 'idle' && (
                <div className="space-y-6 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Billing Month</label>
                            <select 
                                value={billingModal.selectedMonth}
                                onChange={(e) => setBillingModal(prev => ({ ...prev, selectedMonth: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                            >
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Billing Year</label>
                            <select 
                                value={billingModal.selectedYear}
                                onChange={(e) => setBillingModal(prev => ({ ...prev, selectedYear: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                            >
                                {[2024, 2025, 2026, 2027, 2028].map(y => (
                                    <option key={y} value={y.toString()}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button 
                        onClick={handleRunBilling}
                        className="w-full py-5 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30"
                    >
                        Start Billing Cycle
                    </button>
                </div>
              )}

              {(billingModal.step === 'processing' || billingModal.step === 'completed') && (
                <div className="space-y-6 mb-8">
                  <div className="flex items-center justify-between text-[11px] font-black tracking-widest text-slate-400 uppercase">
                    <span>Progress Status</span>
                    <span>{Math.round((billingModal.processed / billingModal.total) * 100)}%</span>
                  </div>
                  <div className="h-4 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                      style={{ width: `${(billingModal.processed / billingModal.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/5">
                    {billingModal.step === 'processing' ? (
                        <RefreshCcw size={16} className="animate-spin text-indigo-500" />
                    ) : (
                        <CheckCircle size={16} className="text-emerald-500" />
                    )}
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {billingModal.step === 'processing' 
                        ? `Processing: ${billingModal.currentTenant}` 
                        : 'All tenants processed'}
                    </span>
                  </div>
                </div>
              )}

              {billingModal.step === 'completed' && (
                <div className="space-y-4 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Generated</div>
                            <div className="text-2xl font-black text-emerald-600">{billingModal.results.created}</div>
                        </div>
                        <div className="p-4 bg-slate-500/5 border border-slate-500/10 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Skipped</div>
                            <div className="text-2xl font-black text-slate-500">{billingModal.results.skipped}</div>
                        </div>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Detailed Report</div>
                        {billingModal.results.details.map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl">
                                <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">{d.name}</div>
                                    <div className="text-[9px] text-slate-500 font-medium">{d.reason || `Amount: $${d.amount}`}</div>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                    d.status === 'Generated' ? 'bg-emerald-500/10 text-emerald-600' : 
                                    d.status === 'Skipped' ? 'bg-amber-500/10 text-amber-600' : 
                                    'bg-rose-500/10 text-rose-600'
                                }`}>
                                    {d.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {billingModal.step === 'completed' && (
                <button 
                  onClick={() => setBillingModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-5 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30"
                >
                  Dismiss Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

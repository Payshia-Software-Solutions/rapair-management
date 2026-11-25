"use client";

import { adminFetch } from '@/lib/adminApi';
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, RefreshCcw, Search, CheckCircle, Clock, AlertCircle,
  Building, Edit2, Download, Mail, Send, X, DollarSign, FileText, Trash2
} from 'lucide-react';
import Pagination from '@/components/Pagination';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Paid:    'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success',
    Overdue: 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger dark:border-nx-danger/30 dark:text-nx-danger',
    Pending: 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning dark:border-nx-warning/30 dark:text-nx-warning',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? map['Pending']}`}>
      {status}
    </span>
  );
}

function EmailBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      status === 'Sent'   ? 'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success' :
      status === 'Failed' ? 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger dark:border-nx-danger/30 dark:text-nx-danger' :
                            'border-nx-warning/30 bg-nx-warning-soft text-nx-warning dark:border-nx-warning/30 dark:text-nx-warning'
    }`}>{status || 'Pending'}</span>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function GlobalInvoicesPage() {
  const [invoices,        setInvoices]        = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [currentPage,     setCurrentPage]     = useState(1);
  const itemsPerPage = 10;
  const [showResendModal,  setShowResendModal]  = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [paymentAmount,    setPaymentAmount]    = useState('');
  const [isResending,      setIsResending]      = useState(false);
  const [isPaying,         setIsPaying]         = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<any>(null);
  const [paymentHistory,   setPaymentHistory]   = useState<any[]>([]);
  const [loadingHistory,   setLoadingHistory]   = useState(false);
  const [paymentMethod,    setPaymentMethod]    = useState('Bank Transfer');
  const [transactionId,    setTransactionId]    = useState('');
  const [billingModal, setBillingModal] = useState({
    isOpen: false, step: 'idle', total: 0, processed: 0, currentTenant: '',
    selectedMonth: new Date().toLocaleString('default', { month: 'long' }),
    selectedYear: new Date().getFullYear().toString(),
    results: { created: 0, skipped: 0, details: [] as any[] }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await adminFetch(`/admin/billing/list`, { });
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const updateInvoice = async (id: number, data: any) => {
    try {
      const res = await adminFetch(`/admin/billing/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
      if (res.ok) fetchData();
    } catch { alert('Failed to update invoice'); }
  };

  const handleEditAmount = async (id: number, currentAmount: string) => {
    const newAmount = prompt('Enter new amount:', currentAmount);
    if (newAmount !== null && !isNaN(parseFloat(newAmount))) updateInvoice(id, { amount: parseFloat(newAmount) });
  };

  const handleDownload = (id: number, type = 'invoice') => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/admin/billing/download?id=${id}&type=${type}`;
    a.setAttribute('download', '');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleResend = async (type = 'invoice') => {
    if (!showResendModal) return;
    setIsResending(true);
    try {
      const res = await adminFetch(`/admin/billing/resend?id=${showResendModal.id}&type=${type}`, { });
      if (res.ok) { fetchData(); setShowResendModal(null); }
    } catch { alert('Failed to resend email'); }
    finally { setIsResending(false); }
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount)) { alert('Please enter a valid amount'); return; }
    setIsPaying(true);
    try {
      const res = await adminFetch(`/admin/billing/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: showPaymentModal.id, amount, payment_method: paymentMethod, transaction_id: transactionId }) });
      if (res.ok) { fetchData(); setShowPaymentModal(null); setPaymentAmount(''); setTransactionId(''); }
    } catch { alert('Failed to process payment'); }
    finally { setIsPaying(false); }
  };

  const fetchPaymentHistory = async (invoiceId: number) => {
    setLoadingHistory(true);
    try {
      const res  = await adminFetch(`/admin/billing/payments?id=${invoiceId}`, { });
      const data = await res.json();
      setPaymentHistory(data.data || []);
    } catch (err) { console.error("Invoice action failed", err); }
    finally { setLoadingHistory(false); }
  };

  const handleShowHistory = (inv: any) => { setShowHistoryModal(inv); fetchPaymentHistory(inv.id); };

  const handleDeletePayment = async (id: number) => {
    if (!confirm('Delete this payment record?')) return;
    try {
      const res = await adminFetch(`/admin/billing/payments/delete?id=${id}`, { method: 'POST', });
      if (res.ok) { if (showHistoryModal) fetchPaymentHistory(showHistoryModal.id); fetchData(); }
    } catch { alert('Failed to delete payment'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this invoice? This action cannot be undone.')) return;
    try {
      const res = await adminFetch(`/admin/billing/delete?id=${id}`, { method: 'POST', });
      if (res.ok) fetchData();
    } catch { alert('Failed to delete invoice'); }
  };

  const handleRunBilling = async () => {
    const period = `${billingModal.selectedMonth} ${billingModal.selectedYear}`;
    setBillingModal(p => ({ ...p, step: 'fetching', processed: 0, total: 0 }));
    try {
      const tenantsRes  = await adminFetch(`/admin/tenants`, { });
      const tenantsData = await tenantsRes.json();
      const activeTenants = tenantsData.data || [];
      setBillingModal(p => ({ ...p, step: 'processing', total: activeTenants.length }));
      let created = 0, skipped = 0;
      const details: any[] = [];
      for (let i = 0; i < activeTenants.length; i++) {
        const tenant = activeTenants[i];
        setBillingModal(p => ({ ...p, currentTenant: tenant.name, processed: i + 1 }));
        try {
          const res  = await adminFetch(`/admin/billing/run-cycle?tenant_id=${tenant.id}&period=${encodeURIComponent(period)}`, { method: 'POST', });
          const data = await res.json();
          if (data.processed > 0) { created++; details.push({ name: tenant.name, status: 'Generated', amount: tenant.monthly_price }); }
          else                    { skipped++; details.push({ name: tenant.name, status: 'Skipped',   reason: 'Already exists' }); }
        } catch {
          skipped++; details.push({ name: tenant.name, status: 'Error', reason: 'Connection failed' });
        }
      }
      setBillingModal(p => ({ ...p, step: 'completed', results: { created, skipped, details } }));
      fetchData();
    } catch { alert('Failed to start billing cycle'); setBillingModal(p => ({ ...p, isOpen: false, step: 'idle' })); }
  };

  const filtered   = invoices.filter(i =>
    i.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const inputCls = "w-full rounded-lg border border-nx-line bg-nx-surface-muted py-2.5 px-3 text-[13px] text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 transition-all";

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Invoices & Payments</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Enterprise billing & financial status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBillingModal(p => ({ ...p, isOpen: true, step: 'idle' }))} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-nx-accent px-3 py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
            <CreditCard size={14} /> Run Billing
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
            <input type="text" placeholder="Search invoices…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="rounded-lg border border-nx-line bg-white py-2 pl-9 pr-3 text-[13px] text-nx-ink placeholder:text-nx-text-subtle w-48 focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white transition-all" />
          </div>
          <button onClick={fetchData} className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Invoices table */}
      <div className="overflow-hidden rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                {['Tenant', 'Plan', 'Invoice', 'Amount', 'Status', 'Email', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i >= 3 && i <= 5 ? 'text-center' : ''} ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[13px] text-nx-text-subtle">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading…
                  </div>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">No invoices found</td></tr>
              ) : pageItems.map(inv => (
                <tr key={inv.id} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nx-accent-soft dark:bg-nx-accent/10">
                        <Building size={14} className="text-nx-accent dark:text-nx-accent-light" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-nx-ink dark:text-white">{inv.tenant_name}</div>
                        <div className="text-[11px] text-nx-text-subtle">ID: {inv.tenant_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md border border-nx-accent-tint bg-nx-accent-soft px-2 py-0.5 text-[11px] font-medium text-nx-accent dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light">
                      {inv.package_name || 'No Plan'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-[12px] font-mono font-semibold text-nx-accent dark:text-nx-accent-light">{inv.invoice_number}</code>
                    <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">{inv.billing_month}</div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 group/amt">
                      <span className="text-[13px] font-semibold text-nx-ink dark:text-white">{inv.currency || 'USD'} {inv.amount}</span>
                      <button onClick={() => handleEditAmount(inv.id, inv.amount)}
                        className="rounded p-1 text-nx-text-subtle hover:text-nx-accent opacity-0 group-hover/amt:opacity-100 transition-all">
                        <Edit2 size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-3.5 text-center">
                    <EmailBadge status={inv.email_status} />
                    {inv.last_sent_at && <div className="mt-0.5 text-[10px] text-nx-text-subtle">{new Date(inv.last_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setShowResendModal(inv)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors" title="Resend"><Mail size={14} /></button>
                      <button onClick={() => handleDownload(inv.id, 'invoice')} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors" title="Download"><FileText size={14} /></button>
                      {inv.status !== 'Paid' ? (
                        <button onClick={() => { setShowPaymentModal(inv); setPaymentAmount(inv.amount); }}
                          className="rounded-md bg-nx-success px-2 py-1 text-[11px] font-medium text-white hover:bg-nx-success transition-colors">
                          Pay
                        </button>
                      ) : (
                        <button onClick={() => handleShowHistory(inv)}
                          className="rounded-md border border-nx-accent-tint bg-nx-accent-soft px-2 py-1 text-[11px] font-medium text-nx-accent hover:bg-nx-accent-tint dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light transition-colors">
                          Details
                        </button>
                      )}
                      <button onClick={() => handleDelete(inv.id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
      </div>

      {/* ── Resend Modal ── */}
      <Modal open={!!showResendModal} onClose={() => setShowResendModal(null)}>
        <div className="w-full max-w-md rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-accent-soft dark:bg-nx-accent/10">
                <Mail size={16} className="text-nx-accent dark:text-nx-accent-light" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Resend Invoice</h3>
                <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">{showResendModal?.invoice_number}</p>
              </div>
            </div>
            <button onClick={() => setShowResendModal(null)} className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"><X size={15} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Building size={13} className="text-nx-text-subtle" />
                <span className="text-[13px] font-medium text-nx-ink dark:text-white">{showResendModal?.tenant_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-nx-text-subtle" />
                <span className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">{showResendModal?.admin_email}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowResendModal(null)} className="flex-1 rounded-lg border border-nx-line py-2.5 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors">Cancel</button>
              <button onClick={() => handleResend(showResendModal?.status === 'Paid' ? 'receipt' : 'invoice')} disabled={isResending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
                {isResending ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                {isResending ? 'Sending…' : showResendModal?.status === 'Paid' ? 'Resend Receipt' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Payment Modal ── */}
      <Modal open={!!showPaymentModal} onClose={() => setShowPaymentModal(null)}>
        <div className="w-full max-w-md rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-success-soft">
                <DollarSign size={16} className="text-nx-success dark:text-nx-success" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Confirm Payment</h3>
                <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">{showPaymentModal?.tenant_name}</p>
              </div>
            </div>
            <button onClick={() => setShowPaymentModal(null)} className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"><X size={15} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 p-4 text-center">
              <p className="text-[11px] text-nx-text-subtle mb-1">Invoice Balance</p>
              <p className="text-2xl font-bold text-nx-ink dark:text-white">{showPaymentModal?.currency || 'USD'} {showPaymentModal?.amount}</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Amount</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className={inputCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                    <option>Bank Transfer</option><option>Cash</option><option>Check</option><option>Online</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Transaction ID</label>
                  <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Optional" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPaymentModal(null)} className="flex-1 rounded-lg border border-nx-line py-2.5 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors">Cancel</button>
              <button onClick={handlePayment} disabled={isPaying}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-success py-2.5 text-[13px] font-medium text-white hover:bg-nx-success transition-colors disabled:opacity-50">
                {isPaying ? <RefreshCcw size={14} className="animate-spin" /> : <DollarSign size={14} />}
                {isPaying ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Payment History Modal ── */}
      <Modal open={!!showHistoryModal} onClose={() => setShowHistoryModal(null)}>
        <div className="w-full max-w-2xl rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-6 py-4">
            <div>
              <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Payment History</h3>
              <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">{showHistoryModal?.invoice_number}</p>
            </div>
            <button onClick={() => setShowHistoryModal(null)} className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"><X size={15} /></button>
          </div>
          <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[13px] text-nx-text-subtle">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading…
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-nx-line dark:border-nx-line-dark py-10 text-center">
                <p className="text-[13px] text-nx-text-muted dark:text-nx-text-subtle">No payment records. Status may have been set manually.</p>
              </div>
            ) : paymentHistory.map(payment => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg border border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 p-4 group">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-success-soft">
                    <CheckCircle size={14} className="text-nx-success dark:text-nx-success" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-nx-ink dark:text-white">{payment.receipt_number}</div>
                    <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">{payment.payment_method} • {new Date(payment.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-nx-ink dark:text-white">${payment.amount}</div>
                    <div className="text-[10px] font-mono text-nx-text-subtle">{payment.transaction_id || '—'}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDownload(showHistoryModal.id, 'receipt')} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors"><Download size={13} /></button>
                    <button onClick={() => { setShowResendModal(showHistoryModal); setShowHistoryModal(null); }} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors"><Send size={13} /></button>
                    <button onClick={() => handleDeletePayment(payment.id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-nx-line dark:border-nx-line-dark px-6 py-4">
            <button onClick={() => setShowHistoryModal(null)} className="rounded-lg border border-nx-line px-4 py-2 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors">Close</button>
          </div>
        </div>
      </Modal>

      {/* ── Billing Cycle Modal ── */}
      {billingModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-accent-soft dark:bg-nx-accent/10">
                  <CreditCard size={16} className="text-nx-accent dark:text-nx-accent-light" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Billing Cycle</h3>
                  <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Generate invoices for all active tenants</p>
                </div>
              </div>
              {billingModal.step === 'idle' && (
                <button onClick={() => setBillingModal(p => ({ ...p, isOpen: false }))} className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"><X size={15} /></button>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {billingModal.step === 'idle' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Month</label>
                      <select value={billingModal.selectedMonth} onChange={e => setBillingModal(p => ({ ...p, selectedMonth: e.target.value }))} className={inputCls}>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Year</label>
                      <select value={billingModal.selectedYear} onChange={e => setBillingModal(p => ({ ...p, selectedYear: e.target.value }))} className={inputCls}>
                        {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBillingModal(p => ({ ...p, isOpen: false }))} className="flex-1 rounded-lg border border-nx-line py-2.5 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors">Cancel</button>
                    <button onClick={handleRunBilling} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors">
                      <CreditCard size={14} /> Run Billing
                    </button>
                  </div>
                </>
              )}

              {(billingModal.step === 'fetching' || billingModal.step === 'processing') && (
                <div className="text-center py-4 space-y-4">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-nx-line border-t-nx-accent" />
                  <div>
                    <p className="text-[14px] font-medium text-nx-ink dark:text-white">
                      {billingModal.step === 'fetching' ? 'Fetching tenants…' : `Processing ${billingModal.processed} / ${billingModal.total}`}
                    </p>
                    {billingModal.currentTenant && (
                      <p className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle mt-1">{billingModal.currentTenant}</p>
                    )}
                  </div>
                  {billingModal.total > 0 && (
                    <div className="rounded-full bg-nx-surface-muted dark:bg-nx-line-dark h-2 overflow-hidden">
                      <div className="h-full bg-nx-accent transition-all" style={{width: `${(billingModal.processed / billingModal.total) * 100}%`}} />
                    </div>
                  )}
                </div>
              )}

              {billingModal.step === 'completed' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-nx-success/30 bg-nx-success-soft p-3 text-center">
                      <div className="text-2xl font-bold text-nx-success dark:text-nx-success">{billingModal.results.created}</div>
                      <div className="text-[11px] text-nx-success dark:text-nx-success">Generated</div>
                    </div>
                    <div className="rounded-lg border border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 p-3 text-center">
                      <div className="text-2xl font-bold text-nx-ink dark:text-white">{billingModal.results.skipped}</div>
                      <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Skipped</div>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {billingModal.results.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-nx-line dark:border-nx-line-dark px-3 py-2">
                        <span className="text-[12px] text-nx-ink dark:text-white">{d.name}</span>
                        <span className={`text-[11px] font-medium ${d.status === 'Generated' ? 'text-nx-success dark:text-nx-success' : d.status === 'Error' ? 'text-nx-danger dark:text-nx-danger' : 'text-nx-text-subtle'}`}>{d.status}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setBillingModal(p => ({ ...p, isOpen: false, step: 'idle' }))} className="w-full rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors">
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

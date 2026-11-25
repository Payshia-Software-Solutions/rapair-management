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
    Cancelled: 'border-nx-line bg-nx-surface-muted text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-nx-text-subtle',
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

const money = (v: unknown) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Read a JSON reply; throw its message when the request failed. */
async function reply(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

type PreviewRow = {
  tenant_id: number; name: string; status: string; package: string | null; cycle: string;
  base_usd: number; currency: string; amount: number | null; billing_month: string; action: 'bill' | 'skip'; reason: string | null;
};
type RunResult = { tenant_id: number; name: string; status: string; reason?: string; invoice_number?: string; amount?: number; currency?: string; email?: string };

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
    isOpen: false, step: 'idle' as 'idle' | 'loading' | 'review' | 'generating' | 'completed',
    selectedMonth: new Date().toLocaleString('en-US', { month: 'long' }),
    selectedYear: new Date().getFullYear().toString(),
    rows: [] as PreviewRow[], selected: [] as number[], dueDate: '', error: '',
    results: [] as RunResult[],
  });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const flash = (type: 'success' | 'error', text: string) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 6000); };

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
      flash('success', (await reply(res)).message);
      fetchData();
    } catch (e) { flash('error', e instanceof Error ? e.message : 'Failed to update invoice'); }
  };

  const handleEditAmount = async (id: number, currentAmount: string) => {
    const newAmount = prompt('Enter new amount:', currentAmount);
    if (newAmount !== null && !isNaN(parseFloat(newAmount))) updateInvoice(id, { amount: parseFloat(newAmount) });
  };

  const handleCancel = async (inv: any) => {
    if (!confirm(`Cancel invoice ${inv.invoice_number}? It stays on record but is no longer due.`)) return;
    updateInvoice(inv.id, { status: 'Cancelled' });
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
      flash('success', (await reply(res)).message);
      fetchData(); setShowResendModal(null);
    } catch (e) { flash('error', e instanceof Error ? e.message : 'Failed to resend email'); }
    finally { setIsResending(false); }
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { alert('Enter the amount received'); return; }
    if (amount > Number(showPaymentModal.balance ?? showPaymentModal.amount) + 0.005) { alert('The amount is more than the balance'); return; }
    setIsPaying(true);
    try {
      const res = await adminFetch(`/admin/billing/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: showPaymentModal.id, amount, payment_method: paymentMethod, transaction_id: transactionId }) });
      flash('success', (await reply(res)).message);
      fetchData(); setShowPaymentModal(null); setPaymentAmount(''); setTransactionId('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to record payment'); }
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
      flash('success', (await reply(res)).message);
      if (showHistoryModal) fetchPaymentHistory(showHistoryModal.id);
      fetchData();
    } catch (e) { flash('error', e instanceof Error ? e.message : 'Failed to delete payment'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this invoice? This cannot be undone. To keep a record, cancel it instead.')) return;
    try {
      const res = await adminFetch(`/admin/billing/delete?id=${id}`, { method: 'POST', });
      flash('success', (await reply(res)).message);
      fetchData();
    } catch (e) { flash('error', e instanceof Error ? e.message : 'Failed to delete invoice'); }
  };

  const periodLabel = `${billingModal.selectedMonth} ${billingModal.selectedYear}`;

  /** Step 1: ask the server who would be billed for the period (nothing is created). */
  const loadPreview = async () => {
    setBillingModal(p => ({ ...p, step: 'loading', error: '' }));
    try {
      const data = await reply(await adminFetch(`/admin/billing/preview?period=${encodeURIComponent(periodLabel)}`, {}));
      const rows: PreviewRow[] = data.data.tenants;
      setBillingModal(p => ({ ...p, step: 'review', rows, dueDate: data.data.due_date,
        selected: rows.filter(r => r.action === 'bill').map(r => r.tenant_id) }));
    } catch (e) { setBillingModal(p => ({ ...p, step: 'idle', error: e instanceof Error ? e.message : 'Could not load the preview' })); }
  };

  /** Step 2: create and email invoices for the ticked tenants. The server re-checks every rule. */
  const handleRunBilling = async () => {
    if (!billingModal.selected.length) return;
    setBillingModal(p => ({ ...p, step: 'generating', error: '' }));
    try {
      const res = await adminFetch(`/admin/billing/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: periodLabel, tenant_ids: billingModal.selected }) });
      const data = await reply(res);
      setBillingModal(p => ({ ...p, step: 'completed', results: data.data.results }));
      fetchData();
    } catch (e) { setBillingModal(p => ({ ...p, step: 'review', error: e instanceof Error ? e.message : 'Billing failed' })); }
  };

  const toggleTenant = (id: number) => setBillingModal(p => ({
    ...p, selected: p.selected.includes(id) ? p.selected.filter(x => x !== id) : [...p.selected, id] }));

  const outstanding = invoices.filter(i => i.status !== 'Cancelled').reduce((acc: Record<string, number>, i) => {
    acc[i.currency || 'USD'] = (acc[i.currency || 'USD'] || 0) + Number(i.balance ?? 0); return acc; }, {});
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;

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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setBillingModal(p => ({ ...p, isOpen: true, step: 'idle', error: '' }))} disabled={loading}
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

      {notice && (
        <div role="status" className={`rounded-lg border px-4 py-2.5 text-[13px] ${notice.type === 'success'
          ? 'border-nx-success/30 bg-nx-success-soft text-nx-success' : 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger'}`}>{notice.text}</div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
          <p className="text-[11px] font-medium uppercase tracking-wider text-nx-text-muted">Outstanding</p>
          <p className="mt-1 text-[15px] font-semibold text-nx-ink dark:text-white">
            {Object.entries(outstanding).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${money(v)}`).join(' · ') || 'Nothing due'}
          </p>
        </div>
        <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
          <p className="text-[11px] font-medium uppercase tracking-wider text-nx-text-muted">Overdue invoices</p>
          <p className={`mt-1 text-[15px] font-semibold ${overdueCount ? 'text-nx-danger' : 'text-nx-ink dark:text-white'}`}>{overdueCount}</p>
        </div>
        <div className="rounded-xl border border-nx-line bg-white p-4 dark:border-nx-line-dark dark:bg-nx-surface-dark">
          <p className="text-[11px] font-medium uppercase tracking-wider text-nx-text-muted">Unpaid invoices</p>
          <p className="mt-1 text-[15px] font-semibold text-nx-ink dark:text-white">{invoices.filter(i => Number(i.balance) > 0).length}</p>
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
                      <span className="text-[13px] font-semibold text-nx-ink dark:text-white">{inv.currency || 'USD'} {money(inv.amount)}</span>
                      <button onClick={() => handleEditAmount(inv.id, inv.amount)} aria-label="Edit amount" 
                        className="rounded p-1 text-nx-text-subtle hover:text-nx-accent opacity-0 group-hover/amt:opacity-100 transition-all">
                        <Edit2 size={11} />
                      </button>
                    </div>
                    {Number(inv.paid_total) > 0 && Number(inv.balance) > 0 && (
                      <div className="text-[11px] text-nx-warning">Paid {money(inv.paid_total)} · Due {money(inv.balance)}</div>
                    )}
                    {inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.due_date && (
                      <div className="text-[10px] text-nx-text-subtle">Due {inv.due_date}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-3.5 text-center">
                    <EmailBadge status={inv.email_status} />
                    {inv.last_sent_at && <div className="mt-0.5 text-[10px] text-nx-text-subtle">{new Date(inv.last_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                      <button onClick={() => setShowResendModal(inv)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors" title="Resend"><Mail size={14} /></button>
                      <button onClick={() => handleDownload(inv.id, 'invoice')} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors" title="Download"><FileText size={14} /></button>
                      {inv.status !== 'Cancelled' && Number(inv.balance) > 0 && (
                        <button onClick={() => { setShowPaymentModal(inv); setPaymentAmount(String(inv.balance)); }}
                          className="rounded-md bg-nx-success px-2 py-1 text-[11px] font-medium text-white hover:bg-nx-success transition-colors">
                          Pay
                        </button>
                      )}
                      {Number(inv.payment_count) > 0 && (
                        <button onClick={() => handleShowHistory(inv)}
                          className="rounded-md border border-nx-accent-tint bg-nx-accent-soft px-2 py-1 text-[11px] font-medium text-nx-accent hover:bg-nx-accent-tint dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light transition-colors">
                          Payments
                        </button>
                      )}
                      {inv.status !== 'Cancelled' && Number(inv.payment_count) === 0 && (
                        <button onClick={() => handleCancel(inv)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors" title="Cancel invoice" aria-label="Cancel invoice"><X size={14} /></button>
                      )}
                      {Number(inv.payment_count) === 0 && (
                        <button onClick={() => handleDelete(inv.id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors" title="Delete" aria-label="Delete invoice"><Trash2 size={14} /></button>
                      )}
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
              <button onClick={() => handleResend(Number(showResendModal?.balance) > 0 ? 'invoice' : 'receipt')} disabled={isResending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
                {isResending ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                {isResending ? 'Sending…' : Number(showResendModal?.balance) > 0 ? 'Send Reminder' : 'Resend Receipt'}
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
              <p className="text-[11px] text-nx-text-subtle mb-1">Balance due · {showPaymentModal?.invoice_number}</p>
              <p className="text-2xl font-bold text-nx-ink dark:text-white">{showPaymentModal?.currency || 'USD'} {money(showPaymentModal?.balance ?? showPaymentModal?.amount)}</p>
              {Number(showPaymentModal?.paid_total) > 0 && (
                <p className="mt-1 text-[11px] text-nx-text-muted">Invoice {money(showPaymentModal?.amount)} · already paid {money(showPaymentModal?.paid_total)}</p>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Amount received (part payments are fine)</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className={inputCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                    <option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Card</option><option>Online</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle">Reference</label>
                  <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Optional" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPaymentModal(null)} className="flex-1 rounded-lg border border-nx-line py-2.5 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors">Cancel</button>
              <button onClick={handlePayment} disabled={isPaying}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-success py-2.5 text-[13px] font-medium text-white hover:bg-nx-success transition-colors disabled:opacity-50">
                {isPaying ? <RefreshCcw size={14} className="animate-spin" /> : <DollarSign size={14} />}
                {isPaying ? 'Saving…' : 'Record Payment'}
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
                <p className="text-[13px] text-nx-text-muted dark:text-nx-text-subtle">No payments recorded for this invoice.</p>
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
                    <div className="text-[14px] font-semibold text-nx-ink dark:text-white">{showHistoryModal?.currency} {money(payment.amount)}</div>
                    <div className="text-[10px] font-mono text-nx-text-subtle">{payment.transaction_id || '—'}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDownload(showHistoryModal.id, `receipt&payment_id=${payment.id}`)} title="Download receipt" aria-label="Download receipt"  className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors"><Download size={13} /></button>
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

      {/* ── Billing Run Modal: choose period → review → generate ── */}
      {billingModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-nx-line bg-white shadow-2xl dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-accent-soft dark:bg-nx-accent/10">
                  <CreditCard size={16} className="text-nx-accent dark:text-nx-accent-light" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-nx-ink dark:text-white">Run Billing · {periodLabel}</h3>
                  <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Review who will be invoiced before anything is created or emailed</p>
                </div>
              </div>
              {billingModal.step !== 'generating' && (
                <button onClick={() => setBillingModal(p => ({ ...p, isOpen: false, step: 'idle' }))} aria-label="Close" className="rounded-lg p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"><X size={15} /></button>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {billingModal.error && <p role="alert" className="rounded-lg border border-nx-danger/30 bg-nx-danger-soft px-3 py-2 text-[12px] text-nx-danger">{billingModal.error}</p>}

              {(billingModal.step === 'idle' || billingModal.step === 'loading') && (
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
                        {[0, 1, 2].map(o => new Date().getFullYear() - 1 + o).map(y => <option key={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">
                    Active tenants on paid plans are invoiced once per month (yearly plans once every 12 months). Trials, suspended tenants, free plans and anyone already invoiced for the period are skipped.
                  </p>
                  <button onClick={loadPreview} disabled={billingModal.step === 'loading'}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
                    {billingModal.step === 'loading' ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />}
                    {billingModal.step === 'loading' ? 'Checking tenants…' : 'Review tenants'}
                  </button>
                </>
              )}

              {(billingModal.step === 'review' || billingModal.step === 'generating') && (
                <>
                  <div className="divide-y divide-nx-surface-muted rounded-lg border border-nx-line dark:divide-nx-line-dark dark:border-nx-line-dark">
                    {billingModal.rows.map(r => (
                      <label key={r.tenant_id} className={`flex items-start gap-3 px-3 py-2.5 ${r.action === 'bill' ? 'cursor-pointer' : 'opacity-60'}`}>
                        <input type="checkbox" className="mt-1" disabled={r.action !== 'bill' || billingModal.step === 'generating'}
                          checked={billingModal.selected.includes(r.tenant_id)} onChange={() => toggleTenant(r.tenant_id)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-nx-ink dark:text-white">{r.name}</span>
                          <span className="block text-[11px] text-nx-text-muted dark:text-nx-text-subtle">
                            {r.package || 'No plan'} · {r.cycle}{r.action === 'skip' ? ` · ${r.reason}` : ` · ${r.billing_month}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[12px] font-semibold text-nx-ink dark:text-white">
                          {r.action === 'bill' && r.amount !== null ? `${r.currency} ${money(r.amount)}` : <span className="font-normal text-nx-text-subtle">Skipped</span>}
                          {r.action === 'bill' && r.currency !== 'USD' && <span className="block text-[10px] font-normal text-nx-text-subtle">USD {money(r.base_usd)}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">
                    {billingModal.selected.length} invoice{billingModal.selected.length === 1 ? '' : 's'} will be created, due {billingModal.dueDate}, and emailed to each tenant.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setBillingModal(p => ({ ...p, step: 'idle' }))} disabled={billingModal.step === 'generating'}
                      className="flex-1 rounded-lg border border-nx-line py-2.5 text-[13px] font-medium text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark transition-colors disabled:opacity-50">Back</button>
                    <button onClick={handleRunBilling} disabled={!billingModal.selected.length || billingModal.step === 'generating'}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors disabled:opacity-50">
                      {billingModal.step === 'generating' ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                      {billingModal.step === 'generating' ? 'Creating and emailing…' : `Create ${billingModal.selected.length} invoice${billingModal.selected.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </>
              )}

              {billingModal.step === 'completed' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-nx-success/30 bg-nx-success-soft p-3 text-center">
                      <div className="text-2xl font-bold text-nx-success">{billingModal.results.filter(r => r.status === 'Generated').length}</div>
                      <div className="text-[11px] text-nx-success">Created</div>
                    </div>
                    <div className="rounded-lg border border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 p-3 text-center">
                      <div className="text-2xl font-bold text-nx-ink dark:text-white">{billingModal.results.filter(r => r.status !== 'Generated').length}</div>
                      <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Skipped or failed</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {billingModal.results.map(d => (
                      <div key={d.tenant_id} className="flex items-center justify-between gap-3 rounded-lg border border-nx-line dark:border-nx-line-dark px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] text-nx-ink dark:text-white">{d.name}</span>
                          <span className="block text-[11px] text-nx-text-muted">
                            {d.status === 'Generated' ? `${d.invoice_number} · ${d.currency} ${money(d.amount)}${d.email === 'Sent' ? ' · emailed' : ' · email failed, resend from the list'}` : d.reason}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[11px] font-medium ${d.status === 'Generated' ? 'text-nx-success' : d.status === 'Error' ? 'text-nx-danger' : 'text-nx-text-subtle'}`}>{d.status}</span>
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

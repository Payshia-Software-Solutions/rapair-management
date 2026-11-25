"use client";

import { adminFetch } from '@/lib/adminApi';
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCcw, Search, Download, Send, CheckCircle, Building, Trash2 } from 'lucide-react';
import Pagination from '@/components/Pagination';

export default function PaymentHistoryPage() {
  const [payments,    setPayments]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await adminFetch(`/admin/billing/payments/all`, { });
      const data = await res.json();
      setPayments(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const handleDownload = (invoiceId: number) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/admin/billing/download?id=${invoiceId}&type=receipt`;
    a.setAttribute('download', '');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm('Delete this payment record? This will revert the invoice status if it was the last payment.')) return;
    try {
      const res = await adminFetch(`/admin/billing/payments/delete?id=${id}`, { method: 'POST', });
      if (res.ok) fetchData();
    } catch { alert('Failed to delete payment'); }
  };

  const handleResend = async (invoiceId: number) => {
    try {
      const res = await adminFetch(`/admin/billing/resend?id=${invoiceId}&type=receipt`, { });
      if (res.ok) alert('Receipt resent successfully');
    } catch { alert('Failed to resend receipt'); }
  };

  const filtered   = payments.filter(p =>
    p.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Payment History</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Record of enterprise transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
            <input type="text" placeholder="Search payments…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="rounded-lg border border-nx-line bg-white py-2 pl-9 pr-3 text-[13px] text-nx-ink placeholder:text-nx-text-subtle w-56 focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white transition-all" />
          </div>
          <button onClick={fetchData} className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                {['Transaction', 'Tenant', 'Amount & Date', 'Method', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[13px] text-nx-text-subtle">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading…
                  </div>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">No payment records found</td></tr>
              ) : pageItems.map(p => (
                <tr key={p.id} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nx-success-soft">
                        <CheckCircle size={15} className="text-nx-success dark:text-nx-success" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-nx-ink dark:text-white">{p.receipt_number}</div>
                        <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle font-mono">Inv: {p.invoice_number}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Building size={12} className="text-nx-text-subtle" />
                      <span className="text-[13px] text-nx-ink dark:text-white">{p.tenant_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] font-semibold text-nx-ink dark:text-white">{p.currency || 'USD'} {p.amount}</div>
                    <div className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">{new Date(p.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md border border-nx-accent-tint bg-nx-accent-soft px-2 py-0.5 text-[11px] font-medium text-nx-accent dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDownload(p.invoice_id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark transition-colors" title="Download"><Download size={14} /></button>
                      <button onClick={() => handleResend(p.invoice_id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-success-soft hover:text-nx-success transition-colors" title="Resend"><Send size={14} /></button>
                      <button onClick={() => handleDeletePayment(p.id)} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
      </div>
    </div>
  );
}

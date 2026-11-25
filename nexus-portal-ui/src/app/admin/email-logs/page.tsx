"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Search, CheckCircle, XCircle, Clock, Building, FileText, Eye, X } from 'lucide-react';
import Pagination from '@/components/Pagination';

function StatusBadge({ status }: { status: string }) {
  const sent = status.includes('Sent') || status === 'Resent';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      sent
        ? 'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success'
        : 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger dark:border-nx-danger/30 dark:text-nx-danger'
    }`}>
      {sent ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {status}
    </span>
  );
}

export default function EmailLogsPage() {
  const [logs,         setLogs]         = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [selectedLog,  setSelectedLog]  = useState<any | null>(null);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await adminFetch(`/admin/billing/email-logs`, { });
      const data = await res.json();
      setLogs(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filtered  = logs.filter(l =>
    l.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Communication Log</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Audit trail of system-dispatched messages</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
            <input type="text" placeholder="Search logs…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
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
                {['Type & ID', 'Subject', 'Recipient', 'Status', 'Time', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i === 3 ? 'text-center' : ''} ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[13px] text-nx-text-subtle">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading…
                  </div>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">No email logs found</td></tr>
              ) : pageItems.map((log, idx) => (
                <tr key={`${log.id}-${idx}`} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        log.email_type === 'Receipt' ? 'bg-nx-success-soft dark:bg-nx-success-soft' :
                        log.email_type === 'Broadcast' ? 'bg-nx-accent-soft dark:bg-nx-accent/10' : 'bg-nx-surface-muted dark:bg-nx-line-dark'
                      }`}>
                        <FileText size={14} className={
                          log.email_type === 'Receipt' ? 'text-nx-success dark:text-nx-success' :
                          log.email_type === 'Broadcast' ? 'text-nx-accent dark:text-nx-accent-light' : 'text-nx-text-muted'
                        } />
                      </div>
                      <div>
                        <div className="text-[12px] font-mono font-semibold text-nx-ink dark:text-white">
                          {log.invoice_number === 'GENERIC' ? 'BROADCAST' : `#${log.invoice_number}`}
                        </div>
                        <div className="text-[11px] text-nx-text-subtle">{log.email_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] text-nx-ink dark:text-white truncate max-w-[200px]">{log.subject || 'No Subject'}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building size={10} className="text-nx-text-subtle" />
                      <span className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle truncate max-w-[160px]">{log.tenant_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Mail size={11} className="text-nx-text-subtle shrink-0" />
                      <span className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle truncate max-w-[160px]">{log.recipient}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <StatusBadge status={log.status} />
                    {log.error_message && (
                      <div className="mt-0.5 text-[10px] text-nx-danger truncate max-w-[120px] mx-auto">{log.error_message}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="text-[13px] font-medium text-nx-ink dark:text-white">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[11px] text-nx-text-subtle">
                      {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => log.body && setSelectedLog(log)}
                      disabled={!log.body}
                      className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
      </div>

      {/* Email Preview Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative z-10 flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-xl border border-nx-line bg-white shadow-2xl dark:border-nx-line-dark dark:bg-nx-surface-dark">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark bg-nx-ink px-6 py-4">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-nx-accent-light" />
                <div>
                  <h3 className="text-[13px] font-semibold text-white">Email Preview</h3>
                  <p className="text-[11px] text-nx-text-strong">{selectedLog.email_type} → {selectedLog.recipient}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rounded-lg p-1.5 text-nx-text-strong hover:bg-white/10 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            {/* Meta */}
            <div className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 px-6 py-3 space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-nx-text-subtle w-14">Subject</span>
                <span className="text-[13px] font-medium text-nx-ink dark:text-white">{selectedLog.subject || 'No Subject'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-nx-text-subtle w-14">To</span>
                <span className="text-[13px] text-nx-text-muted dark:text-nx-text-subtle">{selectedLog.recipient}</span>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-white p-6 dark:bg-nx-ink">
              <div className="prose dark:prose-invert max-w-none text-[#374151] dark:text-[#c9d1d9] text-sm" dangerouslySetInnerHTML={{ __html: selectedLog.body }} />
            </div>
            {/* Footer */}
            <div className="flex justify-end border-t border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark-2 px-6 py-3">
              <button onClick={() => setSelectedLog(null)} className="rounded-lg border border-nx-line bg-white px-4 py-2 text-[13px] font-medium text-nx-ink hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white dark:hover:bg-nx-line-dark-strong transition-colors">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

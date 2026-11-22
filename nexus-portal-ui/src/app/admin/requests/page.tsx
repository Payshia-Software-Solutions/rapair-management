"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCcw, Search, MoreVertical } from 'lucide-react';
import Pagination from '@/components/Pagination';

/* ── tiny reusable badge ─────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending:  'bg-nx-warning-soft  text-nx-warning  border-nx-warning/30  dark:bg-nx-warning-soft dark:border-nx-warning/30',
    Approved: 'bg-nx-success-soft  text-nx-success  border-nx-success/30  dark:bg-nx-success-soft dark:border-nx-success/30',
    Rejected: 'bg-nx-danger-soft    text-nx-danger    border-nx-danger/30    dark:bg-nx-danger-soft     dark:border-nx-danger/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>
      {status === 'Pending'  && <Clock      size={10} />}
      {status === 'Approved' && <CheckCircle2 size={10} />}
      {status === 'Rejected' && <XCircle    size={10} />}
      {status}
    </span>
  );
}

export default function ERPRequestsPage() {
  const [requests,     setRequests]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await adminFetch(`/admin/requests`, { });
      const data = await res.json();
      setRequests(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filtered = requests.filter(r =>
    r.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 space-y-5">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">ERP Requests</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">
            Manage enterprise deployment pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
            <input
              type="text"
              placeholder="Search company or email…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="
                rounded-lg border border-nx-line bg-white py-2 pl-9 pr-3
                text-[13px] text-nx-ink placeholder:text-nx-text-subtle w-60
                focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20
                dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white
                transition-all
              "
            />
          </div>
          <button
            onClick={fetchData}
            className="flex items-center justify-center rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                {['Company & Contact', 'Type', 'Date', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i === 3 ? 'text-center' : ''} ${i === 4 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" />
                      Loading requests…
                    </div>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">
                    No requests found
                  </td>
                </tr>
              ) : pageItems.map(req => (
                <tr key={req.id} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] font-medium text-nx-ink dark:text-white">{req.company_name}</div>
                    <div className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">{req.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md border border-nx-line bg-nx-surface-muted px-2 py-0.5 text-[11px] font-medium text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-nx-text-subtle">
                      {req.business_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">
                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-success-soft hover:text-nx-success transition-colors" title="Approve">
                        <CheckCircle2 size={14} />
                      </button>
                      <button className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors" title="Reject">
                        <XCircle size={14} />
                      </button>
                      <button className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors">
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
}

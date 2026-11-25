"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCcw, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';

export default function PackagesPage() {
  const [packages,    setPackages]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await adminFetch(`/admin/packages`, { });
      const data = await res.json();
      setPackages(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const pageItems  = packages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(packages.length / itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">License Packages</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Manage subscription tiers & access</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/admin/packages/create">
            <button className="flex items-center gap-1.5 rounded-lg bg-nx-accent px-3 py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors">
              <Plus size={14} /> Create Tier
            </button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                {['Package', 'Price', 'Modules', 'Services', 'Infrastructure', 'Status', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i === 5 ? 'text-center' : ''} ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[13px] text-nx-text-subtle">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading packages…
                  </div>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-[13px] text-nx-text-subtle">No packages found</td></tr>
              ) : pageItems.map(pkg => (
                <tr key={pkg.id} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5 text-[13px] font-medium text-nx-ink dark:text-white">{pkg.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-nx-accent dark:text-nx-accent-light">${pkg.monthly_price}</span>
                    <span className="text-[11px] text-nx-text-subtle ml-0.5">/mo</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {(() => {
                      let mods: string[] = [];
                      try {
                        mods = typeof pkg.modules === 'string' ? JSON.parse(pkg.modules || '[]') : (pkg.modules || []);
                      } catch { mods = []; }

                      if (mods.includes('*')) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-md border border-nx-accent/20 bg-nx-accent/10 px-2 py-0.5 text-[11px] font-bold text-nx-accent dark:text-nx-accent-light">
                            Full Suite (All 15)
                          </span>
                        );
                      }

                      return (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          <span className="rounded-md border border-nx-line bg-nx-surface-muted px-2 py-0.5 text-[11px] font-bold text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white">
                            {mods.length} Modules
                          </span>
                          {mods.slice(0, 3).map((m: string) => (
                            <span key={m} className="rounded border border-nx-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-nx-text-subtle">
                              {m}
                            </span>
                          ))}
                          {mods.length > 3 && (
                            <span className="text-[10px] text-nx-text-subtle self-center">+{mods.length - 3} more</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {JSON.parse(pkg.services || '[]').map((s: string) => (
                        <span key={s} className="rounded border border-[#bbf7d0] bg-nx-success-soft px-1.5 py-0.5 text-[10px] font-medium text-nx-success dark:border-nx-success/30 dark:text-nx-success">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-nx-accent" />
                      <span className="text-[12px] font-mono text-nx-text-muted dark:text-nx-text-subtle truncate max-w-[120px]">{pkg.server_info || 'Cloud Std'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      pkg.is_public == 1
                        ? 'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success'
                        : 'border-nx-line bg-nx-surface-muted text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-nx-text-subtle'
                    }`}>
                      {pkg.is_public == 1 ? <Eye size={11} /> : <EyeOff size={11} />}
                      {pkg.is_public == 1 ? 'Public' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/admin/packages/edit/${pkg.id}`} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-accent-soft hover:text-nx-accent dark:hover:bg-nx-accent/10 transition-colors" title="Edit">
                        <Edit size={14} />
                      </Link>
                      <button onClick={async () => {
                        if (confirm('Delete this package?')) {
                          await adminFetch(`/admin/packages/delete`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: pkg.id}) });
                          fetchData();
                        }
                      }} className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={packages.length} itemsPerPage={itemsPerPage} />
      </div>
    </div>
  );
}

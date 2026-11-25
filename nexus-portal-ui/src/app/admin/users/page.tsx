"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Trash2, RefreshCcw, Plus, Loader2 } from 'lucide-react';
import Pagination from '@/components/Pagination';

export default function UsersPage() {
  const [users,       setUsers]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    try {
      const authRes = await adminFetch(`/auth/check`, { });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.role !== 'super_admin') { router.push('/admin/dashboard'); return; }
      } else { router.push('/admin/login'); return; }
      const res  = await adminFetch(`/admin/users`, { });
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const deleteUser = async (u: any) => {
    if (!window.confirm(`Delete the account ${u.full_name} (@${u.username})? They will no longer be able to sign in. This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      const res = await adminFetch('/admin/users/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') alert(data.message || 'Could not delete the account.');
      else await fetchData();
    } catch { alert('Could not reach the server.'); }
    finally { setDeletingId(null); }
  };

  const pageItems  = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(users.length / itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Client Accounts</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">Manage enterprise identities</p>
        </div>
        <button onClick={fetchData} className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
          <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Create user form */}
        <div className="rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark p-5 h-fit">
          <div className="mb-4 flex items-center gap-2 pb-3 border-b border-nx-surface-muted dark:border-nx-line-dark">
            <UserCheck size={14} className="text-nx-accent dark:text-nx-accent-light" />
            <h3 className="text-[13px] font-semibold text-nx-ink dark:text-white">Authorize Account</h3>
          </div>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            const res = await adminFetch(`/admin/users/create`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            if (res.ok) { alert('Account provisioned successfully'); (e.target as HTMLFormElement).reset(); fetchData(); }
          }}>
            <div>
              <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle mb-1.5">Username</label>
              <input name="username" required type="text"
                className="w-full rounded-lg border border-nx-line bg-nx-surface-muted py-2 px-3 text-[13px] text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white outline-none focus:border-nx-accent focus:ring-2 focus:ring-nx-accent/20 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-nx-text-muted dark:text-nx-text-subtle mb-1.5">Password</label>
              <input name="password" required type="password"
                className="w-full rounded-lg border border-nx-line bg-nx-surface-muted py-2 px-3 text-[13px] text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white outline-none focus:border-nx-accent focus:ring-2 focus:ring-nx-accent/20 transition-all" />
            </div>
            <button type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-nx-accent py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong transition-colors mt-1">
              <Plus size={14} /> Create Account
            </button>
          </form>
        </div>

        {/* Users table */}
        <div className="lg:col-span-3 overflow-hidden rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
          <div className="flex items-center justify-between border-b border-nx-line dark:border-nx-line-dark px-5 py-3.5">
            <h3 className="text-[13px] font-semibold text-nx-ink dark:text-white">Verified Directory</h3>
            <span className="rounded-md border border-nx-accent-tint bg-nx-accent-soft px-2 py-0.5 text-[11px] font-medium text-nx-accent dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light">
              {users.length} Active
            </span>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-nx-line dark:border-nx-line-dark bg-nx-surface-soft dark:bg-nx-surface-dark">
                {['Identity', 'Role', 'Tenant', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-[13px] text-nx-text-subtle">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading…
                  </div>
                </td></tr>
              ) : pageItems.map(u => (
                <tr key={u.id} className="group hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nx-accent text-[12px] font-bold text-white">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-nx-ink dark:text-white">{u.full_name}</div>
                        <div className="text-[11px] font-mono text-nx-text-muted dark:text-nx-text-subtle">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      u.role === 'super_admin'
                        ? 'border border-nx-warning/30 bg-nx-warning-soft text-nx-warning dark:text-nx-warning'
                        : 'border border-nx-accent-tint bg-nx-accent-soft text-nx-accent dark:border-nx-accent/20 dark:bg-nx-accent/10 dark:text-nx-accent-light'
                    }`}>
                      {u.role === 'super_admin' ? 'Super Admin' : 'Client'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] text-nx-ink dark:text-white truncate max-w-[150px]">{u.tenant_name || '—'}</div>
                    <div className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle">
                      {u.tenant_status === 'Deleted' ? <span className="text-nx-danger">Tenant deleted</span> : u.tenant_id && !u.tenant_name ? <span className="text-nx-danger">Tenant missing</span> : u.tenant_name ? 'Enterprise' : 'System'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {u.deletable ? (
                      <button type="button" onClick={() => void deleteUser(u)} disabled={deletingId === u.id}
                        aria-label={`Delete account ${u.full_name}`} title="Delete account (not linked to a tenant)"
                        className="inline-flex items-center gap-1.5 rounded-md border border-nx-danger/30 px-2.5 py-1 text-[11px] font-semibold text-nx-danger hover:bg-nx-danger-soft disabled:opacity-60 transition-colors">
                        {deletingId === u.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                        Delete
                      </button>
                    ) : (
                      <span className="text-[11px] text-nx-text-subtle" title={u.delete_blocked_reason || ''}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={users.length} itemsPerPage={itemsPerPage} />
        </div>
      </div>
    </div>
  );
}

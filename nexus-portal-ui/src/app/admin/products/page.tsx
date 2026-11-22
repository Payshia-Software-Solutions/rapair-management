"use client";

import React, { useEffect, useState } from 'react';
import { Boxes, Plus, Pencil, Trash2, Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { adminApi, inputCls, cardCls, newSecret, errMsg } from '@/lib/adminApi';

type Product = {
  id: number; product_key: string; name: string; description: string | null;
  provision_url: string | null; workspace_domain: string | null; is_active: number | string;
  has_secret: number | string; package_count: number | string;
};
type Pkg = { id: number; name: string; package_key: string; product_id: number | string | null };

const empty = { id: 0, product_key: '', name: '', description: '', provision_url: '', webhook_secret: '', workspace_domain: '', is_active: true };

/**
 * Products Nexus sells. A product with a provisioning URL + secret gets workspaces created and
 * updated automatically for tenants on its shared deployment. Others are billing-only.
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [tick, setTick] = useState(0);
  const load = () => setTick(x => x + 1);

  // Escape to close the modal; also stops the page scrolling behind it
  useEffect(() => {
    if (!form) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) setForm(null); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [form, saving]);

  useEffect(() => {
    let alive = true;
    Promise.all([adminApi<Product[]>('/admin/products'), adminApi<Pkg[]>('/admin/packages')])
      .then(([p, k]) => { if (alive) { setProducts(p); setPackages(k); } })
      .catch((e: unknown) => { if (alive) { setError(errMsg(e)); setProducts([]); } });
    return () => { alive = false; };
  }, [tick]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi('/admin/products/save', { ...form, id: form.id || undefined, is_active: form.is_active ? 1 : 0 });
      setForm(null);
      await load();
    } catch (err: unknown) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try { await adminApi('/admin/products/delete', { id: p.id }); await load(); }
    catch (e: unknown) { alert(errMsg(e)); }
  };

  const setPackageProduct = async (pkg: Pkg, productId: string) => {
    try {
      await adminApi('/admin/packages/set-product', { package_id: pkg.id, product_id: productId ? Number(productId) : null });
      setPackages(prev => prev.map(x => x.id === pkg.id ? { ...x, product_id: productId || null } : x));
    } catch (e: unknown) { alert(errMsg(e)); }
  };

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Boxes size={20} /> Products</h1>
          <p className="mt-1 text-[13px] text-nx-text-muted">
            What you sell. Products with a provisioning URL create and update customer workspaces automatically.
          </p>
        </div>
        <button
          onClick={() => { setForm({ ...empty }); setError(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-nx-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong"
        >
          <Plus size={15} /> New product
        </button>
      </div>

      {error && !form && <p role="alert" className="text-[13px] text-nx-danger">{error}</p>}

      <div className={`${cardCls} divide-y divide-nx-line dark:divide-nx-line-dark`}>
        {products === null ? (
          <div className="flex items-center gap-2 p-5 text-[13px] text-nx-text-subtle"><Loader2 size={15} className="animate-spin" /> Loading…</div>
        ) : products.length === 0 ? (
          <p className="p-5 text-[13px] text-nx-text-muted">No products yet. Run the products migration on the server first.</p>
        ) : products.map(p => {
          const automatic = !!p.provision_url && Number(p.has_secret) === 1;
          return (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <code className="rounded bg-nx-surface-muted px-1.5 py-0.5 text-[11px] dark:bg-nx-line-dark">{p.product_key}</code>
                  {Number(p.is_active) !== 1 && <span className="rounded bg-nx-surface-muted px-1.5 py-0.5 text-[11px] text-nx-text-muted dark:bg-nx-line-dark">Inactive</span>}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${automatic ? 'bg-nx-success-soft text-nx-success dark:bg-nx-success dark:text-nx-success' : 'bg-nx-surface-muted text-nx-text-muted dark:bg-nx-line-dark'}`}>
                    {automatic ? 'Automatic workspaces' : 'Billing only'}
                  </span>
                </div>
                {p.description && <p className="mt-1 text-[13px] text-nx-text-muted">{p.description}</p>}
                <p className="mt-1 text-[12px] text-nx-text-subtle break-all">
                  {p.provision_url || 'No provisioning URL'}{p.workspace_domain ? ` · workspaces at *.${p.workspace_domain}` : ''} · {p.package_count} package(s)
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setError(null); setForm({ id: p.id, product_key: p.product_key, name: p.name, description: p.description || '', provision_url: p.provision_url || '', webhook_secret: '', workspace_domain: p.workspace_domain || '', is_active: Number(p.is_active) === 1 }); }}
                  className="rounded-lg p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark" aria-label={`Edit ${p.name}`}
                ><Pencil size={15} /></button>
                <button onClick={() => void remove(p)} className="rounded-lg p-2 text-nx-text-muted hover:bg-nx-danger-soft hover:text-nx-danger dark:hover:bg-nx-danger" aria-label={`Delete ${p.name}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm sm:items-center sm:pt-4"
          role="dialog" aria-modal="true" aria-labelledby="product-form-title"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setForm(null); }}
        >
        <form onSubmit={save} className={`${cardCls} w-full max-w-2xl space-y-4 p-4 shadow-xl sm:p-5`}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="product-form-title" className="font-medium">{form.id ? 'Edit product' : 'New product'}</h2>
            <button type="button" onClick={() => setForm(null)} aria-label="Close" className="-m-1 rounded-md p-1 text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:hover:bg-nx-line-dark dark:hover:text-white">
              ✕
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[13px]">
              <span className="mb-1.5 block font-medium">Name</span>
              <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="block text-[13px]">
              <span className="mb-1.5 block font-medium">Key</span>
              <input className={inputCls} value={form.product_key} onChange={e => setForm({ ...form, product_key: e.target.value })} placeholder="bizzflow" required />
            </label>
          </div>
          <label className="block text-[13px]">
            <span className="mb-1.5 block font-medium">Description</span>
            <input className={inputCls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="block text-[13px]">
            <span className="mb-1.5 block font-medium">Provisioning URL</span>
            <input className={inputCls} value={form.provision_url} onChange={e => setForm({ ...form, provision_url: e.target.value })} placeholder="https://api.bizzflow.nebulync.com/server/public/provision.php" />
            <span className="mt-1 block text-[12px] text-nx-text-subtle">Leave empty for billing-only products (nothing is sent).</span>
          </label>
          <label className="block text-[13px]">
            <span className="mb-1.5 block font-medium">Webhook secret</span>
            <div className="flex gap-2">
              <input className={`${inputCls} font-mono`} value={form.webhook_secret} onChange={e => setForm({ ...form, webhook_secret: e.target.value })}
                placeholder={form.id ? 'Leave empty to keep the current secret' : 'Same value as TENANCY_WEBHOOK_SECRET on the product server'} />
              <button type="button" onClick={() => setForm({ ...form, webhook_secret: newSecret() })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-nx-line px-3 text-[13px] hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark">
                <KeyRound size={14} /> Generate
              </button>
              {form.webhook_secret && (
                <button type="button" aria-label="Copy secret"
                  onClick={() => { void navigator.clipboard.writeText(form.webhook_secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="inline-flex shrink-0 items-center rounded-lg border border-nx-line px-3 hover:bg-nx-surface-muted dark:border-nx-line-dark dark:hover:bg-nx-line-dark">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
            </div>
            <span className="mt-1 block text-[12px] text-nx-text-subtle">Copy it into the product server&apos;s config before saving. It is not shown again.</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[13px]">
              <span className="mb-1.5 block font-medium">Workspace domain</span>
              <input className={inputCls} value={form.workspace_domain} onChange={e => setForm({ ...form, workspace_domain: e.target.value })} placeholder="bizzflow.nebulync.com" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2.5 text-[13px]">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
          {error && <p role="alert" className="text-[13px] text-nx-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setForm(null)} disabled={saving} className="rounded-lg border border-nx-line px-3.5 py-2 text-[13px] dark:border-nx-line-dark hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-nx-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-nx-accent-strong disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </form>
        </div>
      )}

      <div className={cardCls}>
        <div className="border-b border-nx-line p-4 dark:border-nx-line-dark sm:px-5">
          <h2 className="font-medium">Packages</h2>
          <p className="mt-0.5 text-[13px] text-nx-text-muted">Which product each package belongs to. Packages with no product work exactly as before.</p>
        </div>
        <div className="divide-y divide-nx-line dark:divide-nx-line-dark">
          {packages.map(k => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{k.name}</div>
                <code className="text-[11px] text-nx-text-subtle">{k.package_key}</code>
              </div>
              <select
                value={k.product_id ? String(k.product_id) : ''}
                onChange={e => void setPackageProduct(k, e.target.value)}
                className={`${inputCls} w-full sm:w-56`}
                aria-label={`Product for ${k.name}`}
              >
                <option value="">No product</option>
                {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

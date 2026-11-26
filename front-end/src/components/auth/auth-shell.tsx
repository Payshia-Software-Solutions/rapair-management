"use client"

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Layers,
  Lock,
  Monitor,
  Moon,
  Receipt,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { applyTheme, getTheme, nextTheme, THEME_EVENT, type AppTheme } from '@/lib/theme';
import { tenantHost, tenantSlug } from '@/lib/tenant';

const CAPABILITIES = [
  {
    icon: Layers,
    title: 'Operations & inventory synced',
    text: 'POS, orders, stock transfers and procurement connected in real time.',
  },
  {
    icon: Receipt,
    title: 'Automated invoicing & ledger',
    text: 'Quotes, receipts, taxes and double-entry accounting stay balanced.',
  },
  {
    icon: ShieldCheck,
    title: 'Granular role-based security',
    text: 'Branch-level permissions, approval rules and full audit trails.',
  },
];

interface WorkspaceInfo {
  mode?: 'shared' | 'single';
  slug?: string;
  name?: string;
}

/**
 * Split-screen layout shared by sign-in, forgot-password and reset-password pages.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [theme, setTheme] = useState<AppTheme>('light');
  const [mounted, setMounted] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);

  useEffect(() => {
    setMounted(true);
    setTheme(getTheme());
    const onTheme = (e: Event) => {
      const detail = (e as CustomEvent<AppTheme>).detail;
      if (detail) setTheme(detail);
      else setTheme(getTheme());
    };
    window.addEventListener(THEME_EVENT, onTheme);

    // Fetch public workspace metadata in shared SaaS mode (falls back gracefully)
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/workspace/info`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setWorkspace(json.data);
      })
      .catch(() => {});

    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, []);

  const handleToggleTheme = () => {
    const next = nextTheme(theme);
    applyTheme(next);
    setTheme(next);
  };

  const host = mounted ? tenantHost() : null;
  const slug = mounted ? (workspace?.slug || tenantSlug()) : null;
  const workspaceName =
    workspace?.name ||
    (slug
      ? slug
          .split(/[-_]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : null);

  const ThemeIcon = !mounted ? Sun : theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = !mounted ? 'Theme' : theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Dim';

  return (
    <div className="relative min-h-screen grid lg:grid-cols-12 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* ── LEFT BRAND & PRODUCT SHOWCASE PANEL ─────────────────────────── */}
      <aside className="relative hidden lg:col-span-6 xl:col-span-7 lg:flex flex-col justify-between overflow-hidden bg-[#070b14] p-10 xl:p-14 text-white border-r border-white/10">
        {/* Layered atmospheric mesh & architectural grid */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(79,70,229,0.34),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(0,135,132,0.26),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-28 -right-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl"
          aria-hidden
        />

        {/* Top Header: Brand Lockup + Live Cloud Pill */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/95 px-4 py-2.5 shadow-xl shadow-black/25 backdrop-blur-md">
            <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-9 w-auto object-contain" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>{host ? host : 'BizzFlow Cloud ERP'}</span>
          </div>
        </div>

        {/* Center Hero + Mini ERP Preview Card */}
        <div className="relative z-10 my-auto py-8 space-y-8 max-w-2xl">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
              <span>Enterprise Resource Planning</span>
            </div>

            <h2 className="text-4xl xl:text-[2.75rem] font-bold tracking-tight leading-[1.12] text-white">
              One platform.{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-sky-200 to-teal-300 bg-clip-text text-transparent">
                Every operation in flow.
              </span>
            </h2>

            <p className="max-w-xl text-base xl:text-lg text-slate-300/85 leading-relaxed">
              Manage POS, service operations, multi-branch inventory, accounting, and teams from a single unified workspace.
            </p>
          </div>

          {/* Sleek Glassmorphic Mini Dashboard Preview */}
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-[11px] font-medium tracking-wide text-slate-400">
                  LIVE WORKSPACE SNAPSHOT
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <TrendingUp className="h-3 w-3" />
                Synced
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>POS &amp; Sales</span>
                  <BarChart3 className="h-3.5 w-3.5 text-indigo-300" />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">Multi-Branch</p>
                <p className="mt-0.5 text-[11px] text-emerald-300">Real-time shifts</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Inventory</span>
                  <Layers className="h-3.5 w-3.5 text-teal-300" />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">Live Stock</p>
                <p className="mt-0.5 text-[11px] text-sky-300">GRN &amp; transfers</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Finance</span>
                  <Receipt className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">P&amp;L Ready</p>
                <p className="mt-0.5 text-[11px] text-indigo-300">Auto-posted GL</p>
              </div>
            </div>
          </div>

          {/* 3 Compact Capability Highlights */}
          <ul className="grid gap-3.5 sm:grid-cols-1">
            {CAPABILITIES.map(({ icon: Icon, title: itemTitle, text }) => (
              <li
                key={itemTitle}
                className="flex items-start gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.06]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-teal-500/20 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-indigo-200" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{itemTitle}</p>
                  <p className="text-xs text-slate-300/75 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Copyright & Security Trust Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} BizzFlow Systems. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              TLS Encrypted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-300" />
              RBAC Protected
            </span>
          </div>
        </div>
      </aside>

      {/* ── RIGHT AUTH FORM PANEL ────────────────────────────────────────── */}
      <main className="relative lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-5 py-6 sm:px-10 sm:py-8 overflow-hidden">
        {/* Subtle ambient backdrop so right side feels cohesive in both light & dark modes */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.09),transparent_55%),radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.07),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />

        {/* Top Utility Row: Mobile Brand + Theme Switcher */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="inline-flex items-center rounded-xl border border-border bg-white px-3 py-1.5 shadow-sm">
              <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-7 w-auto object-contain" />
            </div>
          </div>
          <div className="hidden lg:block" />

          <button
            type="button"
            onClick={handleToggleTheme}
            title={`Switch theme (current: ${themeLabel})`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
            <span>{themeLabel}</span>
          </button>
        </div>

        {/* Center Auth Card */}
        <div className="relative z-10 my-auto mx-auto w-full max-w-[420px] py-8">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-7 sm:p-8 shadow-2xl shadow-slate-950/5 dark:shadow-black/50 backdrop-blur-xl">
            {/* Top gradient accent hairline */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-accent"
              aria-hidden
            />

            <div className="space-y-6">
              {/* Workspace Identity Pill (shown when tenant workspace is detected) */}
              {workspaceName && (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{workspaceName}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                </div>
              )}

              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
              </div>

              {children}

              {footer && <div className="pt-4 border-t border-border/60">{footer}</div>}
            </div>
          </div>
        </div>

        {/* Bottom Subtle Note */}
        <div className="relative z-10 text-center text-xs text-muted-foreground">
          <span className="lg:hidden">&copy; {new Date().getFullYear()} BizzFlow Systems · </span>
          <span>Protected by enterprise session security</span>
        </div>
      </main>
    </div>
  );
}

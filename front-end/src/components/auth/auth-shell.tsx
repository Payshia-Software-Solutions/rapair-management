"use client"

import React, { useEffect, useState } from 'react';
import { Building2, Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, getTheme, nextTheme, THEME_EVENT, type AppTheme } from '@/lib/theme';
import { tenantHost, tenantSlug } from '@/lib/tenant';

interface WorkspaceInfo {
  mode?: 'shared' | 'single';
  slug?: string;
  name?: string;
}

/**
 * Centered minimal layout shared by sign-in, forgot-password and reset-password pages.
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
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Subtle unified canvas backdrop (adapts smoothly to Light, Dark & Dim) */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%),radial-gradient(ellipse_50%_40%_at_50%_100%,hsl(var(--accent)/0.07),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.05] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />

      {/* Top utility bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <div>
          {host && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {host}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleTheme}
          title={`Switch theme (current: ${themeLabel})`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ThemeIcon className="h-3.5 w-3.5" />
          <span>{themeLabel}</span>
        </button>
      </header>

      {/* Centered Auth Container */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-6">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Clean Brand Header (no card/box) */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2.5">
              <img
                src="/icon-bizzflow-logo-optimized.webp"
                alt="BizzFlow"
                className="h-9 w-9 object-contain"
              />
              <span className="text-2xl font-bold tracking-tight text-foreground">
                BizzFlow
              </span>
            </div>

            {workspaceName && (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{workspaceName}</span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              </div>
            )}
          </div>

          {/* Elevated Minimal Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-7 sm:p-8 shadow-xl shadow-slate-950/[0.04] dark:shadow-black/50 backdrop-blur-xl">
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>

              {children}
            </div>
          </div>

          {footer && <div className="px-2">{footer}</div>}
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="relative z-10 px-6 py-5 text-center text-xs text-muted-foreground/75">
        &copy; {new Date().getFullYear()} BizzFlow Systems
      </footer>
    </div>
  );
}

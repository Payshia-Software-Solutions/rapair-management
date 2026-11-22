"use client";

import React from 'react';
import { Search, Bell, Sun, Moon, Menu, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

type AdminTopBarProps = {
  currentUser: string;
  role?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
};

export default function AdminTopBar({
  currentUser, role, theme, onToggleTheme, onToggleSidebar
}: AdminTopBarProps) {
  const pathname = usePathname();

  const pathParts  = pathname.split('/').filter(p => p && p !== 'admin');
  const rawTitle   = pathParts[0] ?? 'Dashboard';
  const pageTitle  = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).replace(/-/g, ' ');

  return (
    <header className="
      sticky top-0 z-40 flex h-14 items-center justify-between
      border-b border-nx-line bg-white px-4 lg:px-6
      dark:border-nx-line-dark dark:bg-nx-surface-dark
      transition-colors duration-200
    ">
      {/* ── Left ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted dark:hover:bg-nx-line-dark transition-colors"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden sm:block text-nx-text-subtle dark:text-nx-text-strong text-xs font-medium">
            Admin
          </span>
          <ChevronRight size={13} className="hidden sm:block text-nx-line-strong dark:text-nx-line-dark-strong" />
          <span className="font-semibold text-nx-ink dark:text-white text-[13px]">
            {pageTitle}
          </span>
        </div>
      </div>

      {/* ── Centre: Search ────────────────────── */}
      {role === 'super_admin' ? (
      <div className="hidden lg:flex flex-1 max-w-xs mx-6">
        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle dark:text-nx-text-strong" />
          <input
            type="text"
            placeholder="Search..."
            className="
              w-full rounded-md border border-nx-line bg-nx-surface-muted
              py-1.5 pl-8 pr-3 text-[13px] text-nx-ink
              placeholder:text-nx-text-subtle
              focus:border-nx-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-nx-accent/20
              dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white dark:placeholder:text-nx-text-strong
              dark:focus:border-nx-accent-light dark:focus:bg-nx-surface-dark
              transition-all duration-150
            "
          />
        </div>
      </div>
      ) : <div className="flex-1" />}

      {/* ── Right ────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="rounded-md p-2 text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:hover:bg-nx-line-dark dark:hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications (platform admins only) */}
        {role === 'super_admin' && (
        <button className="relative rounded-md p-2 text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:hover:bg-nx-line-dark dark:hover:text-white transition-colors">
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-nx-danger" />
        </button>
        )}

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-nx-line dark:bg-nx-line-dark" />

        {/* User avatar */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block text-right">
            <div className="text-[12px] font-semibold text-nx-ink dark:text-white leading-none">
              {currentUser}
            </div>
            <div className="mt-0.5 text-[10px] text-nx-text-subtle dark:text-nx-text-strong">
              {role === 'super_admin' ? 'Super Admin' : 'Client Admin'}
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-accent text-[12px] font-bold text-white">
            {currentUser.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';

/**
 * Gives every admin table cell a data-label from its column header, so the phone CSS in globals.css
 * can show each row as a card. Watches for rows added later (loading, paging, filters).
 */
function useStackedTables() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>('.nx-stack table:not([data-no-stack])').forEach(table => {
        const heads = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
        if (!heads.length) return;
        table.querySelectorAll('tbody tr').forEach(tr => {
          let col = 0;
          Array.from(tr.children).forEach(cell => {
            const td = cell as HTMLTableCellElement;
            const want = td.colSpan > 1 ? null : heads[col] ?? '';
            if (want !== null && td.getAttribute('data-label') !== want) td.setAttribute('data-label', want);
            col += td.colSpan || 1;
          });
        });
      });
    };
    label();
    let raf = 0;
    const obs = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(label); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, []);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [currentUser,     setCurrentUser]     = useState('');
  const [userRole,        setUserRole]        = useState('');
  const [loading,         setLoading]         = useState(true);
  // Theme lives in next-themes (root ThemeProvider): one source for the html class and the stored choice.
  const { resolvedTheme, setTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [isSidebarOpen,   setIsSidebarOpen]   = useState(false);
  useStackedTables();

  // Phone/tablet drawer: close on navigation and Escape, and stop the page behind it from scrolling
  const [openedOn, setOpenedOn] = useState(pathname);
  if (isSidebarOpen && openedOn !== pathname) { setIsSidebarOpen(false); setOpenedOn(pathname); }
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSidebarOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [isSidebarOpen]);

  useEffect(() => {
    const isLoginPage = pathname === '/admin' || pathname === '/admin/login';
    if (isLoginPage) { setLoading(false); return; }

    if (currentUser) {
      setLoading(false);
      return;
    }

    const checkAuth = async (attempt = 1) => {
      try {
        const headers: Record<string, string> = {};
        const res = await fetch(`${API_BASE}/auth/check`, { credentials: 'include', headers });
        if (!res.ok) {
          if (attempt < 3) {
            setTimeout(() => checkAuth(attempt + 1), 300);
            return;
          }
          router.push('/admin/login');
          return;
        }
        const data = await res.json();
        setCurrentUser(data.user);
        setUserRole(data.role);
      } catch {
        if (attempt < 3) {
          setTimeout(() => checkAuth(attempt + 1), 300);
          return;
        }
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [pathname, router, currentUser]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const isLoginPage = pathname === '/admin' || pathname === '/admin/login';
  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nx-canvas dark:bg-nx-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-nx-line border-t-nx-accent" />
          <span className="text-xs text-nx-text-subtle font-medium">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-nx-canvas text-nx-ink dark:bg-nx-ink dark:text-white transition-colors duration-200">
      <AdminSidebar
        currentUser={currentUser}
        role={userRole}
        theme={theme}
        onToggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar
          currentUser={currentUser}
          role={userRole}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => { setOpenedOn(pathname); setIsSidebarOpen(prev => !prev); }}
          sidebarOpen={isSidebarOpen}
        />
        <main className="nx-stack flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { UserCircle, Menu, X, ArrowRight, ChevronDown, Sparkles, LayoutGrid, Layers, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const pathname  = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user,       setUser]       = useState("");
  const [isOpen,     setIsOpen]     = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [appsOpen,   setAppsOpen]   = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(true);
          setUser(data.user);
        }
      } catch {}
    };
    checkAuth();
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/admin') || pathname.startsWith('/verify-email')) {
    return null;
  }

  const links = [
    { name: "Overview",  path: "/" },
    { name: "Features",  path: "/features" },
    { name: "Pricing",   path: "/pricing" },
    { name: "Docs",      path: "/docs" },
  ];

  const isActive = (path: string) => {
    if (path === "/docs") return pathname.startsWith("/docs");
    return pathname === path;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled || isOpen
          ? 'border-b border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95 backdrop-blur-md shadow-xs'
          : 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-900'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm group-hover:scale-105 transition-transform">
            <span className="font-black text-sm tracking-tighter">B</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              BIZZFLOW
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                ERP
              </span>
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Enterprise Platform</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5">
          {links.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                isActive(link.path)
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20"
            >
              <UserCircle size={15} />
              <span>Portal ({user})</span>
            </Link>
          ) : (
            <>
              <Link
                href="/admin/login"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/order"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm shadow-indigo-600/25 group"
              >
                <span>Start Free Trial</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 space-y-2 shadow-lg">
          {links.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setIsOpen(false)}
              className={`block rounded-xl px-3.5 py-2.5 text-xs font-bold ${
                isActive(link.path)
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            {isLoggedIn ? (
              <Link href="/admin/dashboard" onClick={() => setIsOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white">
                <UserCircle size={15} /> Open Portal ({user})
              </Link>
            ) : (
              <>
                <Link href="/admin/login" onClick={() => setIsOpen(false)} className="rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  Sign In
                </Link>
                <Link href="/order" onClick={() => setIsOpen(false)} className="rounded-xl bg-indigo-600 py-2.5 text-center text-xs font-bold text-white shadow-sm shadow-indigo-600/25">
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

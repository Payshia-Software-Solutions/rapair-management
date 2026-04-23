"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/verify-email')) {
    return null;
  }
  return (
    <footer className="py-12 border-t border-slate-200 dark:border-white/5 bg-background transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">
        <p>© 2026 Nexus ERP Suite. Powering the next generation of global enterprises.</p>
      </div>
    </footer>
  );
}

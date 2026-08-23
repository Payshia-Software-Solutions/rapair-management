"use client";

import React, { createContext, useContext, useState } from "react";
import DocsSidebar from "@/components/docs/DocsSidebar";
import TableOfContents from "@/components/docs/TableOfContents";
import Link from "next/link";
import { ChevronRight, Home, BookOpen } from "lucide-react";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface DocsContextType {
  tocItems: TOCItem[];
  setTocItems: (items: TOCItem[]) => void;
}

const DocsContext = createContext<DocsContextType | undefined>(undefined);

export const useDocs = () => {
  const context = useContext(DocsContext);
  if (!context) {
    throw new Error("useDocs must be used within a DocsProvider");
  }
  return context;
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  return (
    <DocsContext.Provider value={{ tocItems, setTocItems }}>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pt-28 pb-24 text-slate-900 dark:text-white relative selection:bg-indigo-500 selection:text-white">
        
        {/* Subtle Background Glows */}
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[140px] -z-10 pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-[600px] h-[600px] bg-cyan-600/5 dark:bg-cyan-600/10 rounded-full blur-[140px] -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
              <Home size={12} />
              Home
            </Link>
            <ChevronRight size={12} className="text-slate-300 dark:text-slate-700" />
            <Link href="/docs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
              <BookOpen size={12} />
              Documentation
            </Link>
          </nav>

          {/* Main 3-Column Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Docs Navigation Sidebar (Span 3) */}
            <div className="lg:col-span-3 lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
              <DocsSidebar />
            </div>

            {/* Middle Column: Document Article Card (Span 7) */}
            <main className="lg:col-span-6 xl:col-span-7 min-w-0">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-10 lg:p-12 dark:border-slate-800 dark:bg-slate-900 shadow-sm min-h-[600px]">
                {children}
              </article>
            </main>

            {/* Right Column: Table of Contents (Span 2) */}
            <aside className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-4 border-l border-slate-200/80 dark:border-slate-800 space-y-4">
              <TableOfContents items={tocItems} />
            </aside>

          </div>
        </div>
      </div>
    </DocsContext.Provider>
  );
}

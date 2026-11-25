"use client"

import React from 'react';

export function Preloader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <div className="relative flex items-center justify-center">
        {/* Soft glow behind the logo */}
        <div className="absolute h-24 w-24 animate-pulse rounded-full bg-primary/15 blur-2xl" />

        {/* Brand logo tile */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-xl shadow-primary/10">
          <img
            src="/icon-bizzflow-logo-optimized.webp"
            alt="BizzFlow"
            className="h-10 w-10 object-contain"
          />
        </div>
      </div>

      {/* Name */}
      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-xl font-black tracking-tight text-foreground">BizzFlow</h2>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">ERP</span>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">Preparing your workspace…</p>

      {/* Indeterminate progress bar */}
      <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full w-1/3 rounded-full bg-primary animate-[bizz-load_1.2s_ease-in-out_infinite]" />
      </div>

      <style>{`@keyframes bizz-load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SAFETY_MS = 8000; // never leave the bar up longer than this

function ProgressContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    timers.current.push(setTimeout(() => { setIsVisible(false); setProgress(0); }, 300));
  };

  // Route changed: finish the bar (stale step timers are cancelled first)
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => () => clearTimers(), []);

  // Start the bar on internal link clicks that will actually change the URL
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;

      const next = new URL(href, window.location.href);
      const here = new URL(window.location.href);
      // Same page, or only the hash differs: no navigation, no bar
      if (next.pathname === here.pathname && next.search === here.search) return;

      clearTimers();
      setIsVisible(true);
      setProgress(30);
      timers.current.push(
        setTimeout(() => setProgress(70), 150),
        setTimeout(() => setProgress(90), 400),
        setTimeout(finish, SAFETY_MS),
      );
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px] bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 shadow-[0_0_12px_rgba(99,102,241,0.85)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "all 300ms ease-out" : "width 200ms ease-out, opacity 150ms ease-in"
        }}
      />
    </div>
  );
}

export function ProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressContent />
    </Suspense>
  );
}

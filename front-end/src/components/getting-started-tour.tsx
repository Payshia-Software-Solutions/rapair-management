"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Rocket, X, PartyPopper, ArrowRight } from "lucide-react";
import { fetchTour, setTourDismissed, type TourStatus } from "@/lib/api/setup";

/**
 * Getting-started guide for a new workspace, shown until the first POS sale.
 * A floating checklist (setup -> first item -> first sale), ticked from real data by the server,
 * plus a highlight on the exact button to press on the current page (elements with data-tour="...").
 * Only administrators see it (the server answers 403 to everyone else).
 */

type StepDef = {
  key: string;
  title: string;
  text: string;
  href: string;
  /** Highlight per page: path prefix -> element and hint */
  spots: { path: string; target: string; hint: string }[];
};

const STEPS: StepDef[] = [
  {
    key: "setup",
    title: "Finish the setup wizard",
    text: "Company name, address and phone. They print on every bill.",
    href: "/onboarding",
    spots: [],
  },
  {
    key: "units",
    title: "Add units of measure",
    text: "How you sell things: pcs, kg, box... Every item needs one.",
    href: "/master-data/units",
    spots: [{ path: "/master-data/units", target: "units-add", hint: "Click Add and create a unit, for example \"pcs\"." }],
  },
  {
    key: "brands",
    title: "Add a brand",
    text: "The make of the products you sell. Every item needs one.",
    href: "/master-data/brands",
    spots: [{ path: "/master-data/brands", target: "brands-add", hint: "Click Add and create your first brand." }],
  },
  {
    key: "collections",
    title: "Add a collection",
    text: "Groups items on the POS screen (for example Drinks, Snacks). Every item needs one.",
    href: "/master-data/collections",
    spots: [{ path: "/master-data/collections", target: "collections-add", hint: "Click Add and create your first collection." }],
  },
  {
    key: "item",
    title: "Add your first item",
    text: "Something you sell, with its price, unit, brand and collection.",
    href: "/inventory/items",
    spots: [
      { path: "/inventory/items/new", target: "item-save", hint: "Fill in name, selling price, unit, brand and collection, then click Create Product." },
      { path: "/inventory/items", target: "item-new", hint: "Click New to add your first item." },
    ],
  },
  {
    key: "customer",
    title: "Add your first customer",
    text: "Name and phone number, so bills and credit sales can be tracked.",
    href: "/cms/customers",
    spots: [
      { path: "/cms/customers/form", target: "customer-save", hint: "Enter the customer's name and phone, then save." },
      { path: "/cms/customers", target: "customer-add", hint: "Click Add Customer." },
    ],
  },
  {
    key: "pos",
    title: "Make your first sale",
    text: "Open POS, tap an item, press Checkout and take the payment.",
    href: "/cms/pos",
    spots: [
      { path: "/cms/pos", target: "pos-checkout", hint: "Tap an item to add it to the bill, then press Checkout and take the payment." },
    ],
  },
];

const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/onboarding", "/print", "/receipt",
  "/kiosk", "/guest-receipt", "/workspace-unavailable", "/trial-ended", "/select-location", "/setup", "/menu"];
const COLLAPSE_KEY = "bf_tour_collapsed";
const CELEBRATED_KEY = "bf_tour_celebrated";
const SEEN_KEY = "bf_tour_seen";

/** Pulsing ring + hint bubble around the element the user should press next. */
function Spotlight({ target, hint }: { target: string; hint: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const read = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
      setRect(prev => (r && prev && r.top === prev.top && r.left === prev.left && r.width === prev.width && r.height === prev.height) ? prev : r);
    };
    read();
    const t = window.setInterval(read, 400);
    window.addEventListener("scroll", read, true);
    window.addEventListener("resize", read);
    return () => { window.clearInterval(t); window.removeEventListener("scroll", read, true); window.removeEventListener("resize", read); };
  }, [target]);

  if (!rect) return null;
  const pad = 6;
  const below = rect.bottom + 140 < window.innerHeight;
  const bubbleLeft = Math.min(Math.max(12, rect.left), window.innerWidth - 292);
  return (
    <>
      <div aria-hidden="true"
        className="pointer-events-none fixed z-[60] rounded-lg ring-4 ring-primary/70 motion-safe:animate-pulse"
        style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div role="status"
        className="pointer-events-none fixed z-[61] w-[280px] rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg"
        style={below ? { top: rect.bottom + pad + 8, left: bubbleLeft } : { top: rect.top - pad - 8, left: bubbleLeft, transform: "translateY(-100%)" }}>
        {hint}
      </div>
    </>
  );
}

export function GettingStartedTour() {
  const pathname = usePathname() || "";
  const [status, setStatus] = useState<TourStatus | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const hidden = HIDDEN_ON.some(p => pathname.startsWith(p));

  const load = useCallback(async () => {
    if (typeof window === "undefined" || !window.localStorage.getItem("auth_token")) { setStatus(null); return; }
    try {
      const s = await fetchTour();
      setStatus(s);
      if (!s.finished && !s.dismissed) window.localStorage.setItem(SEEN_KEY, "1");
      if (s.finished && !window.localStorage.getItem(CELEBRATED_KEY)) {
        // Celebrate once, only if this browser saw the guide before the sale
        if (window.localStorage.getItem(SEEN_KEY)) setCelebrate(true);
        window.localStorage.setItem(CELEBRATED_KEY, "1");
      }
    } catch {
      setStatus(null); // not an admin, or the API is unavailable: no guide
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  // Recheck on every page change, when the tab regains focus, and every 15 s
  useEffect(() => { if (!hidden) void load(); }, [pathname, hidden, load]);
  useEffect(() => {
    if (hidden) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(() => void load(), 15000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(t); };
  }, [hidden, load]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  const dismiss = async () => {
    setStatus(s => (s ? { ...s, dismissed: true } : s));
    try { await setTourDismissed(true); } catch { /* shown again next time; harmless */ }
  };

  if (hidden) return null;

  if (celebrate) {
    return (
      <div role="dialog" aria-label="First sale done" className="fixed bottom-6 left-6 z-50 w-[320px] rounded-xl border bg-background p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <PartyPopper className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Your first sale is done</p>
            <p className="mt-1 text-xs text-muted-foreground">You&apos;re all set. Explore reports, stock and customers from the menu whenever you&apos;re ready.</p>
          </div>
          <button type="button" onClick={() => setCelebrate(false)} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (!status || status.finished || status.dismissed) return null;

  const doneKeys = new Set<string>(status.steps.filter(s => s.done).map(s => s.key));
  const doneCount = STEPS.filter(s => doneKeys.has(s.key)).length;
  const current = STEPS.find(s => !doneKeys.has(s.key)) ?? null;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const spot = current?.spots.find(sp => pathname.startsWith(sp.path)) ?? null;
  const onCurrentPage = !!spot || (current ? pathname.startsWith(current.href) : false);

  return (
    <>
      {spot && <Spotlight target={spot.target} hint={spot.hint} />}

      <section aria-label="Getting started" className="fixed bottom-6 left-6 z-50 w-[320px] max-w-[calc(100vw-3rem)] rounded-xl border bg-background shadow-xl">
        <button type="button" onClick={toggle} aria-expanded={!collapsed}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-muted/50">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Getting started</span>
            <span className="block text-xs text-muted-foreground">{doneCount} of {STEPS.length} done{current ? ` · Next: ${current.title}` : ""}</span>
          </span>
          {collapsed ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </button>

        <div className="px-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Getting started progress"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-primary motion-safe:transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {!collapsed && (
          <div className="space-y-1 p-3 pt-3">
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const done = doneKeys.has(s.key);
                const isCurrent = current?.key === s.key;
                return (
                  <li key={s.key} className={`rounded-lg p-2 ${isCurrent ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? "bg-emerald-600 text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${done ? "text-muted-foreground line-through" : "font-medium"}`}>{s.title}</p>
                        {isCurrent && <p className="mt-0.5 text-xs text-muted-foreground">{s.text}</p>}
                        {isCurrent && !onCurrentPage && (
                          <Link href={s.href}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                            Start <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        )}
                        {isCurrent && spot && <p className="mt-1.5 text-xs font-medium text-primary">{spot.hint}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => void dismiss()} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                Don&apos;t show this guide
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

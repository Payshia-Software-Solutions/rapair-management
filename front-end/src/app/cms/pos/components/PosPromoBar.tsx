"use client";

import React from "react";
import { RefreshCw, Sparkles, Tag, Ticket, Trash2, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePOS } from "../context/POSContext";

/**
 * Promotion row in the cart totals: the offer on this bill (applied automatically, or picked),
 * a way to switch or remove it, and a promo-code box for code-only offers.
 */
export const PosPromoBar: React.FC = () => {
  const {
    cart,
    appliedPromotion,
    setAppliedPromotion,
    setIsPromotionPromptOpen,
    eligiblePromotions,
    promoCode,
    applyPromoCode,
    clearPromoCode,
    canCheckout,
  } = usePOS();
  const [codeOpen, setCodeOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (!canCheckout || cart.length === 0) return null;

  const others = eligiblePromotions.filter((p: any) => p.promotion_id !== appliedPromotion?.promotion_id && (Number(p.discount_value) > 0 || p.missing_rewards));

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const ok = await applyPromoCode(code);
    setBusy(false);
    if (ok) { setCode(""); setCodeOpen(false); }
  };

  return (
    <div className="space-y-1.5">
      {appliedPromotion ? (
        <div className="flex justify-between items-center gap-2 py-2 px-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {appliedPromotion.promo_code ? `Code ${appliedPromotion.promo_code}` : "Offer applied"}
              {appliedPromotion.capped ? " · capped" : ""}
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white truncate">{appliedPromotion.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black text-amber-600 tabular-nums">-LKR {Number(appliedPromotion.discount_value).toLocaleString()}</span>
            {others.length > 0 && (
              <button
                onClick={() => setIsPromotionPromptOpen(true)}
                title={`Switch offer (${others.length} more)`}
                aria-label="Switch offer"
                className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-md transition-colors text-amber-600"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => { if (appliedPromotion.promo_code) clearPromoCode(); setAppliedPromotion(null); }}
              title="Remove offer"
              aria-label="Remove offer"
              className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-md transition-colors text-amber-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : others.length > 0 ? (
        <button
          onClick={() => setIsPromotionPromptOpen(true)}
          className="w-full flex items-center justify-between gap-2 py-1.5 px-3 rounded-md border border-dashed border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-xs font-medium"
        >
          <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" aria-hidden="true" /> {others.length} offer{others.length > 1 ? "s" : ""} available</span>
          <span className="font-bold">View</span>
        </button>
      ) : null}

      {codeOpen ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") void submit(); if (e.key === "Escape") setCodeOpen(false); }}
            placeholder="Promo code"
            aria-label="Promo code"
            className="h-8 text-xs font-mono uppercase"
          />
          <Button size="sm" className="h-8 px-3 text-xs" onClick={submit} disabled={busy || !code.trim()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setCodeOpen(false)} aria-label="Close promo code">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : !appliedPromotion?.promo_code && (
        <button onClick={() => setCodeOpen(true)} className="text-[11px] font-medium text-muted-foreground hover:text-primary flex items-center gap-1">
          <Ticket className="w-3 h-3" aria-hidden="true" /> {promoCode ? `Code ${promoCode}` : "Have a promo code?"}
        </button>
      )}
    </div>
  );
};

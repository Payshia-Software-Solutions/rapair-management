"use client";

import React from "react";
import { ShoppingCart, CheckCircle2, ArrowRight } from "lucide-react";
import { usePOS } from "../context/POSContext";

/**
 * Bottom bar for the tabbed layout (phones, portrait tablets).
 * Menu tab: a "View order" pill when the cart has items.
 * Order tab: Hold & KOT + Checkout (same actions as the side cart).
 * Stewards (no checkout) use the cart's own "Send to kitchen" button instead.
 */
export const MobilePosNav: React.FC = () => {
    const {
        activeMobileTab,
        setActiveMobileTab,
        totals,
        cart,
        canCheckout,
        holdPOSBill,
        openCheckoutDialog,
    } = usePOS();

    const itemCount = cart.reduce((acc, it) => acc + Number(it.quantity), 0);

    if (activeMobileTab === 'shelf') {
        if (itemCount === 0) return null;
        return (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button
                    type="button"
                    onClick={() => setActiveMobileTab('bill')}
                    className="flex items-center gap-3 h-12 px-5 bg-primary text-primary-foreground rounded-full shadow-lg active:scale-95 transition-transform"
                >
                    <span className="relative">
                        <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                        <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 bg-background text-foreground text-[10px] font-semibold rounded-full flex items-center justify-center">
                            {itemCount}
                        </span>
                    </span>
                    <span className="text-sm font-medium">View order</span>
                    <span className="text-sm font-semibold tabular-nums">
                        LKR {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <ArrowRight className="w-4 h-4 opacity-70" aria-hidden="true" />
                </button>
            </div>
        );
    }

    if (!canCheckout) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 px-4 py-3 pb-safe">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <span className="block text-xs text-muted-foreground">Total</span>
                    <span className="block text-lg font-semibold tabular-nums leading-tight">
                        LKR {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => void holdPOSBill()}
                    className="h-12 px-4 rounded-md border border-border text-sm font-medium disabled:opacity-50 hover:bg-muted"
                >
                    Hold &amp; KOT
                </button>
                <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => void openCheckoutDialog()}
                    className="h-12 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Checkout
                </button>
            </div>
        </div>
    );
};

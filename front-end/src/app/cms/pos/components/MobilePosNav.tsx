"use client";

import React from "react";
import { ShoppingCart, CheckCircle2, ArrowRight } from "lucide-react";
import { usePOS } from "../context/POSContext";

export const MobilePosNav: React.FC = () => {
    const { 
        activeMobileTab, 
        setActiveMobileTab,
        totals,
        setCheckoutOpen,
        cart
    } = usePOS();

    const itemCount = cart.reduce((acc, it) => acc + Number(it.quantity), 0);

    // If we're on the shelf (menu) tab, we might want to hide the bottom bar 
    // to give more room for products, or just show a floating "Go to Order" if cart has items.
    if (activeMobileTab === 'shelf') {
        if (itemCount === 0) return null;
        
        return (
            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                    onClick={() => setActiveMobileTab('bill')}
                    className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all"
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 text-[8px] font-black rounded-full flex items-center justify-center border-2 border-indigo-600">
                            {itemCount}
                        </span>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">View Order</span>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                </button>
            </div>
        );
    }

    // On the Bill (Order) tab, show a premium checkout bar
    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-border z-50 px-4 py-3 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Total Amount
                    </span>
                    <span className="block text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white">
                        LKR {totals.grandTotal.toLocaleString()}
                    </span>
                </div>

                <button
                    disabled={cart.length === 0}
                    onClick={() => setCheckoutOpen(true)}
                    className="flex-[2] flex items-center justify-center gap-3 px-6 h-14 bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl shadow-lg shadow-emerald-500/20 transition-all zoom-in-95 duration-200"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Complete Payment</span>
                </button>
            </div>
        </div>
    );
};

"use client";

import React from "react";
import { ShoppingCart, LayoutGrid, CheckCircle2 } from "lucide-react";
import { usePOS } from "../context/POSContext";
import { Button } from "@/components/ui/button";

export const MobilePosNav: React.FC = () => {
    const { 
        activeMobileTab, 
        setActiveMobileTab, 
        cart, 
        totals,
        setCheckoutOpen
    } = usePOS();

    const itemCount = cart.reduce((acc, it) => acc + Number(it.quantity), 0);

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-border z-50 px-4 py-3 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
                {/* Items Tab Trigger */}
                <button
                    onClick={() => setActiveMobileTab('shelf')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all ${
                        activeMobileTab === 'shelf' 
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                        : 'text-muted-foreground'
                    }`}
                >
                    <LayoutGrid className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Items</span>
                </button>

                {/* Cart/Bill Tab Trigger (Premium Centerpiece) */}
                <button
                    onClick={() => setActiveMobileTab('bill')}
                    className={`flex-[2] relative flex items-center justify-between gap-3 p-4 rounded-[1.5rem] transition-all overflow-hidden ${
                        activeMobileTab === 'bill'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${activeMobileTab === 'bill' ? 'bg-white/20' : 'bg-white dark:bg-slate-800 shadow-sm text-indigo-500'}`}>
                            <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className={`block text-[8px] font-black uppercase tracking-[0.2em] ${activeMobileTab === 'bill' ? 'text-indigo-100' : 'text-slate-400'}`}>
                                Billing
                            </span>
                            <span className="block text-sm font-black tracking-tight leading-none">
                                LKR {totals.grandTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    {itemCount > 0 && (
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            activeMobileTab === 'bill' ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                        }`}>
                            {itemCount}
                        </div>
                    )}
                </button>

                {/* Quick Checkout? or Management Actions? */}
                {/* For now let's add a simple "Finish" button if total > 0 */}
                {totals.grandTotal > 0 && activeMobileTab === 'bill' ? (
                     <button
                        onClick={() => setCheckoutOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-emerald-500 text-white rounded-2xl animate-in zoom-in-95 duration-200"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Pay</span>
                    </button>
                ) : (
                    <div className="flex-1" /> // Spacer
                )}
            </div>
        </div>
    );
};

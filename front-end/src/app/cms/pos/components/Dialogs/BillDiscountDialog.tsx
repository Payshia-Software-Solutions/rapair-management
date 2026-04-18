
"use client";

import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePOS } from "../../context/POSContext";
import { Calculator, Percent, Banknote, X, Check, Trash2 } from "lucide-react";

export const BillDiscountDialog: React.FC = () => {
  const {
    billDiscountDialogOpen,
    setBillDiscountDialogOpen,
    billDiscountValue,
    setBillDiscountValue,
    billDiscountType,
    setBillDiscountType,
    vKeyboardEnabled,
    setVKeyboardActiveInput,
    totals
  } = usePOS();

  const handleApply = () => {
    setBillDiscountDialogOpen(false);
  };

  const handleClear = () => {
    setBillDiscountValue(0);
    setBillDiscountDialogOpen(false);
  };

  const presets = billDiscountType === 'percentage' 
    ? [5, 10, 15, 20, 25] 
    : [100, 250, 500, 1000, 5000];

  return (
    <Dialog open={billDiscountDialogOpen} onOpenChange={setBillDiscountDialogOpen}>
      <DialogContent className="w-full sm:max-w-md h-[100dvh] sm:h-auto p-0 overflow-hidden border-none shadow-2xl rounded-none sm:rounded-[2rem] bg-white dark:bg-slate-950">
        <div className="bg-slate-900 dark:bg-black p-8 text-white relative border-b border-white/5">
            <div className="absolute top-6 right-6 opacity-10">
                <Calculator className="w-20 h-20" />
            </div>
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-[0.1em] flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500 rounded-lg">
                        <Percent className="w-4 h-4 text-white" />
                    </div>
                    Bill Discount
                </DialogTitle>
                <p className="text-slate-400 text-xs font-medium mt-1">Configure global savings for this transaction.</p>
            </DialogHeader>
        </div>

        <div className="p-8 space-y-8">
           {/* Mode Toggle */}
           <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl gap-1 border border-slate-200 dark:border-slate-800">
             <button 
                onClick={() => setBillDiscountType('percentage')}
                className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${billDiscountType === 'percentage' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <Percent className="w-3.5 h-3.5" /> Percentage
             </button>
             <button 
                onClick={() => setBillDiscountType('flat')}
                className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${billDiscountType === 'flat' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <Banknote className="w-3.5 h-3.5" /> Fixed
             </button>
           </div>

           {/* Input Section */}
           <div className="relative">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <span className={`font-black text-2xl ${billDiscountType === 'percentage' ? 'text-indigo-500/50' : 'text-emerald-500/50'}`}>
                    {billDiscountType === 'percentage' ? '%' : 'LKR'}
                </span>
              </div>
              <Input 
                 type="number"
                 value={billDiscountValue || ''}
                 onChange={e => setBillDiscountValue(Number(e.target.value))}
                 onFocus={() => {
                   if (vKeyboardEnabled) {
                     setVKeyboardActiveInput({
                       key: "Discount Value",
                       value: String(billDiscountValue || ''),
                       type: 'numeric',
                       setter: (val: string) => setBillDiscountValue(Number(val))
                     });
                   }
                 }}
                 className="h-20 pl-20 pr-8 text-4xl font-black rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus-visible:ring-indigo-500 text-foreground transition-all text-right"
                 placeholder="0"
              />
           </div>

           {/* Presets */}
           <div className="flex flex-wrap justify-center gap-2">
              {presets.map(val => (
                <button 
                  key={val} 
                  onClick={() => setBillDiscountValue(val)}
                  className={`px-4 h-10 font-bold text-xs rounded-full border-2 transition-all ${billDiscountValue === val ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105' : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:border-indigo-400 hover:text-indigo-500'}`}
                >
                   {val}{billDiscountType === 'percentage' ? '%' : ''}
                </button>
              ))}
              {billDiscountValue > 0 && (
                <button 
                  onClick={() => setBillDiscountValue(0)}
                  className="px-4 h-10 font-bold text-xs rounded-full border-2 border-rose-100 text-rose-500 hover:bg-rose-50 transition-all"
                >
                  Clear
                </button>
              )}
           </div>

           {/* Summary Cards */}
           <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700/60 dark:text-indigo-400/60 mb-1">Savings</p>
                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
                        LKR {(billDiscountType === 'percentage' ? (totals.subtotal - totals.lineDiscountTotal) * (billDiscountValue / 100) : billDiscountValue).toLocaleString()}
                    </p>
                </div>
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 dark:text-emerald-400/60 mb-1">Final Bill</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                        LKR {totals.grandTotal.toLocaleString()}
                    </p>
                </div>
           </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 gap-3">
            <Button 
                variant="ghost" 
                onClick={() => setBillDiscountDialogOpen(false)} 
                className="font-bold rounded-xl text-slate-500"
            >
                Close
            </Button>
            <Button 
                onClick={handleApply} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-10 shadow-lg shadow-indigo-200 dark:shadow-none h-12"
            >
                Confirm Discount
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

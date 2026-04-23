"use client";

import React from "react";
import { Sparkles, Check, X, Gift, Info } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePOS } from "../../context/POSContext";

export const PromotionPromptDialog: React.FC = () => {
  const {
    eligiblePromotions,
    setEligiblePromotions,
    appliedPromotion,
    setAppliedPromotion,
    isPromotionPromptOpen,
    setIsPromotionPromptOpen,
    promotionsPromptDismissed,
    setPromotionsPromptDismissed,
    checkoutIntentActive,
    setCheckoutIntentActive,
    setCheckoutOpen,
    claimPromotionRewards
  } = usePOS();

  const highestEligibleDiscount = eligiblePromotions.reduce((max, p) => Math.max(max, p.discount_value), 0);
  const currentAppliedDiscount = appliedPromotion?.discount_value || 0;

  const show = isPromotionPromptOpen || (!promotionsPromptDismissed && eligiblePromotions.length > 0 && (
    (!appliedPromotion && (highestEligibleDiscount > 0 || eligiblePromotions.some(p => p.missing_rewards))) || 
    (checkoutIntentActive && highestEligibleDiscount > currentAppliedDiscount + 0.1)
  ));

  if (!show) return null;

  const handleApply = (promo: any) => {
    setAppliedPromotion(promo);
    claimPromotionRewards(promo);
    setEligiblePromotions([]);
    setIsPromotionPromptOpen(false);
    setPromotionsPromptDismissed(true);
    
    if (checkoutIntentActive) {
      setCheckoutOpen(true);
      setCheckoutIntentActive(false);
    }
  };

  const handleDismiss = () => {
    setEligiblePromotions([]);
    setIsPromotionPromptOpen(false);
    setPromotionsPromptDismissed(true);

    if (checkoutIntentActive) {
      setCheckoutOpen(true);
      setCheckoutIntentActive(false);
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { 
      setIsPromotionPromptOpen(open);
      if (!open) handleDismiss(); 
    }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl bg-white dark:bg-slate-950">
        <div className="p-6 pb-2">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Available Offers
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Great news!
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm">
              We've found {eligiblePromotions.length} special {eligiblePromotions.length === 1 ? 'offer' : 'offers'} for this transaction.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="max-h-[400px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {eligiblePromotions.map((promo) => {
               const isPotential = !!promo.missing_rewards;
               
               return (
                <div 
                    key={promo.promotion_id}
                    className={`group relative rounded-2xl p-4 border transition-all duration-200 cursor-pointer ${
                        isPotential 
                        ? 'bg-amber-50/30 dark:bg-amber-500/5 border-amber-100 dark:border-amber-900/30 hover:shadow-md hover:border-amber-200' 
                        : 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-900/30 hover:shadow-md hover:border-emerald-200'
                    }`}
                    onClick={() => handleApply(promo)}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="space-y-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isPotential ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {promo.type}
                            </span>
                            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                {promo.name}
                                {isPotential && <Info className="w-3.5 h-3.5 text-amber-500" />}
                            </h4>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mb-1 ${
                              isPotential 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50' 
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50'
                          }`}>
                              {isPotential ? 'Potential' : 'Instant Save'}
                          </span>
                          <div className={`text-lg font-bold tabular-nums ${isPotential ? 'text-amber-700' : 'text-emerald-700'}`}>
                              LKR {isPotential ? promo.missing_rewards.potential_discount : promo.discount_value}
                          </div>
                        </div>
                    </div>
                    
                    <div className={`flex items-center justify-between gap-4 p-3 rounded-xl ${
                        isPotential 
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200' 
                        : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    }`}>
                        <div className="text-xs font-medium leading-tight">
                            {isPotential ? (
                                <span>Add {promo.missing_rewards.qty}x <span className="font-bold">{promo.missing_rewards.item_name}</span> to claim!</span>
                            ) : (
                                <span>Click apply to save on this bill.</span>
                            )}
                        </div>
                        <Button 
                            size="sm"
                            className={`h-8 px-4 font-bold rounded-lg text-[11px] uppercase transition-all ${
                                isPotential 
                                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleApply(promo); }}
                        >
                            {isPotential ? 'View' : 'Apply'}
                        </Button>
                    </div>
                </div>
               );
            })}
          </div>

          <div className="pt-2 flex flex-col items-center gap-4">
            <button 
              onClick={handleDismiss}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors uppercase tracking-widest"
            >
              Skip for now
            </button>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium tracking-wide">
              Only one promotion can be applied per transaction
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

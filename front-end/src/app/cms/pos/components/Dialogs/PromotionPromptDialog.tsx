"use client";

import React from "react";
import { Sparkles, Check, X, Gift } from "lucide-react";
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
    setAppliedPromotion
  } = usePOS();

  // Only show if there are eligible promos AND the best one isn't already applied
  // (Technically we want to show it if we have potential ones that aren't the CURRENT applied one)
  const show = eligiblePromotions.length > 0 && 
               (!appliedPromotion || !eligiblePromotions.find(p => p.promotion_id === appliedPromotion.promotion_id));

  if (!show) return null;

  const handleApply = (promo: any) => {
    setAppliedPromotion(promo);
    setEligiblePromotions([]);
  };

  const handleDismiss = () => {
    setEligiblePromotions([]);
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-950">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Gift className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-xl">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
            </div>
            <DialogHeader className="p-0 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Offers Detected</span>
              <DialogTitle className="text-2xl font-black tracking-tight text-white leading-none">
                Great news!
              </DialogTitle>
              <DialogDescription className="text-indigo-50 font-medium text-sm pt-2">
                We've found {eligiblePromotions.length} eligible {eligiblePromotions.length === 1 ? 'offer' : 'offers'} for your cart. Select one to apply.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {eligiblePromotions.map((promo) => (
              <div 
                key={promo.promotion_id}
                className="group relative bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 border-2 border-transparent hover:border-indigo-500/30 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
                onClick={() => handleApply(promo)}
              >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">
                            {promo.type}
                        </span>
                        <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                            {promo.name}
                        </h4>
                    </div>
                    <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black text-[10px] shadow-lg shadow-indigo-600/20">
                        {promo.missing_rewards 
                           ? `POTENTIAL LKR ${promo.missing_rewards.potential_discount}`
                           : `SAVE LKR ${promo.discount_value}`
                        }
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 bg-white/50 dark:bg-black/20 rounded-2xl px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {promo.missing_rewards ? (
                        <span className="text-amber-600 dark:text-amber-500">
                           Add {promo.missing_rewards.qty}x {promo.missing_rewards.item_name} to claim!
                        </span>
                    ) : (
                        <span>Applicable to selected items</span>
                    )}
                    <Button 
                        size="sm" 
                        className="h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] px-4"
                        onClick={(e) => { e.stopPropagation(); handleApply(promo); }}
                    >
                        {promo.missing_rewards ? 'Select' : 'Apply'}
                    </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 border-2 hover:bg-slate-50"
            >
              <X className="w-4 h-4 mr-2" /> Skip Offers
            </Button>
          </div>
          
          <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest opacity-60">
            * Only one promotion can be applied per transaction
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

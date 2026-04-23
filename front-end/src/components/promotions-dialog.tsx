"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Tag, Percent, Info, Loader2, Gift, Sparkles } from "lucide-react";
import { fetchPromotions } from "@/lib/api";
import { format } from "date-fns";

interface PromotionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: number | null;
  locationName: string;
}

export function PromotionsDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
}: PromotionsDialogProps) {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && locationId) {
      setLoading(true);
      fetchPromotions(locationId)
        .then((data) => setPromotions(data))
        .catch((err) => console.error("Failed to load promotions", err))
        .finally(() => setLoading(false));
    }
  }, [open, locationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Percent className="w-6 h-6 text-primary" />
            Active Promotions
          </DialogTitle>
          <DialogDescription>
            Showing all current offers and discounts for <strong>{locationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Fetching the latest deals...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2 border-2 border-dashed rounded-2xl bg-muted/30">
            <div className="p-3 bg-background rounded-full shadow-sm">
              <Tag className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-semibold mt-2">No Active Promotions</p>
            <p className="text-xs text-muted-foreground px-8">
              There are no specific promotions active for this location right now. Check back soon for seasonal offers!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="group relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-primary/5 p-6 transition-all hover:shadow-lg hover:border-primary/30"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Tag className="w-16 h-16" />
                </div>
                
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                       <h3 className="font-black text-xl leading-tight tracking-tight text-foreground">
                        {promo.name}
                      </h3>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold px-3">
                        {promo.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium pr-12">
                      {promo.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Details Section */}
                <div className="mt-6 flex flex-col gap-4">
                  {/* Requirements */}
                  {promo.conditions?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        Requirements
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {promo.conditions.map((cond: any) => (
                          <div key={cond.id} className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/50 text-xs font-bold transition-colors group-hover:bg-background">
                            {cond.condition_type === 'MinAmount' ? (
                              <>
                                <Tag className="w-3.5 h-3.5 text-primary" />
                                <span>Min Bill LKR {Number(cond.requirement_value).toLocaleString()}</span>
                              </>
                            ) : cond.condition_type === 'ItemList' ? (
                              <>
                                <Percent className="w-3.5 h-3.5 text-primary" />
                                <span>Specific Items: {Object.values(cond.item_names || {}).join(", ") || "Selected Products"}</span>
                              </>
                            ) : (
                              <span>{cond.condition_type}: {cond.requirement_value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Benefits */}
                  {promo.benefits?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 flex items-center gap-1.5">
                        Benefits & Rewards
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {promo.benefits.map((ben: any) => (
                          <div key={ben.id} className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-xl border border-orange-100 dark:border-orange-500/20 text-xs font-black">
                            {ben.benefit_type === 'Percentage' ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{Number(ben.benefit_value).toFixed(0)}% DISCOUNT</span>
                              </>
                            ) : ben.benefit_type === 'BuyXGetY' ? (
                              <>
                                <Gift className="w-3.5 h-3.5" />
                                <span>BUY {ben.trigger_qty} OF {Object.values(ben.trigger_item_names || {}).join(", ")} GET {ben.reward_qty} FREE</span>
                              </>
                            ) : (
                              <span>{ben.benefit_type}: {ben.benefit_value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-4 border-t border-dashed flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full text-xs font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {promo.start_date ? format(new Date(promo.start_date), "MMM d") : "Always"}
                        {" - "}
                        {promo.end_date ? format(new Date(promo.end_date), "MMM d, yyyy") : "Ongoing"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/50" />
                      <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/80">
                        Active Now
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-full group-hover:bg-primary transition-all group-hover:rotate-12">
                    <Info className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

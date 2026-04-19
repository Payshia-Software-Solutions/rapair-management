"use client";

import React, { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { savePromotion, fetchPromotion } from "@/lib/api";
import { 
  Zap, 
  Save, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import { PromotionItemSelector } from "./PromotionItemSelector";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface ItemQtyRewardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const ItemQtyRewardModal: React.FC<ItemQtyRewardModalProps> = ({
  open,
  onOpenChange,
  promotionId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    id: null as number | null,
    name: "",
    description: "",
    type: "BOGO",
    buy_qty: "10",
    get_qty: "1",
    item_id: null as number | null,
    reward_item_id: null as number | null,
    is_same_item: true,
    discount_pct: "100",
    applicable_locations: [] as number[]
  });

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
         id: null,
         name: "",
         description: "Loyalty reward: Buy 10 and get the 11th free.",
         type: "BOGO",
         buy_qty: "10",
         get_qty: "1",
         item_id: null,
         reward_item_id: null,
         is_same_item: true,
         discount_pct: "100",
         applicable_locations: []
      });
    }
  }, [open, promotionId]);

  const loadPromotion = async (id: number) => {
    setLoading(true);
    try {
      const data = await fetchPromotion(id);
      if (data) {
        const benefit = data.benefits?.[0];
        const triggerItems = JSON.parse(benefit?.trigger_items || '[]');
        const rewardItems = JSON.parse(benefit?.reward_items || '[]');

        setForm({
          id: data.id,
          name: data.name,
          description: data.description || "",
          type: "BOGO",
          buy_qty: String(benefit?.trigger_qty || "10"),
          get_qty: String(benefit?.reward_qty || "1"),
          item_id: triggerItems[0] || null,
          reward_item_id: rewardItems[0] || null,
          is_same_item: benefit?.trigger_items === benefit?.reward_items,
          discount_pct: String(benefit?.benefit_discount_pct || "100"),
          applicable_locations: Array.isArray(data.applicable_locations) 
            ? data.applicable_locations.map(Number) 
            : (typeof data.applicable_locations === 'string' ? JSON.parse(data.applicable_locations || '[]').map(Number) : [])
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name) return toast({ title: "Name Required", description: "Give your loyalty rule a name." });
    if (!form.item_id) return toast({ title: "Item Required", description: "Please select an item." });
    
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        type: "BOGO",
        start_date: null,
        end_date: null,
        is_active: true,
        priority: 25,
        applicable_locations: form.applicable_locations,
        conditions: [],
        benefits: [
            { 
              benefit_type: "BuyXGetY", 
              trigger_qty: form.buy_qty,
              reward_qty: form.get_qty,
              trigger_items: JSON.stringify([form.item_id]),
              reward_items: JSON.stringify(form.is_same_item ? [form.item_id] : [form.reward_item_id]), 
              benefit_discount_pct: form.discount_pct
            }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "Loyalty reward rule saved." });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-950">
        <div className="bg-purple-600 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <RefreshCw className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Zap className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Item Quantity Reward</DialogTitle>
                <DialogDescription className="text-purple-50 font-medium">Classic "Buy 10 Get 1 Free" same-item rules.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Rule Name</Label>
                    <Input 
                        placeholder="e.g. 10th Wash Free"
                        className="h-12 rounded-xl font-bold"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Available Locations</Label>
                    <MultiLocationSelector 
                        selectedIds={form.applicable_locations}
                        onChange={(ids) => setForm({...form, applicable_locations: ids})}
                    />
                  </div>
                  
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] space-y-4 border-2 border-dashed border-purple-100 dark:border-purple-900/30">
                     <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-purple-600">Buy Quantity</Label>
                        <Input 
                            type="number"
                            className="h-12 rounded-xl font-black text-center w-24"
                            value={form.buy_qty}
                            onChange={(e) => setForm({...form, buy_qty: e.target.value})}
                        />
                     </div>
                     <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Get Free</Label>
                        <Input 
                            type="number"
                            className="h-12 rounded-xl font-black text-center w-24 border-emerald-200"
                            value={form.get_qty}
                            onChange={(e) => setForm({...form, get_qty: e.target.value})}
                        />
                     </div>
                     <p className="text-[9px] font-black text-muted-foreground uppercase text-center opacity-40">Applies per item in cart individually</p>
                  </div>
              </div>

               <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">1. Customer Buys This Item</Label>
                    <PromotionItemSelector 
                        selectedId={form.item_id}
                        onChange={(id) => setForm({...form, item_id: id})}
                        placeholder="Pick an item..."
                    />
                 </div>

                 <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-between border-2 border-dashed border-purple-100 dark:border-purple-900/20">
                    <div className="space-y-0.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-purple-600">Reward same item?</Label>
                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">If off, pick a different gift.</p>
                    </div>
                    <Switch 
                        checked={form.is_same_item}
                        onCheckedChange={(val) => setForm({...form, is_same_item: val})}
                    />
                 </div>

                 {!form.is_same_item && (
                     <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">2. Customer Gets This Item Free</Label>
                        <PromotionItemSelector 
                            selectedId={form.reward_item_id}
                            onChange={(id) => setForm({...form, reward_item_id: id})}
                            placeholder="Pick reward item..."
                        />
                     </div>
                 )}
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Cancel</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-600/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Reward Rule
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
import { useToast } from "@/hooks/use-toast";
import { savePromotion, fetchPromotion } from "@/lib/api";
import { 
  Sparkles, 
  Plus, 
  Save, 
  Loader2, 
  ArrowRight 
} from "lucide-react";
import { PromotionItemSelector } from "./PromotionItemSelector";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface BOGOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const BOGOModal: React.FC<BOGOModalProps> = ({
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
    trigger_qty: "1",
    reward_qty: "1",
    trigger_item_id: null as number | null,
    reward_item_id: null as number | null,
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
         description: "Buy items from Set A, get items from Set B free.",
         type: "BOGO",
         trigger_qty: "1",
         reward_qty: "1",
         trigger_item_id: null,
         reward_item_id: null,
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
        
        // Parse locations
        let locations = [];
        try {
            locations = typeof data.applicable_locations === 'string' 
                ? JSON.parse(data.applicable_locations || '[]')
                : (data.applicable_locations || []);
        } catch(e) { /* fallback */ }

        setForm({
          id: data.id,
          name: data.name,
          description: data.description || "",
          type: "BOGO",
          trigger_qty: String(benefit?.trigger_qty || "1"),
          reward_qty: String(benefit?.reward_qty || "1"),
          trigger_item_id: triggerItems[0] ? Number(triggerItems[0]) : null,
          reward_item_id: rewardItems[0] ? Number(rewardItems[0]) : null,
          discount_pct: String(benefit?.benefit_discount_pct || "100"),
          applicable_locations: Array.isArray(locations) ? locations.map(Number) : []
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
    if (!form.name) return toast({ title: "Name Required", description: "Give your BOGO offer a name." });
    if (!form.trigger_item_id || !form.reward_item_id) {
        return toast({ title: "Items Required", description: "Select both trigger and reward items." });
    }
    
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        applicable_locations: form.applicable_locations,
        type: "BOGO",
        start_date: null,
        end_date: null,
        is_active: true,
        priority: 30,
        conditions: [], // Rule is embedded in the benefit
        benefits: [
            { 
              benefit_type: "BuyXGetY", 
              trigger_qty: form.trigger_qty,
              reward_qty: form.reward_qty,
              trigger_items: JSON.stringify([form.trigger_item_id]),
              reward_items: JSON.stringify([form.reward_item_id]),
              benefit_discount_pct: form.discount_pct
            }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "BOGO promotion saved." });
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-950 max-h-[90vh] flex flex-col">
        <div className="bg-amber-500 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Sparkles className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Buy X Get Y Free</DialogTitle>
                <DialogDescription className="text-amber-50 font-medium">Cross-item rewards and multi-buy deals.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Promotion Name</Label>
                    <Input 
                        placeholder="e.g. Free Soda with Pizza"
                        className="h-12 rounded-xl font-bold"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Available Locations</Label>
                    <MultiLocationSelector 
                        selectedIds={form.applicable_locations}
                        onChange={(ids) => setForm({...form, applicable_locations: ids})}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-t-4 border-amber-500">
                    <Label className="text-[10px] font-black uppercase tracking-widest block mb-4 text-amber-600">Step 1: The Buy Requirement</Label>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-bold uppercase w-20">Buy Qty:</span>
                        <Input 
                            type="number"
                            className="h-12 rounded-xl font-black text-center w-24"
                            value={form.trigger_qty}
                            onChange={(e) => setForm({...form, trigger_qty: e.target.value})}
                        />
                    </div>
                    <PromotionItemSelector 
                        selectedId={form.trigger_item_id}
                        onChange={(id) => setForm({...form, trigger_item_id: id})}
                        placeholder="Pick trigger item..."
                    />
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Public Message</Label>
                    <Input 
                        placeholder="e.g. Get a free drink when you buy 2 pizzas!"
                        className="h-12 rounded-xl font-bold"
                        value={form.description}
                        onChange={(e) => setForm({...form, description: e.target.value})}
                    />
                  </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-t-4 border-emerald-500">
                    <Label className="text-[10px] font-black uppercase tracking-widest block mb-4 text-emerald-600">Step 2: The Reward</Label>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-bold uppercase w-20">Get Qty:</span>
                        <Input 
                            type="number"
                            className="h-12 rounded-xl font-black text-center w-24 border-emerald-200"
                            value={form.reward_qty}
                            onChange={(e) => setForm({...form, reward_qty: e.target.value})}
                        />
                         <span className="text-xs font-bold uppercase ml-2">at</span>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number"
                                className="h-12 rounded-xl font-black text-center w-20"
                                value={form.discount_pct}
                                onChange={(e) => setForm({...form, discount_pct: e.target.value})}
                            />
                            <span className="text-lg font-black">% OFF</span>
                        </div>
                    </div>
                    <PromotionItemSelector 
                        selectedId={form.reward_item_id}
                        onChange={(id) => setForm({...form, reward_item_id: id})}
                        placeholder="Pick reward item..."
                    />
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Cancel</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save BOGO
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

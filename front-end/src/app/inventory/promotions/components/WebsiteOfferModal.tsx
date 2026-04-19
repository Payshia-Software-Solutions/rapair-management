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
  Globe, 
  Save, 
  Loader2, 
  MousePointerClick,
  Laptop
} from "lucide-react";
import { PromotionItemSelector } from "./PromotionItemSelector";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface WebsiteOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const WebsiteOfferModal: React.FC<WebsiteOfferModalProps> = ({
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
    type: "Discount",
    percentage: "5",
    item_id: null as number | null,
    promo_code: "",
    applicable_locations: [] as number[]
  });

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
         id: null,
         name: "",
         description: "Digital offer for website visitors.",
         type: "Discount",
         percentage: "5",
         item_id: null,
         promo_code: "WEB" + Math.floor(1000 + Math.random() * 9000),
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
        const cond = data.conditions?.find((c: any) => c.condition_type === 'ItemList');
        
        setForm({
          id: data.id,
          name: data.name,
          description: data.description || "",
          type: "Discount",
          percentage: String(benefit?.benefit_value || "0"),
          item_id: cond ? JSON.parse(cond.requirement_value || '[]')[0] : null,
          promo_code: data.name, // Using name for promo code for now
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
    if (!form.name) return toast({ title: "Name Required", description: "Give your website offer a name." });
    
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: `[WEBSITE] ${form.description}`,
        type: "Discount",
        start_date: null,
        end_date: null,
        is_active: true,
        priority: 5,
        applicable_locations: form.applicable_locations,
        conditions: form.item_id ? [
            { 
              condition_type: "ItemList", 
              requirement_value: JSON.stringify([form.item_id]), 
              operator: "IN" 
            }
        ] : [],
        benefits: [
            { 
              benefit_type: "Percentage", 
              benefit_value: form.percentage 
            }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "Website offer published." });
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
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-950">
        <div className="bg-indigo-600 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Laptop className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Globe className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Website Offer</DialogTitle>
                <DialogDescription className="text-indigo-50 font-medium">Create digital-only discounts for your online store.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Offer Title</Label>
                    <Input 
                        placeholder="e.g. 5% Off for Web Orders"
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
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-indigo-100 dark:border-indigo-900/30">
                     <div className="flex flex-col items-center gap-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Discount Strength</Label>
                         <div className="flex items-center gap-2">
                             <Input 
                                type="number"
                                className="h-16 w-24 rounded-2xl text-2xl font-black text-center"
                                value={form.percentage}
                                onChange={(e) => setForm({...form, percentage: e.target.value})}
                             />
                             <span className="text-2xl font-black">%</span>
                         </div>
                     </div>
                  </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Target Item (Optional)</Label>
                    <PromotionItemSelector 
                        selectedId={form.item_id}
                        onChange={(id) => setForm({...form, item_id: id})}
                        placeholder="All items if empty..."
                    />
                    <p className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase">Leave empty for store-wide web discount</p>
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Cancel</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MousePointerClick className="w-4 h-4 mr-2" />}
              Publish Web Offer
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

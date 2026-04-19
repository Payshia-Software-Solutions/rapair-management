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
  Package, 
  Plus, 
  Save, 
  Loader2, 
  Boxes 
} from "lucide-react";
import { MultiItemSelector } from "./MultiItemSelector";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface BundleOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const BundleOfferModal: React.FC<BundleOfferModalProps> = ({
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
    type: "Bundle",
    bundle_price: "0",
    item_ids: [] as number[],
    applicable_locations: [] as number[]
  });

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
         id: null,
         name: "",
         description: "Special fixed price for this item set.",
         type: "Bundle",
         bundle_price: "0",
         item_ids: [],
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
          type: "Bundle",
          bundle_price: String(benefit?.benefit_value || "0"),
          item_ids: cond ? JSON.parse(cond.requirement_value || '[]') : [],
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
    if (!form.name) return toast({ title: "Name Required", description: "Give your bundle a catchy name." });
    if (form.item_ids.length === 0) return toast({ title: "Items Required", description: "At least one item must be in the bundle." });
    
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        type: "Bundle",
        start_date: null,
        end_date: null,
        is_active: true,
        priority: 20,
        applicable_locations: form.applicable_locations,
        conditions: [
            { 
              condition_type: "ItemList", 
              requirement_value: JSON.stringify(form.item_ids), 
              operator: "IN" 
            }
        ],
        benefits: [
            { 
              benefit_type: "FixedPrice", 
              benefit_value: form.bundle_price 
            }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "Bundle offer saved." });
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
        <div className="bg-blue-500 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Boxes className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Package className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Bundle Offer</DialogTitle>
                <DialogDescription className="text-blue-50 font-medium">Sell a group of items for a fixed price.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bundle Name</Label>
                    <Input 
                        placeholder="e.g. Breakfast Combo"
                        className="h-12 rounded-xl font-bold"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Public Description</Label>
                    <Input 
                        placeholder="e.g. Save 10% when bought together"
                        className="h-12 rounded-xl font-bold"
                        value={form.description}
                        onChange={(e) => setForm({...form, description: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Available Locations</Label>
                    <MultiLocationSelector 
                        selectedIds={form.applicable_locations}
                        onChange={(ids) => setForm({...form, applicable_locations: ids})}
                    />
                </div>
                <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 block tracking-[0.2em]">Bundle Price (Total)</Label>
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-400">LKR</span>
                        <Input 
                            type="number"
                            className="h-14 rounded-2xl text-2xl font-black bg-slate-50 dark:bg-slate-900 border-none shadow-inner"
                            value={form.bundle_price}
                            onChange={(e) => setForm({...form, bundle_price: e.target.value})}
                        />
                    </div>
                </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Qualifying Items</Label>
                 <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-blue-100 dark:border-blue-900/30 min-h-[200px]">
                    <MultiItemSelector 
                        selectedIds={form.item_ids}
                        onChange={(ids) => setForm({...form, item_ids: ids})}
                        placeholder="Add items to bundle..."
                    />
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Discard</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-blue-500 hover:bg-blue-600 text-white shadow-xl shadow-blue-500/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Publish Bundle
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

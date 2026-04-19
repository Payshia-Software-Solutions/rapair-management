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
  Tag, 
  Calendar, 
  Save, 
  Loader2, 
  Percent 
} from "lucide-react";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface SeasonalDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const SeasonalDiscountModal: React.FC<SeasonalDiscountModalProps> = ({
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
    start_date: "",
    end_date: "",
    is_active: true,
    percentage: "0",
    applicable_locations: [] as number[]
  });

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
         id: null,
         name: "",
         description: "Store-wide seasonal discount.",
         type: "Discount",
         start_date: new Date().toISOString().split('T')[0],
         end_date: "",
         is_active: true,
         percentage: "10",
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
        setForm({
          id: data.id,
          name: data.name,
          description: data.description || "",
          type: "Discount",
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          is_active: Boolean(Number(data.is_active)),
          percentage: String(benefit?.benefit_value || "0"),
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
    if (!form.name) return toast({ title: "Name Required", description: "Please give this seasonal offer a name." });
    
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        type: "Discount",
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
        priority: 10,
        applicable_locations: form.applicable_locations,
        conditions: [], // Store-wide has no conditions
        benefits: [
            { 
              benefit_type: "Percentage", 
              benefit_value: form.percentage 
            }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "Seasonal discount deployed." });
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
        <div className="bg-emerald-500 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Percent className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Tag className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Seasonal Discount</DialogTitle>
                <DialogDescription className="text-emerald-50 font-medium">Simple store-wide percentage offers.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Campaign Name</Label>
               <Input 
                 placeholder="e.g. New Year Sale 2024"
                 className="h-12 rounded-xl font-bold"
                 value={form.name}
                 onChange={(e) => setForm({...form, name: e.target.value})}
               />
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Available Locations</Label>
               <MultiLocationSelector 
                   selectedIds={form.applicable_locations}
                   onChange={(ids) => setForm({...form, applicable_locations: ids})}
               />
            </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start Date</Label>
                    <Input 
                        type="date"
                        className="h-12 rounded-xl font-bold"
                        value={form.start_date}
                        onChange={(e) => setForm({...form, start_date: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">End Date (Optional)</Label>
                    <Input 
                        type="date"
                        className="h-12 rounded-xl font-bold"
                        value={form.end_date}
                        onChange={(e) => setForm({...form, end_date: e.target.value})}
                    />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] p-6 flex flex-col items-center justify-center border-2 border-dashed border-emerald-100 dark:border-emerald-900/30">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4">Discount Strength</Label>
                 <div className="flex items-center gap-2">
                    <Input 
                        type="number"
                        className="w-20 h-16 rounded-2xl text-2xl font-black text-center border-none bg-white dark:bg-slate-950 shadow-xl"
                        value={form.percentage}
                        onChange={(e) => setForm({...form, percentage: e.target.value})}
                    />
                    <span className="text-3xl font-black text-emerald-500">%</span>
                 </div>
                 <p className="text-[9px] font-bold text-muted-foreground mt-4 uppercase">OFF EVERYTHING</p>
              </div>
           </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Cancel</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Discount
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

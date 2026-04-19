"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { savePromotion, fetchPromotion, fetchBanks, type Bank } from "@/lib/api";
import { 
  Building2, 
  Save, 
  Loader2, 
  Percent,
  CreditCard 
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiLocationSelector } from "./MultiLocationSelector";
import { cn } from "@/lib/utils";

interface BankOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const BankOfferModal: React.FC<BankOfferModalProps> = ({
  open,
  onOpenChange,
  promotionId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  
  const [form, setForm] = useState({
    id: null as number | null,
    name: "",
    description: "",
    type: "Discount",
    bank_id: null as string | null,
    card_category: "Any", // Any, Credit, Debit
    discount_pct: "10",
    min_amount: "0",
    applicable_locations: [] as number[]
  });

  useEffect(() => {
    if (open) {
        void loadBanks();
    }
  }, [open]);

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
         id: null,
         name: "",
         description: "Special discount for bank card holders.",
         type: "Discount",
         bank_id: null,
         card_category: "Any",
         discount_pct: "10",
         min_amount: "0",
         applicable_locations: []
      });
    }
  }, [open, promotionId]);

  const loadBanks = async () => {
    try {
        const data = await fetchBanks();
        setBanks(data);
    } catch (e) {
        console.error(e);
    }
  };

  const loadPromotion = async (id: number) => {
    setLoading(true);
    try {
      const data = await fetchPromotion(id);
      if (data) {
        const bankCond = data.conditions?.find((c: any) => c.condition_type === 'BankCard');
        const cardCond = data.conditions?.find((c: any) => c.condition_type === 'CardCategory');
        const minAmtCond = data.conditions?.find((c: any) => c.condition_type === 'MinAmount');
        const benefit = data.benefits?.[0];

        setForm({
          id: data.id,
          name: data.name,
          description: data.description || "",
          type: "Discount",
          bank_id: bankCond ? String(bankCond.requirement_value) : null,
          card_category: cardCond ? String(cardCond.requirement_value) : "Any",
          discount_pct: String(benefit?.benefit_value || "10"),
          min_amount: minAmtCond ? String(minAmtCond.requirement_value) : "0",
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
    if (!form.name) return toast({ title: "Name Required", description: "Give your bank offer a name." });
    if (!form.bank_id) return toast({ title: "Bank Required", description: "Select the target bank." });
    
    setSaving(true);
    try {
      const conditions = [
        { condition_type: "BankCard", requirement_value: form.bank_id, operator: "=" },
        { condition_type: "CardCategory", requirement_value: form.card_category, operator: "=" }
      ];

      if (parseFloat(form.min_amount) > 0) {
          conditions.push({ condition_type: "MinAmount", requirement_value: form.min_amount, operator: ">=" });
      }

      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        type: "Discount",
        start_date: null,
        end_date: null,
        is_active: true,
        priority: 50, // Bank offers usually have higher priority
        applicable_locations: form.applicable_locations,
        conditions,
        benefits: [
            { benefit_type: "Percentage", benefit_value: form.discount_pct }
        ]
      };
      await savePromotion(payload);
      toast({ title: "Success", description: "Bank offer saved." });
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
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[2rem] bg-white dark:bg-slate-950">
        <div className="bg-indigo-600 p-8 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <CreditCard className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <Building2 className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black text-white">Bank card Offer</DialogTitle>
                <DialogDescription className="text-indigo-50 font-medium">Automatic discounts for specific bank cards.</DialogDescription>
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Offer Name</Label>
                    <Input 
                        placeholder="e.g. Sampath Bank 10% Discount"
                        className="h-12 rounded-xl font-bold"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Card Category</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {['Any', 'Credit', 'Debit'].map((cat) => (
                            <Button 
                                key={cat}
                                type="button"
                                variant={form.card_category === cat ? "default" : "outline"}
                                className={cn(
                                    "h-10 rounded-xl font-bold text-[10px] transition-all",
                                    form.card_category === cat ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" : "border-slate-200"
                                )}
                                onClick={() => setForm({...form, card_category: cat})}
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Bank</Label>
                    <SearchableSelect 
                        options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                        value={form.bank_id}
                        onValueChange={(val) => setForm({...form, bank_id: val})}
                        placeholder="Select Bank..."
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Available Locations</Label>
                    <MultiLocationSelector 
                        selectedIds={form.applicable_locations}
                        onChange={(ids) => setForm({...form, applicable_locations: ids})}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Discount %</Label>
                        <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                            <Input 
                                type="number"
                                className="h-12 rounded-xl font-black pl-10"
                                value={form.discount_pct}
                                onChange={(e) => setForm({...form, discount_pct: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Min Bill Amount</Label>
                        <Input 
                            type="number"
                            className="h-12 rounded-xl font-bold text-center"
                            value={form.min_amount}
                            onChange={(e) => setForm({...form, min_amount: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
           <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-xs uppercase tracking-widest h-12">Cancel</Button>
           <Button onClick={handleSave} className="rounded-xl font-black text-xs uppercase tracking-widest h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Bank Offer
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

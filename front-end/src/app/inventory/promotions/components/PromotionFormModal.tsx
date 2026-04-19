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
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { savePromotion, fetchPromotion } from "@/lib/api";
import { 
  Gift, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  Settings2,
  Calendar,
  Sparkles,
  Zap,
  Tag
} from "lucide-react";
import { MultiItemSelector } from "./MultiItemSelector";
import { MultiLocationSelector } from "./MultiLocationSelector";

interface PromotionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}

export const PromotionFormModal: React.FC<PromotionFormModalProps> = ({
  open,
  onOpenChange,
  promotionId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState<any>({
    id: null,
    name: "",
    description: "",
    type: "Discount",
    start_date: "",
    end_date: "",
    is_active: true,
    priority: 0,
    applicable_locations: [] as number[],
    conditions: [],
    benefits: []
  });

  useEffect(() => {
    if (open && promotionId) {
      void loadPromotion(promotionId);
    } else if (open) {
      setForm({
        id: null,
        name: "",
        description: "",
        type: "Discount",
        start_date: "",
        end_date: "",
        is_active: true,
        priority: 0,
        applicable_locations: [],
        conditions: [
          { condition_type: "MinAmount", requirement_value: "0", operator: ">=" }
        ],
        benefits: [
          { benefit_type: "Percentage", benefit_value: "0" }
        ]
      });
    }
  }, [open, promotionId]);

  const loadPromotion = async (id: number) => {
    setLoading(true);
    try {
      const data = await fetchPromotion(id);
      if (data) {
        setForm({
          ...data,
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          is_active: Boolean(Number(data.is_active)),
          priority: Number(data.priority),
          applicable_locations: Array.isArray(data.applicable_locations) 
            ? data.applicable_locations.map(Number) 
            : (typeof data.applicable_locations === 'string' ? JSON.parse(data.applicable_locations || '[]').map(Number) : []),
          conditions: data.conditions || [],
          benefits: data.benefits || []
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    setForm((prev: any) => ({
      ...prev,
      conditions: [...prev.conditions, { condition_type: "MinQty", requirement_value: "1", operator: ">=" }]
    }));
  };

  const removeCondition = (idx: number) => {
    setForm((prev: any) => ({
      ...prev,
      conditions: prev.conditions.filter((_: any, i: number) => i !== idx)
    }));
  };

  const updateCondition = (idx: number, field: string, val: any) => {
    setForm((prev: any) => {
      const next = [...prev.conditions];
      const current = next[idx];
      
      // Reset requirement value when type changes to avoid parsing errors
      if (field === 'condition_type' && val !== current.condition_type) {
        next[idx] = { 
          ...current, 
          [field]: val, 
          requirement_value: val === 'ItemList' ? '[]' : '0' 
        };
      } else {
        next[idx] = { ...current, [field]: val };
      }
      
      return { ...prev, conditions: next };
    });
  };

  const addBenefit = () => {
    setForm((prev: any) => ({
      ...prev,
      benefits: [...prev.benefits, { benefit_type: "Percentage", benefit_value: "0" }]
    }));
  };

  const removeBenefit = (idx: number) => {
    setForm((prev: any) => ({
      ...prev,
      benefits: prev.benefits.filter((_: any, i: number) => i !== idx)
    }));
  };

  const updateBenefit = (idx: number, field: string, val: any) => {
    setForm((prev: any) => {
      const next = [...prev.benefits];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, benefits: next };
    });
  };

  const handleSave = async () => {
    if (!form.name) return toast({ title: "Validation Error", description: "Promotion name is required" });
    
    setSaving(true);
    try {
      await savePromotion(form);
      toast({ title: "Success", description: "Promotion rule persisted successfully." });
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-slate-50 dark:bg-slate-950 max-h-[90vh] flex flex-col">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-primary to-blue-700 p-8 text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Gift className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                {promotionId ? <Settings2 className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
            </div>
            <div>
              <DialogTitle className="text-3xl font-black tracking-tight text-white mb-1">
                {promotionId ? "Edit Promotion" : "Create New Promotion"}
              </DialogTitle>
              <DialogDescription className="text-blue-50 font-medium text-sm">
                Define the logic and rewards that will trigger automatically at the POS.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Section - Scrollable */}
        <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
             <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Hydrating Rule Data...</p>
             </div>
          ) : (
            <>
              {/* Basic configuration Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Name / Campaign Title</Label>
                    <Input 
                      placeholder="e.g. Seasonal Summer Bundle"
                      className="h-12 rounded-xl focus:ring-primary font-bold shadow-sm"
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Available Locations</Label>
                    <MultiLocationSelector 
                        selectedIds={form.applicable_locations || []}
                        onChange={(ids) => setForm({...form, applicable_locations: ids})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Promotion Type</Label>
                    <Select value={form.type} onValueChange={(val) => setForm({...form, type: val})}>
                      <SelectTrigger className="h-12 rounded-xl font-bold shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="Discount" className="font-bold py-3"><div className="flex items-center gap-2"><Tag className="w-4 h-4 text-emerald-500" /> Standard Discount</div></SelectItem>
                        <SelectItem value="Bundle" className="font-bold py-3"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" /> Seasonal Bundle</div></SelectItem>
                        <SelectItem value="BOGO" className="font-bold py-3"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Buy 1 Get 1 (Free)</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                     <div className="space-y-0.5">
                        <Label className="text-xs font-black uppercase tracking-tight">Active Status</Label>
                        <p className="text-[10px] text-muted-foreground font-medium">Toggle availability at terminals</p>
                     </div>
                     <Switch 
                       checked={form.is_active}
                       onCheckedChange={(val) => setForm({...form, is_active: val})}
                     />
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Starts From</Label>
                        <Input 
                          type="date"
                          className="h-12 rounded-xl focus:ring-primary font-bold shadow-sm"
                          value={form.start_date}
                          onChange={(e) => setForm({...form, start_date: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Valid Until</Label>
                        <Input 
                          type="date"
                          className="h-12 rounded-xl focus:ring-primary font-bold shadow-sm"
                          value={form.end_date}
                          onChange={(e) => setForm({...form, end_date: e.target.value})}
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Evaluation Priority (0-999)</Label>
                    <Input 
                      type="number"
                      placeholder="High numbers resolve first"
                      className="h-12 rounded-xl focus:ring-primary font-bold shadow-sm"
                      value={form.priority}
                      onChange={(e) => setForm({...form, priority: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Public Description</Label>
                    <Input 
                      placeholder="What customers see in the suggestion dialog..."
                      className="h-12 rounded-xl focus:ring-primary font-bold shadow-sm"
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Conditions Logic Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 rounded-md flex items-center justify-center text-[10px]">1</div> 
                        Conditions (When to apply?)
                    </h3>
                    <Button variant="outline" size="sm" onClick={addCondition} className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest border-2">
                        <Plus className="w-3 h-3 mr-1" /> Add Rule
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {form.conditions.map((cond: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Select value={cond.condition_type} onValueChange={(v) => updateCondition(idx, 'condition_type', v)}>
                            <SelectTrigger className="h-10 rounded-lg text-xs font-bold border-none bg-slate-50 dark:bg-slate-950/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-none shadow-2xl">
                              <SelectItem value="MinAmount" className="text-xs font-bold">Minimum Cart Total</SelectItem>
                              <SelectItem value="MinQty" className="text-xs font-bold">Minimum Item Count</SelectItem>
                              <SelectItem value="ItemList" className="text-xs font-bold">Specific Items Only</SelectItem>
                              <SelectItem value="BankCard" className="text-xs font-bold">Specific Bank Card</SelectItem>
                              <SelectItem value="CardCategory" className="text-xs font-bold">Card Category (Credit/Debit)</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {cond.condition_type !== 'ItemList' && (
                            <div className="flex gap-2">
                                <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, 'operator', v)}>
                                <SelectTrigger className="h-10 w-32 rounded-lg text-xs font-bold border-none bg-slate-50 dark:bg-slate-950/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-none shadow-2xl">
                                    <SelectItem value=">=" className="text-xs font-bold">at least {'>='}</SelectItem>
                                    <SelectItem value="=" className="text-xs font-bold">exactly {'='}</SelectItem>
                                </SelectContent>
                                </Select>
                                <Input 
                                type="number"
                                placeholder="Value"
                                className="h-10 rounded-lg text-xs font-bold border-none bg-slate-50 dark:bg-slate-950/50"
                                value={cond.requirement_value}
                                onChange={(e) => updateCondition(idx, 'requirement_value', e.target.value)}
                                />
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500 hover:bg-rose-50" onClick={() => removeCondition(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {cond.condition_type === 'ItemList' && (
                         <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Apply only when cart contains these items:</Label>
                            <MultiItemSelector 
                                selectedIds={(() => {
                                    try {
                                        const parsed = JSON.parse(cond.requirement_value || '[]');
                                        return Array.isArray(parsed) ? parsed.map(Number) : [];
                                    } catch {
                                        return [];
                                    }
                                })()}
                                onChange={(ids) => updateCondition(idx, 'requirement_value', JSON.stringify(ids))}
                                placeholder="Select qualifying items..."
                            />
                         </div>
                      )}
                    </div>
                  ))}
                  {form.conditions.length === 0 && (
                    <div className="py-8 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center opacity-70">
                        <AlertCircle className="w-6 h-6 text-slate-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No conditions set. This will apply to every order!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Benefits Section */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 rounded-md flex items-center justify-center text-[10px]">2</div> 
                        Benefits (What is the reward?)
                    </h3>
                    {form.benefits.length === 0 && (
                        <Button variant="outline" size="sm" onClick={addBenefit} className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest border-2">
                            <Plus className="w-3 h-3 mr-1" /> Add Benefit
                        </Button>
                    )}
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {form.benefits.map((benefit: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <Select value={benefit.benefit_type} onValueChange={(v) => updateBenefit(idx, 'benefit_type', v)}>
                          <SelectTrigger className="h-10 flex-1 rounded-lg text-xs font-bold border-none bg-slate-50 dark:bg-slate-950/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-none shadow-2xl">
                            <SelectItem value="Percentage" className="text-xs font-bold italic">Bill-wide Percentage Discount (%)</SelectItem>
                            <SelectItem value="FixedAmount" className="text-xs font-bold italic">Bill-wide Fixed Amount (LKR)</SelectItem>
                            <SelectItem value="BuyXGetY" className="text-xs font-bold text-primary">Bundle Promotion (Buy X Get Y Free/Discounted)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500 hover:bg-rose-50" onClick={() => removeBenefit(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {benefit.benefit_type === 'BuyXGetY' ? (
                        <div className="space-y-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">1. Step One: Requirement</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase w-12">Buy Qty:</span>
                                    <Input 
                                        type="number"
                                        className="h-10 flex-1 rounded-lg font-bold"
                                        value={benefit.trigger_qty}
                                        onChange={(e) => updateBenefit(idx, 'trigger_qty', e.target.value)}
                                    />
                                </div>
                                <MultiItemSelector 
                                    selectedIds={(() => {
                                        try {
                                            const parsed = JSON.parse(benefit.trigger_items || '[]');
                                            return Array.isArray(parsed) ? parsed.map(Number) : [];
                                        } catch {
                                            return [];
                                        }
                                    })()}
                                    onChange={(ids) => updateBenefit(idx, 'trigger_items', JSON.stringify(ids))}
                                    placeholder="Items to buy..."
                                />
                              </div>
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-500">2. Step Two: Reward</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase w-12 text-emerald-600">Get Qty:</span>
                                    <Input 
                                        type="number"
                                        className="h-10 flex-1 rounded-lg font-bold border-emerald-100 bg-emerald-50/20"
                                        value={benefit.reward_qty}
                                        onChange={(e) => updateBenefit(idx, 'reward_qty', e.target.value)}
                                    />
                                </div>
                                <MultiItemSelector 
                                    selectedIds={(() => {
                                        try {
                                            const parsed = JSON.parse(benefit.reward_items || '[]');
                                            return Array.isArray(parsed) ? parsed.map(Number) : [];
                                        } catch {
                                            return [];
                                        }
                                    })()}
                                    onChange={(ids) => updateBenefit(idx, 'reward_items', JSON.stringify(ids))}
                                    placeholder="Items to get free/discounted..."
                                />
                              </div>
                           </div>
                           <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <Label className="text-[10px] font-black uppercase tracking-widest block mb-2">Reward Discount Strength</Label>
                                <div className="flex items-center gap-4">
                                    <Input 
                                        type="number"
                                        className="h-10 w-32 rounded-lg font-black text-center"
                                        value={benefit.benefit_discount_pct}
                                        onChange={(e) => updateBenefit(idx, 'benefit_discount_pct', e.target.value)}
                                    />
                                    <span className="text-xs font-bold text-muted-foreground">% Off (Set to 100 for completely free items)</span>
                                </div>
                           </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                           <Label className="text-xs font-black uppercase w-32">Discount Value:</Label>
                           <Input 
                                type="number"
                                placeholder="Amount/Percent"
                                className="h-10 flex-1 rounded-lg text-xs font-bold border-none"
                                value={benefit.benefit_value}
                                onChange={(e) => updateBenefit(idx, 'benefit_value', e.target.value)}
                                />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Section */}
        <DialogFooter className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex w-full items-center justify-between">
            <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
               <Calendar className="w-4 h-4" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Saved rules sync to POS automatically</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)} 
                className="flex-1 sm:flex-initial h-12 rounded-xl text-xs font-black uppercase tracking-widest"
              >
                Discard
              </Button>
              <Button 
                onClick={handleSave} 
                className="flex-[2] sm:flex-initial h-12 px-8 rounded-xl text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
                disabled={saving || loading}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {promotionId ? "Save Changes" : "Deploy Promotion"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Internal Loader Icon (Missing from lucide-react in previous block usage)
const Loader2 = ({ className }: { className?: string }) => (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

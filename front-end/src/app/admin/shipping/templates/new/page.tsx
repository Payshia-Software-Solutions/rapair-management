"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { createCostingTemplate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft, 
  Loader2,
  Calculator,
  Info
} from "lucide-react";
import Link from "next/link";

export default function CreateTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState({
    name: "",
    items: [{ name: "Fuel Surcharge", cost_type: "Percentage", value: 0 }]
  });

  const handleAddComponent = () => {
    setTemplate({
      ...template,
      items: [...template.items, { name: "", cost_type: "Fixed", value: 0 }]
    });
  };

  const handleRemoveComponent = (idx: number) => {
    const items = [...template.items];
    items.splice(idx, 1);
    setTemplate({ ...template, items });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...template.items];
    (items[idx] as any)[field] = value;
    setTemplate({ ...template, items });
  };

  const handleSubmit = async () => {
    if (!template.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await createCostingTemplate(template);
      toast({ title: "Success", description: "Template created successfully" });
      router.push("/admin/shipping/templates");
    } catch (err) {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Create Costing Template" fullWidth={true}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/shipping/templates">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight">New Template</h1>
              <p className="text-muted-foreground text-sm uppercase font-black tracking-widest opacity-70">Design a standard costing sheet</p>
            </div>
          </div>
          <Button 
            className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Save Template
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" /> General Information
                </CardTitle>
                <CardDescription>Give your template a clear, descriptive name.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest opacity-50">Template Name</Label>
                  <Input 
                    placeholder="e.g. Standard DHL Export (Tea Board Levy)" 
                    value={template.name}
                    onChange={(e) => setTemplate({...template, name: e.target.value})}
                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Cost Components</CardTitle>
                  <CardDescription>Add surcharges, levies, or fees.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="font-bold text-indigo-600 border-indigo-200" onClick={handleAddComponent}>
                  <Plus className="w-4 h-4 mr-1" /> Add Component
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.items.map((item, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-4 relative animate-in fade-in slide-in-from-top-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-4 right-4 text-red-500 hover:bg-red-50" 
                      onClick={() => handleRemoveComponent(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    
                    <div className="grid gap-2 pr-10">
                      <Label className="text-[10px] uppercase font-black tracking-widest opacity-50">Component Name</Label>
                      <Input 
                        placeholder="e.g. Tea Board Levy"
                        className="h-10 bg-white dark:bg-slate-900 border-none font-bold" 
                        value={item.name} 
                        onChange={(e) => updateItem(idx, 'name', e.target.value)} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-50">Charge Type</Label>
                        <Select value={item.cost_type} onValueChange={(val: any) => updateItem(idx, 'cost_type', val)}>
                          <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fixed">Fixed Amount</SelectItem>
                            <SelectItem value="Percentage">Percentage (%)</SelectItem>
                            <SelectItem value="Per Unit">Per Unit (Qty)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-50">Value</Label>
                        <Input 
                          type="number" 
                          className="h-10 bg-white dark:bg-slate-900 border-none font-black text-indigo-600" 
                          value={item.value} 
                          onChange={(e) => updateItem(idx, 'value', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-4 space-y-6">
            <Card className="border-none shadow-xl bg-indigo-600 text-white overflow-hidden">
              <CardHeader>
                <div className="p-3 bg-white/20 w-fit rounded-xl mb-2">
                  <Info className="w-6 h-6" />
                </div>
                <CardTitle className="text-white text-xl font-black">Quick Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-indigo-50/80">
                <p>Use these types for standard international costing:</p>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-400 shrink-0 flex items-center justify-center text-[10px] font-bold">%</div>
                    <span><strong>Percentage:</strong> Applied to the base carrier rate (e.g. Fuel Surcharge).</span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-400 shrink-0 flex items-center justify-center text-[10px] font-bold">LKR</div>
                    <span><strong>Fixed Amount:</strong> A one-time flat fee (e.g. Documentation Fee).</span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-400 shrink-0 flex items-center justify-center text-[10px] font-bold">Qty</div>
                    <span><strong>Per Unit (Qty):</strong> Applied per quantity or kg (e.g. Tea Board Levy). This is added directly to the item price.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

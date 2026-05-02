"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchCostingTemplate, updateCostingTemplate } from "@/lib/api";
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

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const res = await fetchCostingTemplate(Number(id));
        if (res.status === 'success') {
          setTemplate(res.data);
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to load template", variant: "destructive" });
        router.push("/admin/shipping/templates");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadTemplate();
  }, [id]);

  const handleAddComponent = () => {
    setTemplate({
      ...template,
      items: [...(template.items || []), { name: "", cost_type: "Fixed", value: 0 }]
    });
  };

  const handleRemoveComponent = (idx: number) => {
    const items = [...template.items];
    items.splice(idx, 1);
    setTemplate({ ...template, items });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...template.items];
    items[idx][field] = value;
    setTemplate({ ...template, items });
  };

  const handleSubmit = async () => {
    if (!template.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await updateCostingTemplate(Number(id), template);
      toast({ title: "Success", description: "Template updated successfully" });
      router.push("/admin/shipping/templates");
    } catch (err) {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Loading Template Details...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Edit Costing Template" fullWidth={true}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/shipping/templates">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Edit Template</h1>
              <p className="text-muted-foreground text-sm uppercase font-black tracking-widest opacity-70">Updating: {template?.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
             <Button 
                variant="outline"
                className="h-11 px-6 font-bold"
                onClick={() => router.push("/admin/shipping/templates")}
             >
                Cancel
             </Button>
             <Button 
               className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none"
               onClick={handleSubmit}
               disabled={submitting}
             >
               {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
               Save Changes
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" /> General Information
                </CardTitle>
                <CardDescription>Update the identity of this costing sheet.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest opacity-50">Template Name</Label>
                  <Input 
                    placeholder="e.g. Standard DHL Export" 
                    value={template?.name || ""}
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
                  <CardDescription>Manage surcharges, levies, or fees.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="font-bold text-indigo-600 border-indigo-200" onClick={handleAddComponent}>
                  <Plus className="w-4 h-4 mr-1" /> Add Component
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {(template?.items || []).map((item: any, idx: number) => (
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
             <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden">
                <CardHeader>
                   <CardTitle className="text-lg">Template Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Components</span>
                      <span className="font-bold">{template?.items?.length || 0}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Last Updated</span>
                      <span className="font-bold">{new Date(template?.updated_at).toLocaleDateString()}</span>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

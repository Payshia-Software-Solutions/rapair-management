"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchCostingTemplates, 
  deleteCostingTemplate 
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calculator, 
  Loader2,
  ChevronLeft,
  Info,
  DollarSign
} from "lucide-react";
import Link from "next/link";

export default function CostingTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetchCostingTemplates();
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteCostingTemplate(id);
      toast({ title: "Success", description: "Template deleted" });
      loadTemplates();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Costing Templates">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/shipping">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Calculator className="w-8 h-8 text-indigo-600" />
                Costing Templates
              </h1>
              <p className="text-slate-500 text-sm mt-1 uppercase font-black tracking-widest opacity-70">
                Manage Export & International Surcharges
              </p>
            </div>
          </div>
          <Button 
            className="h-11 px-6 shadow-lg shadow-indigo-200 dark:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            onClick={() => router.push("/admin/shipping/templates/new")}
          >
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8">
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8 py-4">Template Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                    ) : templates.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400 italic">No templates found.</TableCell></TableRow>
                    ) : templates.map((template) => (
                      <TableRow key={template.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-50 dark:border-slate-800/50">
                        <TableCell className="pl-8 py-4">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{template.name}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={template.is_active ? "success" : "secondary"} className="font-bold">
                            {template.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-600" onClick={() => {
                               router.push(`/admin/shipping/templates/edit/${template.id}`);
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete(template.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <Card className="border-none shadow-xl bg-indigo-600 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                 <DollarSign className="w-32 h-32" />
              </div>
              <CardHeader>
                <div className="p-3 bg-white/20 w-fit rounded-xl mb-2">
                  <Info className="w-6 h-6" />
                </div>
                <CardTitle className="text-white text-xl font-black">Export Costing Sheets</CardTitle>
                <CardDescription className="text-indigo-100">Standardize your international surcharges.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-indigo-50/80">
                Costing templates allow you to define multiple components that are added to the base carrier rate (DHL/UPS).
                <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/10 space-y-2">
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                      <span>Percentage-based (Fuel, VAT)</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-300" />
                      <span>Fixed-fee (Documentation)</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-300" />
                      <span>Per Unit (Tea Board Levy)</span>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

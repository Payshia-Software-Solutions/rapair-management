"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchSalaryTemplates,
  saveSalaryTemplate,
  deleteSalaryTemplate,
  SalaryTemplateRow
} from "@/lib/api/hrm";
import { Loader2, Banknote, Plus, Trash2, ChevronRight, Calculator, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function SalarySchemesPage() {
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<SalaryTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newScheme, setNewScheme] = useState({ name: "" });
  
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<SalaryTemplateRow | null>(null);
  const [newSchemeItem, setNewSchemeItem] = useState({ name: "", amount: 0, type: "Allowance" as const });
  const [loadingScheme, setLoadingScheme] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const schs = await fetchSalaryTemplates();
      setSchemes(Array.isArray(schs) ? schs : []);
    } catch (err) {
      toast({ title: "Sync Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadScheme = async (id: number) => {
    setLoadingScheme(true);
    try {
        const data = await fetchSalaryTemplates(id);
        setSelectedScheme(data as SalaryTemplateRow);
    } catch (err) {
        toast({ title: "Error", description: "Failed to load scheme details", variant: "destructive" });
    } finally {
        setLoadingScheme(false);
    }
  };

  const handleAddScheme = async () => {
    if (!newScheme.name) return;
    try {
        await saveSalaryTemplate(newScheme);
        toast({ title: "Success", description: "Salary scheme created" });
        setNewScheme({ name: "" });
        void loadData();
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleAddSchemeItem = async () => {
    if (!selectedSchemeId || !newSchemeItem.name || !newSchemeItem.amount) return;
    try {
        await saveSalaryTemplate({ ...newSchemeItem, template_id: selectedSchemeId });
        toast({ title: "Item Added" });
        setNewSchemeItem({ name: "", amount: 0, type: "Allowance" });
        void loadScheme(selectedSchemeId);
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRemoveSchemeItem = async (id: number) => {
     try {
         await deleteSalaryTemplate(id, 'item');
         if (selectedSchemeId) void loadScheme(selectedSchemeId);
     } catch (err) {
         toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
     }
  };

  const deleteScheme = async (id: number) => {
      if (!confirm("Are you sure? This will delete the entire scheme.")) return;
      try {
          await deleteSalaryTemplate(id, 'scheme');
          setSelectedSchemeId(null);
          setSelectedScheme(null);
          void loadData();
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/hrm/settings" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Settings
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <Banknote className="w-8 h-8 text-green-500" />
          Global Salary Schemes
        </h1>
        <p className="text-muted-foreground mt-1">Define reusable payroll packages with standardized components</p>
      </div>

      {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading schemes...</p>
          </div>
      ) : (
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0 py-5 px-6">
                <div>
                    <CardTitle className="text-xl">Organization Schemes</CardTitle>
                    <CardDescription>Select a scheme to manage its allowance and deduction stack</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Input placeholder="Scheme Name (e.g. Sales Tier 1)" className="w-64 h-11 bg-background" value={newScheme.name} onChange={e=>setNewScheme({name: e.target.value})} />
                    <Button className="h-11 shadow-lg shadow-primary/20 font-bold" onClick={handleAddScheme}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Scheme
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
                {/* List Pane */}
                <div className="md:col-span-4 border-r bg-muted/10 p-6 space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Available Schemes</Label>
                    <div className="space-y-2">
                        {schemes.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => { setSelectedSchemeId(s.id); void loadScheme(s.id); }}
                                className={`w-full text-left p-4 rounded-xl text-sm font-bold flex items-center justify-between group transition-all
                                    ${selectedSchemeId === s.id ? 'bg-primary text-white shadow-xl scale-[1.02]' : 'hover:bg-background/80 text-foreground border border-transparent hover:border-muted/30'}
                                `}
                            >
                                <span className="truncate">{s.name}</span>
                                <ChevronRight className={`w-4 h-4 transition-transform ${selectedSchemeId === s.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:opacity-50 group-hover:translate-x-0'}`} />
                            </button>
                        ))}
                    </div>
                    {schemes.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground text-xs italic">
                            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            No schemes defined yet.
                        </div>
                    )}
                </div>

                {/* Details Pane */}
                <div className="md:col-span-8 p-8">
                    {loadingScheme ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                            <p className="text-xs text-muted-foreground">Fetching components...</p>
                        </div>
                    ) : selectedScheme ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <h3 className="font-black text-2xl text-primary uppercase tracking-tighter">{selectedScheme.name}</h3>
                                    <p className="text-xs text-muted-foreground">Managing components for this organizational payroll package</p>
                                </div>
                                <Button variant="ghost" size="sm" className="h-9 text-red-500 hover:text-red-700 hover:bg-red-500/10 font-bold" onClick={() => deleteScheme(selectedScheme.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> 
                                    Remove Full Scheme
                                </Button>
                            </div>

                            <div className="grid grid-cols-12 gap-4 items-end bg-primary/5 p-6 rounded-2xl border border-primary/10">
                                <div className="col-span-5 space-y-2">
                                    <Label className="text-xs font-black uppercase text-primary/70">Component Name</Label>
                                    <Input placeholder="e.g. Housing Allowance" className="h-10 font-bold" value={newSchemeItem.name} onChange={e=>setNewSchemeItem({...newSchemeItem, name: e.target.value})} />
                                </div>
                                <div className="col-span-3 space-y-2">
                                    <Label className="text-xs font-black uppercase text-primary/70">Fixed Amount</Label>
                                    <Input type="number" className="h-10 font-mono font-bold" value={newSchemeItem.amount} onChange={e=>setNewSchemeItem({...newSchemeItem, amount: Number(e.target.value)})} />
                                </div>
                                <div className="col-span-3 space-y-2">
                                    <Label className="text-xs font-black uppercase text-primary/70">Item Type</Label>
                                    <Select value={newSchemeItem.type} onValueChange={v=>setNewSchemeItem({...newSchemeItem, type: v as any})}>
                                        <SelectTrigger className="h-10 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Allowance">Allowance (+)</SelectItem>
                                            <SelectItem value="Deduction">Deduction (-)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1">
                                    <Button size="icon" className="h-10 w-10 shadow-lg" onClick={handleAddSchemeItem}><Plus className="w-5 h-5" /></Button>
                                </div>
                            </div>

                            <div className="rounded-2xl border overflow-hidden bg-background/40">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="px-6 py-4 font-black uppercase text-[11px] tracking-widest">Stack Component</TableHead>
                                            <TableHead className="px-6 py-4 font-black uppercase text-[11px] tracking-widest text-right">Monthly Value</TableHead>
                                            <TableHead className="w-16 px-6 py-4"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(selectedScheme.items || []).map(item => (
                                            <TableRow key={item.id} className="group border-b border-muted/20">
                                                <TableCell className="px-6 py-4">
                                                    <div className="text-sm font-bold text-foreground">{item.name}</div>
                                                    <div className={`text-[10px] uppercase font-black tracking-tighter ${item.type === 'Allowance' ? 'text-green-500' : 'text-red-500'}`}>{item.type}</div>
                                                </TableCell>
                                                <TableCell className={`px-6 py-4 text-right font-mono font-black ${item.type === 'Deduction' ? 'text-red-500' : 'text-green-600'}`}>
                                                    {item.type === 'Deduction' ? '-' : '+'} 
                                                    {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveSchemeItem(item.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(!selectedScheme.items || selectedScheme.items.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">
                                                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-10" />
                                                    No behavioral stack items added to this scheme yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-20">
                            <div className="p-6 bg-primary/5 rounded-full ring-8 ring-primary/0 animate-pulse">
                                <Calculator className="w-16 h-16 text-primary/30" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-foreground uppercase tracking-widest">Select a Scheme</h4>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                    Pick a package from the left sidebar to manage its itemized balance and payroll components.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

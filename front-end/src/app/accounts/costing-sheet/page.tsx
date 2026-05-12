"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchCostingSheets, 
  deleteCostingSheet,
  bulkDeleteCostingSheets,
  duplicateCostingSheet,
  updateCostingSheet,
  ShippingCostingSheet 
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Edit, 
  Calculator, 
  FileText,
  MoreVertical,
  Copy,
  Printer,
  CheckCircle,
  Globe,
  ShieldCheck,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

export default function CostingSheetManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [costingSheets, setCostingSheets] = useState<ShippingCostingSheet[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadSheets = async () => {
    try {
      setLoadingSheets(true);
      const res = await fetchCostingSheets();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setCostingSheets(data);
    } catch (err) {
      console.error("Failed to load sheets:", err);
    } finally {
      setLoadingSheets(false);
    }
  };

  useEffect(() => {
    loadSheets();
  }, []);

  const handleDuplicate = async (id: number) => {
    if (!confirm("Duplicate this costing sheet?")) return;
    try {
      setLoadingSheets(true);
      const res = await duplicateCostingSheet(id);
      if (res.status === 'success') {
        toast({ title: "Success", description: "Sheet duplicated." });
        loadSheets();
      } else {
        toast({ title: "Error", description: res.message || res.error || "Failed to duplicate", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} costing sheets?`)) return;
    
    try {
      setLoadingSheets(true);
      const res = await bulkDeleteCostingSheets(selectedIds);
      if (res.status === 'success') {
        toast({ title: "Success", description: res.message || `${selectedIds.length} sheets deleted.` });
        setSelectedIds([]);
        loadSheets();
      } else {
        toast({ title: "Error", description: res.message || "Failed to delete selected sheets", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoadingSheets(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === costingSheets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(costingSheets.map(s => s.id));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      setLoadingSheets(true);
      const res = await updateCostingSheet(id, { status });
      if (res.status === 'success') {
        toast({ title: "Success", description: `Status updated to ${status}.` });
        loadSheets();
      } else {
        toast({ title: "Error", description: res.message || "Failed to update status", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoadingSheets(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Finalized': return <Badge className="bg-indigo-600 text-white font-bold">{status}</Badge>;
      case 'Approved': return <Badge className="bg-emerald-600 text-white font-bold">{status}</Badge>;
      case 'Cancelled': return <Badge className="bg-red-600 text-white font-bold">{status}</Badge>;
      default: return <Badge variant="secondary" className="font-bold">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Product & Export Costing" fullWidth={true}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Costing Management</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[10px] tracking-widest font-black opacity-70">Internal Landing & Export Costings</p>
           </div>
            <div className="flex gap-3">
               {selectedIds.length > 0 && (
                 <Button 
                   variant="destructive" 
                   className="h-12 px-6 font-black shadow-lg shadow-red-100"
                   onClick={handleBulkDelete}
                 >
                   <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedIds.length})
                 </Button>
               )}
               <Link href="/admin/shipping/costing">
                  <Button className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-100">
                    <Plus className="w-5 h-5 mr-2" /> New Costing Sheet
                  </Button>
               </Link>
            </div>
        </div>

        <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-6">
            <div className="flex items-center gap-3">
              <Calculator className="w-6 h-6 text-indigo-400" />
              <div>
                <CardTitle className="text-xl font-bold">Generated Costing Sheets</CardTitle>
                <CardDescription className="text-indigo-100/60">A history of all product and export calculations.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="w-[50px] pl-8">
                    <Checkbox 
                      checked={costingSheets.length > 0 && selectedIds.length === costingSheets.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Reference</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Customer</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Template Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Final Costing</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSheets ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : costingSheets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No costing sheets generated yet.</TableCell></TableRow>
                ) : costingSheets.map((sheet) => (
                  <TableRow key={sheet.id} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-50 dark:border-slate-800/50 ${selectedIds.includes(sheet.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                    <TableCell className="pl-8 py-4">
                      <Checkbox 
                        checked={selectedIds.includes(sheet.id)}
                        onCheckedChange={() => toggleSelectId(sheet.id)}
                        className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                    </TableCell>
                    <TableCell className="py-4 font-black">{sheet.reference_number || `#${sheet.id}`}</TableCell>
                    <TableCell className="py-4 font-bold">{sheet.customer_name}</TableCell>
                    <TableCell className="py-4 text-slate-500">{sheet.template_name || 'Manual'}</TableCell>
                    <TableCell className="py-4 font-black text-indigo-600">LKR {parseFloat(sheet.total_cost.toString()).toLocaleString()}</TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(sheet.status)}
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/shipping/costing?id=${sheet.id}`}>
                          <Button variant="outline" size="sm" className="h-8 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                        </Link>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400">Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleDuplicate(sheet.id)} className="font-bold cursor-pointer">
                              <Copy className="w-4 h-4 mr-2 text-indigo-600" /> Duplicate Sheet
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400">Print Documents</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => window.open(`/admin/shipping/costing/print-customer/${sheet.id}`, '_blank')} className="font-bold cursor-pointer">
                              <Globe className="w-4 h-4 mr-2 text-indigo-600" /> Customer Quote
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/admin/shipping/costing/print/${sheet.id}`, '_blank')} className="font-bold cursor-pointer">
                              <ShieldCheck className="w-4 h-4 mr-2 text-slate-600" /> Management Report
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="font-bold cursor-pointer">
                                <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Update Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <DropdownMenuItem onClick={() => handleStatusUpdate(sheet.id, 'Draft')} className="font-bold cursor-pointer">Draft</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusUpdate(sheet.id, 'Finalized')} className="font-bold cursor-pointer text-indigo-600">Finalized</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusUpdate(sheet.id, 'Approved')} className="font-bold cursor-pointer text-emerald-600">Approved</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusUpdate(sheet.id, 'Cancelled')} className="font-bold cursor-pointer text-red-600">Cancelled</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                if (confirm(`Delete costing sheet ${sheet.reference_number}?`)) deleteCostingSheet(sheet.id).then(() => loadSheets());
                              }} 
                              className="font-bold cursor-pointer text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete Sheet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

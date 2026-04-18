"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
    fetchBank,
    fetchBankBranches, 
    createBankBranch, 
    updateBankBranch, 
    deleteBankBranch 
} from "@/lib/api";
import { 
    Plus, 
    Search, 
    Trash2, 
    Pencil, 
    Loader2, 
    AlertCircle, 
    Building2, 
    ArrowLeft, 
    MapPin, 
    CheckCircle2, 
    XCircle,
    Hash
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";

export type BranchRow = {
  id: number;
  bank_id: number;
  branch_name: string;
  branch_code: string | null;
  is_active: number;
  created_at: string;
};

export default function BankBranchesPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [bank, setBank] = useState<any>(null);
  const [items, setItems] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    bank_id: Number(id),
    branch_name: "",
    branch_code: "",
    is_active: 1
  });

  const load = async () => {
    setLoading(true);
    try {
      const [bankData, branchesData] = await Promise.all([
        fetchBank(String(id)),
        fetchBankBranches(String(id), true)
      ]);
      setBank(bankData);
      setItems(Array.isArray(branchesData) ? branchesData : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((br) => 
        (br.branch_name ?? "").toLowerCase().includes(q) || 
        (br.branch_code ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setFormData({ bank_id: Number(id), branch_name: "", branch_code: "", is_active: 1 });
    setIsDialogOpen(true);
  };

  const openEdit = (br: BranchRow) => {
    setEditId(br.id);
    setFormData({ 
        bank_id: Number(id),
        branch_name: br.branch_name, 
        branch_code: br.branch_code || "", 
        is_active: Number(br.is_active) 
    });
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branch_name.trim()) return;
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateBankBranch(editId, formData);
        toast({ title: "Updated", description: "Branch updated successfully" });
      } else {
        await createBankBranch(formData);
        toast({ title: "Created", description: "Branch added successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (bid: number) => {
    if (!confirm("Delete this branch?")) return;
    try {
      await deleteBankBranch(bid);
      toast({ title: "Deleted", description: "Branch removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Delete failed", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <Link href="/master-data/banks" className="flex items-center gap-1 hover:text-primary transition-colors text-xs font-bold uppercase tracking-wider">
                <ArrowLeft className="w-3 h-3" />
                Banks
             </Link>
             <span className="text-xs">/</span>
             <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{bank?.name || "..."}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
             <Building2 className="w-7 h-7 text-primary" />
             {bank?.name || "Bank"} Branches
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Manage branch locations for {bank?.name || "this bank"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20 font-bold">
            {items.length} Branches
          </Badge>
          <Button className="gap-2 bg-primary font-bold shadow-lg shadow-primary/20" onClick={openAdd} disabled={!bank}>
            <Plus className="w-4 h-4" />
            Add Branch
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={`Search ${bank?.name || "bank"} branches...`} 
            className="pl-9 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Loading branches...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No branches found</h3>
                <p className="text-muted-foreground max-w-xs">{query ? "No results match your search." : `Start by adding branches for ${bank?.name || "this bank"}.`}</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow>
                    <TableHead className="font-bold">Branch Name</TableHead>
                    <TableHead className="font-bold">Code</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((br) => (
                    <TableRow key={br.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl group-hover:scale-110 transition-transform duration-200">
                            <MapPin className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{br.branch_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-0.5">BRANCH ID: #{br.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Hash className="w-3 h-3 text-muted-foreground" />
                           <span className="font-mono font-bold text-sm">{br.branch_code || "---"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {Number(br.is_active) ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1 font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Active
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-rose-500 border-rose-200 gap-1 font-bold">
                                <XCircle className="w-3 h-3" /> Inactive
                            </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => openEdit(br)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors" onClick={() => remove(br.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tight text-primary">
                {editId ? "Edit Branch" : "Add Branch"}
              </DialogTitle>
              <DialogDescription className="font-medium">
                Add location details for <strong>{bank?.name || "the selected bank"}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="branch_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Branch Name
                </Label>
                <Input
                  id="branch_name"
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  placeholder="e.g., Colombo 03"
                  className="h-12 font-bold focus-visible:ring-primary shadow-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_code" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Branch Code (Optional)
                </Label>
                <Input
                  id="branch_code"
                  value={formData.branch_code}
                  onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                  placeholder="e.g., 034"
                  className="h-12 font-mono font-bold focus-visible:ring-primary shadow-sm"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Active Status</Label>
                    <p className="text-[10px] text-muted-foreground font-medium italic">Inactive branches won't show in POS dropdowns.</p>
                </div>
                <Switch 
                    checked={!!formData.is_active} 
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v ? 1 : 0 })} 
                />
              </div>
            </div>
            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="font-black px-8 shadow-lg shadow-primary/20">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? "Save Changes" : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

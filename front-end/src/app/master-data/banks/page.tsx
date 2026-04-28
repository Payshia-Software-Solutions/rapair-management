"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
    fetchBanks, 
    createBank, 
    updateBank, 
    deleteBank,
    syncBanksFromInternet
} from "@/lib/api";
import { Plus, Search, Trash2, Pencil, Loader2, AlertCircle, Landmark, Building2, ChevronRight, CheckCircle2, XCircle, Globe } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";

export type BankRow = {
  id: number;
  name: string;
  code: string | null;
  is_active: number;
  created_at: string;
};

export default function BanksPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    is_active: 1
  });

  const [isSyncing, setIsSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBanks();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load banks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) => 
        (b.name ?? "").toLowerCase().includes(q) || 
        (b.code ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setFormData({ name: "", code: "", is_active: 1 });
    setIsDialogOpen(true);
  };

  const openEdit = (b: BankRow) => {
    setEditId(b.id);
    setFormData({ 
        name: b.name, 
        code: b.code || "", 
        is_active: Number(b.is_active) 
    });
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateBank(editId, formData);
        toast({ title: "Updated", description: "Bank updated successfully" });
      } else {
        await createBank(formData);
        toast({ title: "Created", description: "Bank added successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this bank? This might fail if it has branches or linked records.")) return;
    try {
      await deleteBank(id);
      toast({ title: "Deleted", description: "Bank removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Delete failed", variant: "destructive" });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncBanksFromInternet();
      toast({ 
        title: "Sync Success", 
        description: res.message || "Bank and branch list updated from the internet.",
      });
      await load();
    } catch (e: any) {
      toast({ 
        title: "Sync Error", 
        description: e?.message || "Failed to update from internet", 
        variant: "destructive" 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Banks</h1>
          <p className="text-muted-foreground mt-1">Manage bank master data and branches</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20 font-bold">
            {items.length} Banks
          </Badge>
          <Button variant="outline" className="gap-2 font-bold border-slate-200 dark:border-slate-800" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Sync from Cloud
          </Button>
          <Button className="gap-2 bg-primary font-bold shadow-lg shadow-primary/20" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Bank
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search banks by name or code..." className="pl-9 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Loading banks...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No banks found</h3>
                <p className="text-muted-foreground max-w-xs">{query ? "No results match your search." : "Start by adding your first bank."}</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow>
                    <TableHead className="font-bold">Bank Details</TableHead>
                    <TableHead className="font-bold">Code</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl group-hover:scale-110 transition-transform duration-200">
                            <Landmark className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{b.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-0.5">BANK ID: #{b.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800">
                          {b.code || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(b.is_active) ? (
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
                          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 font-bold border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-400">
                            <Link href={`/master-data/banks/${b.id}/branches`}>
                              <Building2 className="w-4 h-4" />
                              Branches
                              <ChevronRight className="w-3 h-3 opacity-50" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => openEdit(b)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors" onClick={() => remove(b.id)}>
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
                {editId ? "Edit Bank" : "Add Bank"}
              </DialogTitle>
              <DialogDescription className="font-medium">
                Standardize bank information for cheque payments.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Bank Full Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Bank of Ceylon"
                  className="h-12 font-bold focus-visible:ring-primary shadow-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Short Code (Optional)
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., BOC"
                  className="h-12 font-mono font-bold focus-visible:ring-primary shadow-sm"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Active Status</Label>
                    <p className="text-[10px] text-muted-foreground font-medium italic">Inactive banks won't show in POS dropdowns.</p>
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
                {editId ? "Save Changes" : "Create Bank"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

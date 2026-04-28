"use client";

import React, { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
    fetchPayees, 
    createPayee, 
    updatePayee, 
    deletePayee, 
    PayeeRow 
} from "@/lib/api";
import { 
    Plus, 
    Search, 
    Loader2, 
    User, 
    Phone, 
    MapPin, 
    Tag, 
    Pencil, 
    Trash2, 
    RefreshCw,
    Users,
    ChevronRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";

export default function PayeesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PayeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  
  // Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    contact_no: "",
    address: "",
    type: "Other"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPayees();
      setItems(data);
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to load payees", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => 
      i.name.toLowerCase().includes(q) || 
      (i.contact_no || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const handleEdit = (payee: PayeeRow) => {
    setEditingId(payee.id);
    setFormData({
      name: payee.name,
      contact_no: payee.contact_no || "",
      address: payee.address || "",
      type: payee.type
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updatePayee(editingId, formData);
        toast({ title: "Success", description: "Payee updated successfully" });
      } else {
        await createPayee(formData);
        toast({ title: "Success", description: "Payee created successfully" });
      }
      setIsDialogOpen(false);
      setFormData({ name: "", contact_no: "", address: "", type: "Other" });
      setEditingId(null);
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePayee(deleteId);
      toast({ title: "Deleted", description: "Payee record removed" });
      setDeleteId(null);
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3 italic">
            <Users className="w-8 h-8 text-primary" />
            Expense Payees
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage service providers, utility companies, and recurring recipients</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadData} 
            disabled={loading} 
            className="rounded-xl h-12 w-12 border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            className="h-12 px-6 gap-2 bg-primary shadow-xl shadow-primary/20 rounded-xl font-bold uppercase text-xs tracking-widest"
            onClick={() => {
                setEditingId(null);
                setFormData({ name: "", contact_no: "", address: "", type: "Other" });
                setIsDialogOpen(true);
            }}
          >
            <Plus className="w-5 h-5" />
            Add Payee
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search payees by name or contact number..." 
            className="pl-11 h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl font-bold italic" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-bold italic tracking-tight">Syncing payee registry...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
                  <User className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">No Payees Found</h3>
                <p className="text-muted-foreground max-w-sm mt-2 font-medium">Add your service providers or utility companies to start tracking payments.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b">
                  <TableRow className="hover:bg-transparent uppercase tracking-widest">
                    <TableHead className="font-black text-[10px] py-6 px-6">Payee / Identity</TableHead>
                    <TableHead className="font-black text-[10px] py-6">Type</TableHead>
                    <TableHead className="font-black text-[10px] py-6">Contact & Location</TableHead>
                    <TableHead className="font-black text-[10px] py-6 text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-primary/[0.02] transition-colors border-slate-100 dark:border-slate-800">
                      <TableCell className="py-5 px-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-black">
                                {item.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-slate-900 dark:text-white tracking-tight">{item.name}</span>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 italic">Permanent Recipient</span>
                            </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-tighter bg-slate-50 dark:bg-slate-900 border-slate-200">
                            {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <Phone className="w-3 h-3 text-muted-foreground" /> {item.contact_no || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground truncate max-w-[250px]">
                                <MapPin className="w-3 h-3" /> {item.address || 'No address saved'}
                            </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-5 px-6">
                        <div className="flex items-center justify-end gap-2">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => handleEdit(item)}
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                onClick={() => setDeleteId(item.id)}
                            >
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="bg-primary p-8 text-white relative">
                <Users className="absolute top-0 right-0 p-8 w-24 h-24 opacity-10 rotate-12" />
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">
                    {editingId ? "Update Identity" : "New Payee Identity"}
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/80 font-medium italic mt-1">
                    Manage persistent payment targets for your accounting ledger.
                </DialogDescription>
            </div>

            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Legal Name / Entity</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="e.g. Ceylon Electricity Board" 
                            className="pl-10 h-12 font-bold rounded-xl border-slate-200" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Classification</Label>
                        <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                            <SelectTrigger className="h-12 font-bold rounded-xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Utility" className="font-bold">Utility Provider</SelectItem>
                                <SelectItem value="Service" className="font-bold">Service Provider</SelectItem>
                                <SelectItem value="Other" className="font-bold">General / Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="+94 ..." 
                                className="pl-10 h-12 font-bold rounded-xl border-slate-200" 
                                value={formData.contact_no}
                                onChange={(e) => setFormData({...formData, contact_no: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Office / Payment Address</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-4 w-4 h-4 text-muted-foreground" />
                        <textarea 
                            className="w-full pl-10 pt-3 pb-3 min-h-[100px] bg-background border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
                            placeholder="Full address for formal vouchers..."
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50/50 dark:bg-slate-900/50 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 font-bold rounded-xl">
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-12 px-10 font-black italic uppercase tracking-tight bg-primary shadow-xl shadow-primary/20 rounded-xl">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                    {editingId ? "Save Changes" : "Create Payee"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tight text-rose-600">Remove Payee Record?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-slate-500">
              This will remove the identity from your registry. Past expense vouchers will still retain the name for history, but you won't be able to select this payee in future transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3">
            <AlertDialogCancel className="h-12 rounded-xl font-bold border-slate-200">Cancel Action</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-12 rounded-xl bg-rose-600 hover:bg-rose-700 font-black uppercase italic tracking-widest">
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

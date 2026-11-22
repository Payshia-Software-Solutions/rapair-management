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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, LoadingState, EmptyState } from "@/components/accounting/page-shell";
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

  const openNew = () => {
    setEditingId(null);
    setFormData({ name: "", contact_no: "", address: "", type: "Other" });
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout title="Payees">
      <div className="space-y-5">
        <PageHeader
          title="Payees"
          description="Service providers, utility companies and other recurring expense recipients."
          actions={<>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add payee</Button>
          </>}
        />

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9 h-9" placeholder="Search by name or contact number…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search payees" />
            </div>
          </div>

          {loading ? <LoadingState /> : filtered.length === 0 ? (
            <EmptyState
              title={query ? "No matching payees" : "No payees yet"}
              description={query ? "Try a different search." : "Add service providers or utility companies to start tracking payments."}
              action={!query && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add payee</Button>}
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs w-32">Type</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Contact</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Address</TableHead>
                  <TableHead className="text-xs text-right w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-normal">{item.type}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">{item.contact_no || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[280px] truncate text-muted-foreground">{item.address || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)} aria-label={`Edit ${item.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(item.id)} aria-label={`Delete ${item.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit payee" : "Add payee"}</DialogTitle>
              <DialogDescription>Payees can be selected when recording expenses.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" placeholder="e.g. Ceylon Electricity Board" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-type">Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger id="p-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Utility">Utility provider</SelectItem>
                    <SelectItem value="Service">Service provider</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-contact">Contact number</Label>
                <Input id="p-contact" placeholder="+94 …" value={formData.contact_no} onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-address">Address</Label>
              <Textarea id="p-address" rows={3} placeholder="Address printed on vouchers" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                {editingId ? "Save changes" : "Add payee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payee?</AlertDialogTitle>
            <AlertDialogDescription>
              Past expense vouchers keep the name, but the payee can no longer be selected for new transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

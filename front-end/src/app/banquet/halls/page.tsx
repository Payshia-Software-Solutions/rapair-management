"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { LayoutGrid, Plus, Loader2, Edit2, Trash2, Users, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function BanquetHallsPage() {
  const { toast } = useToast();
  const [halls, setHalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newHall, setNewHall] = useState({ name: "", capacity: "", price_per_session: "", notes: "" });
  const [editingHall, setEditingHall] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadHalls = async () => {
    setLoading(true);
    try {
      const res = await api("/api/banquet/halls");
      const data = await res.json();
      setHalls(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load banquet halls", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHalls(); }, []);

  const handleAddHall = async () => {
    setSubmitting(true);
    try {
      const res = await api("/api/banquet/halls", {
        method: "POST",
        body: JSON.stringify(newHall)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Banquet hall created" });
        setNewHall({ name: "", capacity: "", price_per_session: "", notes: "" });
        loadHalls();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add hall", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateHall = async () => {
    if (!editingHall) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/banquet/halls/${editingHall.id}`, {
        method: "PUT",
        body: JSON.stringify(editingHall)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Hall updated" });
        setEditingHall(null);
        loadHalls();
      }
    } catch (err) {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/banquet/halls/${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Deleted", description: "Hall removed successfully" });
        loadHalls();
      }
    } catch (err) {
      toast({ title: "Error", description: "Deletion failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <DashboardLayout title="Banquet Halls">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" />
              Banquet Halls
            </h1>
            <p className="text-muted-foreground">Manage event venues and capacities</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add New Hall
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Banquet Hall</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Hall Name</Label>
                  <Input placeholder="e.g. Grand Ballroom" value={newHall.name} onChange={e => setNewHall({...newHall, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Capacity (Pax)</Label>
                    <Input type="number" placeholder="200" value={newHall.capacity} onChange={e => setNewHall({...newHall, capacity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price Per Session</Label>
                    <Input type="number" placeholder="0.00" value={newHall.price_per_session} onChange={e => setNewHall({...newHall, price_per_session: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Extra details..." value={newHall.notes} onChange={e => setNewHall({...newHall, notes: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddHall} disabled={submitting || !newHall.name}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Hall
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Venue Inventory</CardTitle>
            <CardDescription>All available halls for bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hall Name</TableHead>
                  <TableHead><div className="flex items-center gap-1"><Users className="w-4 h-4" /> Capacity</div></TableHead>
                  <TableHead><div className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Rate</div></TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6 text-muted-foreground" /></TableCell></TableRow>
                ) : halls.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No halls found</TableCell></TableRow>
                ) : halls.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-bold">{h.name}</TableCell>
                    <TableCell>{h.capacity} Pax</TableCell>
                    <TableCell>LKR {Number(h.price_per_session).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        h.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {h.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingHall(h)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(h.id)}>
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

        {/* Edit Dialog */}
        <Dialog open={!!editingHall} onOpenChange={o => !o && setEditingHall(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Banquet Hall</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Hall Name</Label>
                <Input value={editingHall?.name || ""} onChange={e => setEditingHall({...editingHall, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capacity (Pax)</Label>
                  <Input type="number" value={editingHall?.capacity || ""} onChange={e => setEditingHall({...editingHall, capacity: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Price Per Session</Label>
                  <Input type="number" value={editingHall?.price_per_session || ""} onChange={e => setEditingHall({...editingHall, price_per_session: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingHall?.status || ""} onValueChange={v => setEditingHall({...editingHall, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateHall} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Hall?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove this hall from the system.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

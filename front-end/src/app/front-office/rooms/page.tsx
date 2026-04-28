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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Building2, Plus, Loader2, Tag, Hotel, Edit2, Trash2, MoreHorizontal, DollarSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function RoomsPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newType, setNewType] = useState({ name: "", item_id: "", base_rate: "", max_occupancy: "2", description: "" });
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [newRoom, setNewRoom] = useState({ room_number: "", type_id: "", location_id: "1", notes: "" });
  const [editingType, setEditingType] = useState<any>(null);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editingRates, setEditingRates] = useState<{id: number, name: string, rates: any} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, type: 'type' | 'room'} | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, tRes] = await Promise.all([
        api("/api/hotel/rooms"),
        api("/api/hotel/room-types")
      ]);
      const rData = await rRes.json();
      const tData = await tRes.json();
      setRooms(rData.data || []);
      setTypes(tData.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load rooms", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMasterItems = async (q: string = "") => {
    try {
      const res = await api(`/api/part/list?q=${q}`);
      const data = await res.json();
      setMasterItems(data.data || []);
    } catch (err) {}
  };

  useEffect(() => { 
    loadData();
    loadMasterItems();
  }, []);

  const handleAddType = async () => {
    setSubmitting(true);
    try {
      const res = await api("/api/hotel/room-types", {
        method: "POST",
        body: JSON.stringify(newType)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Room type added" });
        setNewType({ name: "", item_id: "", base_rate: "", max_occupancy: "2", description: "" });
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add type", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoom = async () => {
    setSubmitting(true);
    try {
      const res = await api("/api/hotel/rooms", {
        method: "POST",
        body: JSON.stringify(newRoom)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Room added" });
        setNewRoom({ room_number: "", type_id: "", location_id: "1", notes: "" });
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add room", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateType = async () => {
    if (!editingType) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/hotel/room-types/${editingType.id}`, {
        method: "PUT",
        body: JSON.stringify(editingType)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Room type updated" });
        setEditingType(null);
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/hotel/rooms/${editingRoom.id}`, {
        method: "PUT",
        body: JSON.stringify(editingRoom)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Room updated" });
        setEditingRoom(null);
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRates = async () => {
    if (!editingRates) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/hotel/room-type-rates/${editingRates.id}`, {
        method: "POST",
        body: JSON.stringify({ rates: editingRates.rates })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Rates updated" });
        setEditingRates(null);
      }
    } catch (err) {
      toast({ title: "Error", description: "Save failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      const endpoint = deleteConfirm.type === 'type' ? 'room-types' : 'rooms';
      const res = await api(`/api/hotel/${endpoint}/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Deleted", description: `Item removed successfully` });
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Deletion failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <DashboardLayout title="Hotel Configuration">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Rooms & Rates
            </h1>
            <p className="text-muted-foreground">Define room categories and inventory</p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Tag className="w-4 h-4" />
                  New Room Type
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Room Type</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Type Name (e.g. Deluxe Suite)</Label>
                    <Input value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Linked Master Item (for Invoicing)</Label>
                    <SearchableSelect 
                      value={newType.item_id}
                      placeholder="Search service items..."
                      options={masterItems.map(i => ({ value: String(i.id), label: i.part_name }))}
                      onValueChange={v => setNewType({...newType, item_id: v})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Rate (Per Night)</Label>
                      <Input type="number" value={newType.base_rate} onChange={e => setNewType({...newType, base_rate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Occupancy</Label>
                      <Input type="number" value={newType.max_occupancy} onChange={e => setNewType({...newType, max_occupancy: e.target.value})} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddType} disabled={submitting || !newType.name}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Type
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Room</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Room Number</Label>
                    <Input value={newRoom.room_number} onChange={e => setNewRoom({...newRoom, room_number: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newRoom.type_id} onValueChange={v => setNewRoom({...newRoom, type_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name} (LKR {t.base_rate})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddRoom} disabled={submitting || !newRoom.room_number || !newRoom.type_id}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Room
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Room Categories</CardTitle>
              <CardDescription>Nightly rates and capacity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-center">Max Pax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map(t => (
                    <TableRow key={t.id} className="group">
                      <TableCell className="font-semibold">{t.name}</TableCell>
                      <TableCell className="text-right">LKR {Number(t.base_rate).toLocaleString()}</TableCell>
                      <TableCell className="text-center">{t.max_occupancy}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary"
                            onClick={async () => {
                              const res = await api(`/api/hotel/room-type-rates/${t.id}`);
                              const data = await res.json();
                              const r: any = {};
                              data.data?.forEach((row: any) => { r[row.meal_plan] = row.rate; });
                              setEditingRates({ id: t.id, name: t.name, rates: r });
                            }}
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setEditingType(t)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteConfirm({ id: t.id, type: 'type' })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {types.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No categories defined</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room Inventory</CardTitle>
              <CardDescription>Individual units and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map(r => (
                    <TableRow key={r.id} className="group">
                      <TableCell className="font-mono font-bold text-primary">{r.room_number}</TableCell>
                      <TableCell className="text-xs">{r.type_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                          r.status === 'Occupied' ? 'bg-blue-100 text-blue-700' :
                          r.status === 'Dirty' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRoom(r)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'room', id: r.id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rooms.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No rooms added yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Edit Room Type Dialog */}
        <Dialog open={!!editingType} onOpenChange={o => !o && setEditingType(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Room Type</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type Name</Label>
                <Input value={editingType?.name || ""} onChange={e => setEditingType({...editingType, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Linked Master Item</Label>
                <SearchableSelect 
                  value={editingType?.item_id ? String(editingType.item_id) : ""}
                  placeholder="Search service items..."
                  options={masterItems.map(i => ({ value: String(i.id), label: i.part_name }))}
                  onValueChange={v => setEditingType({...editingType, item_id: v})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Rate</Label>
                  <Input type="number" value={editingType?.base_rate || ""} onChange={e => setEditingType({...editingType, base_rate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Occupancy</Label>
                  <Input type="number" value={editingType?.max_occupancy || ""} onChange={e => setEditingType({...editingType, max_occupancy: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateType} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Room Dialog */}
        <Dialog open={!!editingRoom} onOpenChange={o => !o && setEditingRoom(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Room</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input value={editingRoom?.room_number || ""} onChange={e => setEditingRoom({...editingRoom, room_number: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={String(editingRoom?.type_id || "")} onValueChange={v => setEditingRoom({...editingRoom, type_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingRoom?.status || ""} onValueChange={v => setEditingRoom({...editingRoom, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Dirty">Dirty</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateRoom} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rate Management Modal */}
        <Dialog open={!!editingRates} onOpenChange={o => !o && setEditingRates(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Meal Rates: {editingRates?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-xs text-muted-foreground italic mb-2">Set custom rates for each meal plan. Leave empty to use base rate.</p>
              {['RO', 'BB', 'HB', 'FB', 'AI'].map(plan => (
                <div key={plan} className="grid grid-cols-2 items-center gap-4">
                  <Label className="font-bold">{plan}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">LKR</span>
                    <Input 
                      type="number" 
                      className="pl-12"
                      placeholder="0.00"
                      value={editingRates?.rates?.[plan] || ""} 
                      onChange={e => setEditingRates({
                        ...editingRates!,
                        rates: { ...editingRates!.rates, [plan]: e.target.value }
                      })} 
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRates(null)}>Cancel</Button>
              <Button onClick={handleSaveRates} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Rates
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently remove the 
                {deleteConfirm?.type === 'type' ? ' room category' : ' individual room'} from the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

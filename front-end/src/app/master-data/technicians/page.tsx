"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createTechnician, deleteTechnician, fetchTechnicians, updateTechnician } from "@/lib/api";
import { Plus, Trash2, Search, User, Loader2, AlertCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TechnicianRow = {
  id: number;
  name: string;
  role: string;
  created_at: string;
};

export default function TechniciansPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Technician");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTechnicians();
      setItems(data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to load technicians", variant: "destructive" });
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
    return items.filter((t) => t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q));
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    setRole("Technician");
    setIsDialogOpen(true);
  };

  const openEdit = (t: TechnicianRow) => {
    setEditId(t.id);
    setName(t.name);
    setRole(t.role);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const r = role.trim();
    if (!n || !r) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        await updateTechnician(String(editId), { name: n, role: r });
        toast({ title: "Updated", description: "Technician updated successfully" });
      } else {
        await createTechnician({ name: n, role: r });
        toast({ title: "Created", description: "Technician added successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number, techName: string) => {
    if (!confirm(`Delete ${techName}?`)) return;
    try {
      await deleteTechnician(String(id));
      toast({ title: "Deleted", description: "Technician removed", variant: "destructive" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to delete technician", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manage Technicians</h1>
          <p className="text-muted-foreground mt-1">Configure your workshop's skilled labor force</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-fit px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
            {items.length} Registered Technicians
          </Badge>
          <Button className="gap-2 bg-primary" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Technician
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search technicians..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading technicians...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">No technicians found</h3>
            <p className="text-muted-foreground max-w-xs">
              {query ? "No technicians match your search." : "Get started by adding your first technician."}
            </p>
            {query && (
              <Button variant="ghost" className="mt-4" onClick={() => setQuery("")}>Clear Search</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((t) => (
              <Card key={t.id} className="border-none shadow-sm group hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{t.name}</h3>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary transition-colors h-9 w-9"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive transition-colors h-9 w-9"
                      onClick={() => void remove(t.id, t.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Technician" : "Add Technician"}</DialogTitle>
              <DialogDescription>Technicians can be assigned to bays and active jobs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="techname" className="text-right">Name</Label>
                <Input id="techname" className="col-span-3" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="techrole" className="text-right">Role</Label>
                <Input id="techrole" className="col-span-3" value={role} onChange={(e) => setRole(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}


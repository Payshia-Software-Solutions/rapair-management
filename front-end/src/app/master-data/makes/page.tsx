"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createMake, deleteMake, fetchMakes, updateMake } from "@/lib/api";
import type { VehicleMake } from "@/lib/types";
import { Plus, Search, Tag, Trash2, Pencil, Loader2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function VehicleMakesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<VehicleMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchMakes();
      setItems(data);
    } catch {
      toast({ title: "Error", description: "Failed to load makes", variant: "destructive" });
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
    return items.filter((m) => m.name.toLowerCase().includes(q));
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    setIsDialogOpen(true);
  };

  const openEdit = (make: VehicleMake) => {
    setEditId(make.id);
    setName(make.name);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        await updateMake(String(editId), { name: trimmed });
        toast({ title: "Updated", description: "Make updated successfully" });
      } else {
        await createMake({ name: trimmed });
        toast({ title: "Created", description: "Make added successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this make? Any linked models will also be deleted.")) return;
    try {
      await deleteMake(String(id));
      toast({ title: "Deleted", description: "Make removed" });
      await load();
    } catch {
      toast({ title: "Error", description: "Failed to delete make", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vehicle Makes</h1>
          <p className="text-muted-foreground mt-1">Manage approved vehicle makes</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {items.length} Total Makes
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add Make
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{editId ? "Edit Make" : "Add Make"}</DialogTitle>
                  <DialogDescription>Vehicle makes are used to group models.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                      id="name"
                      className="col-span-3"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Toyota"
                      required
                    />
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
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search makes..."
            className="pl-9 h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading makes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No makes found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Get started by adding your first make."}
                </p>
                {query && (
                  <Button variant="ghost" className="mt-4" onClick={() => setQuery("")}>Clear Search</Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Make</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((make) => (
                    <TableRow key={make.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Tag className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">{make.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">MAKE ID: #{make.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(make.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(make)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(make.id)}
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
    </DashboardLayout>
  );
}


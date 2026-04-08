"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createModel, deleteModel, fetchMakes, fetchModels, updateModel } from "@/lib/api";
import type { VehicleMake, VehicleModel } from "@/lib/types";
import { Plus, Search, Layers, Trash2, Pencil, Loader2, AlertCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function VehicleModelsPage() {
  const { toast } = useToast();
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [items, setItems] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterMakeId, setFilterMakeId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formMakeId, setFormMakeId] = useState<number | null>(null);
  const [name, setName] = useState("");

  const load = async (makeId?: number) => {
    setLoading(true);
    try {
      const [mks, models] = await Promise.all([fetchMakes(), fetchModels(makeId)]);
      setMakes(mks);
      setItems(models);
    } catch {
      toast({ title: "Error", description: "Failed to load models", variant: "destructive" });
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
    return items.filter((m) =>
      m.name.toLowerCase().includes(q) || m.make_name.toLowerCase().includes(q)
    );
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    setFormMakeId(filterMakeId ?? (makes[0]?.id ?? null));
    setIsDialogOpen(true);
  };

  const openEdit = (model: VehicleModel) => {
    setEditId(model.id);
    setName(model.name);
    setFormMakeId(model.make_id);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!formMakeId || !trimmed) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        await updateModel(String(editId), { make_id: formMakeId, name: trimmed });
        toast({ title: "Updated", description: "Model updated successfully" });
      } else {
        await createModel({ make_id: formMakeId, name: trimmed });
        toast({ title: "Created", description: "Model added successfully" });
      }
      setIsDialogOpen(false);
      await load(filterMakeId ?? undefined);
    } catch {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this model?")) return;
    try {
      await deleteModel(String(id));
      toast({ title: "Deleted", description: "Model removed" });
      await load(filterMakeId ?? undefined);
    } catch {
      toast({ title: "Error", description: "Failed to delete model", variant: "destructive" });
    }
  };

  const onFilterMake = async (value: string) => {
    const next = value === "all" ? null : Number(value);
    setFilterMakeId(next);
    await load(next ?? undefined);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vehicle Models</h1>
          <p className="text-muted-foreground mt-1">Manage approved vehicle models</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {items.length} Total Models
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary" onClick={openAdd} disabled={makes.length === 0}>
                <Plus className="w-4 h-4" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{editId ? "Edit Model" : "Add Model"}</DialogTitle>
                  <DialogDescription>Models belong to a specific make.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Make</Label>
                    <div className="col-span-3">
                      <Select
                        value={formMakeId ? String(formMakeId) : undefined}
                        onValueChange={(v) => setFormMakeId(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a make" />
                        </SelectTrigger>
                        <SelectContent>
                          {makes.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Model</Label>
                    <Input
                      id="name"
                      className="col-span-3"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Civic"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting || !formMakeId}>
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by make or model..."
              className="pl-9 h-11"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sm:w-60">
            <Select value={filterMakeId ? String(filterMakeId) : "all"} onValueChange={onFilterMake}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Filter by make" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All makes</SelectItem>
                {makes.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading models...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No models found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Add models to build your master data."}
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
                    <TableHead>Model</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium">{m.make_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Layers className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">MODEL ID: #{m.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(m)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(m.id)}
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


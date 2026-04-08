"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createCategory, deleteCategory, fetchCategories, updateCategory } from "@/lib/api";
import { Plus, Trash2, Search, Tags, Loader2, AlertCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryRow = { id: number; name: string; created_at: string };

export default function CategoriesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setItems(data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to load categories", variant: "destructive" });
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
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    setIsDialogOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditId(c.id);
    setName(c.name);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        await updateCategory(String(editId), { name: trimmed });
        toast({ title: "Updated", description: "Category updated" });
      } else {
        await createCategory({ name: trimmed });
        toast({ title: "Created", description: "Category created" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number, categoryName: string) => {
    if (!confirm(`Delete "${categoryName}"?`)) return;
    try {
      await deleteCategory(String(id));
      toast({ title: "Deleted", description: "Category removed", variant: "destructive" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to delete category", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Repair Categories</h1>
          <p className="text-muted-foreground mt-1">Manage categories used across the system</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-fit px-3 py-1 bg-purple-50 text-purple-700 border-purple-200">
            {items.length} Categories
          </Badge>
          <Button className="gap-2 bg-purple-600 hover:bg-purple-700" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search categories..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading categories...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No categories found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Add categories to standardize repairs."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-muted/30">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 group hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-700">
                        <Tags className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">CATEGORY ID: #{c.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => void remove(c.id, c.name)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Category" : "Add Category"}</DialogTitle>
              <DialogDescription>Categories help classify and report repairs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="catname" className="text-right">Name</Label>
                <Input id="catname" className="col-span-3" value={name} onChange={(e) => setName(e.target.value)} required />
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


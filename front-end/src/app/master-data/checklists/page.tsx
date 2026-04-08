"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createChecklistTemplate,
  deleteChecklistTemplate,
  fetchChecklistTemplates,
  updateChecklistTemplate,
} from "@/lib/api";
import { Plus, Trash2, Search, ListChecks, Loader2, AlertCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TemplateRow = { id: number; description: string; created_at: string; updated_at: string };

export default function ChecklistItemsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchChecklistTemplates();
      setItems(data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to load checklist templates", variant: "destructive" });
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
    return items.filter((i) => i.description.toLowerCase().includes(q));
  }, [items, query]);

  const openAdd = () => {
    setEditId(null);
    setDescription("");
    setIsDialogOpen(true);
  };

  const openEdit = (t: TemplateRow) => {
    setEditId(t.id);
    setDescription(t.description);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateChecklistTemplate(String(editId), { description: trimmed });
        toast({ title: "Updated", description: "Template updated" });
      } else {
        await createChecklistTemplate({ description: trimmed });
        toast({ title: "Created", description: "Template created" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this template item?")) return;
    try {
      await deleteChecklistTemplate(String(id));
      toast({ title: "Deleted", description: "Template removed", variant: "destructive" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to delete template", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Checklist Repository</h1>
          <p className="text-muted-foreground mt-1">Manage global templates for repair inspections</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-fit px-3 py-1 bg-rose-50 text-rose-700 border-rose-200">
            {items.length} Template Items
          </Badge>
          <Button className="gap-2 bg-rose-600 hover:bg-rose-700" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Template
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9 h-11" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading templates...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No templates found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {query ? "No results match your search." : "Add reusable checklist templates for inspections."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                {filtered.map((t) => (
                  <Card key={t.id} className="border-none shadow-sm group hover:shadow-md transition-all">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0">
                          <ListChecks className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium leading-tight line-clamp-2">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(t)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => void remove(t.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Template" : "Add Template"}</DialogTitle>
              <DialogDescription>Create reusable checklist items for inspections.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="desc" className="text-right">Item</Label>
                <Input id="desc" className="col-span-3" value={description} onChange={(e) => setDescription(e.target.value)} required />
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


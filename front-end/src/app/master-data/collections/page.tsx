"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchCollections, createCollection, updateCollection, deleteCollection } from "@/lib/api";
import { Plus, Trash2, Search, LayoutGrid, Loader2, AlertCircle, Pencil, Eye, EyeOff, PackageSearch } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CollectionRow = { 
  id: number; 
  name: string; 
  show_in_public: number;
  created_at: string; 
};

export default function CollectionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [showInPublic, setShowInPublic] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCollections();
      setItems(data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to load collections", variant: "destructive" });
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
    setShowInPublic(true);
    setIsDialogOpen(true);
  };

  const openEdit = (c: CollectionRow) => {
    setEditId(c.id);
    setName(c.name);
    setShowInPublic(Boolean(c.show_in_public));
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const payload = { 
        name: trimmed, 
        show_in_public: showInPublic ? 1 : 0 
      };

      if (editId) {
        await updateCollection(String(editId), payload);
        toast({ title: "Updated", description: "Collection updated successfully" });
      } else {
        await createCollection(payload);
        toast({ title: "Created", description: "Collection created successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number, collectionName: string) => {
    if (!confirm(`Are you sure you want to delete the "${collectionName}" collection?`)) return;
    try {
      await deleteCollection(String(id));
      toast({ title: "Deleted", description: "Collection removed", variant: "destructive" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || "Failed to delete collection", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Product Collections">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product Collections</h1>
          <p className="text-muted-foreground mt-1">Group products for specialized POS filtering and menu categorization</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-fit px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
            {items.length} Groups
          </Badge>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            New Collection
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search collections..." 
            className="pl-9 h-11 bg-white dark:bg-card border-slate-200 dark:border-slate-800" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Fetching collections...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No collections found</h3>
                <p className="text-muted-foreground max-w-xs mt-1">
                  {query ? "Try adjusting your search filters." : "Start by creating groups like 'Best Sellers' or 'Seasonal Menu'."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all duration-200">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`p-3 rounded-2xl ${c.show_in_public ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'} transition-colors`}>
                        <LayoutGrid className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                          {c.show_in_public ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 text-[10px] px-1.5 h-4 uppercase font-black">POS VISIBLE</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] px-1.5 h-4 uppercase font-black">INTERNAL ONLY</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-0.5">COLLECTION_ID: {c.id.toString().padStart(4, '0')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 px-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 font-bold gap-2"
                        asChild
                      >
                        <a href={`/master-data/collections/${c.id}/products`}>
                           <PackageSearch className="w-4 h-4" />
                           Products
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => void remove(c.id, c.name)}>
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
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl">
          <form onSubmit={submit}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-400/20 rounded-full -ml-12 -mb-12 blur-xl" />
              
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-xl">
                 <LayoutGrid className="w-7 h-7" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">{editId ? "Update Grouping" : "New Collection"}</DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium opacity-90">Organize your products for a better checkout experience.</DialogDescription>
            </div>
            
            <div className="p-8 space-y-8 bg-white dark:bg-card">
              <div className="space-y-3">
                <Label htmlFor="colname" className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Collection Name</Label>
                <Input 
                  id="colname" 
                  autoFocus
                  placeholder="e.g., Summer Specials, Fast Food..."
                  className="h-12 text-lg font-bold border-slate-200 focus:ring-indigo-500 rounded-xl" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="public-toggle" className="font-bold text-slate-900 dark:text-white">Show in POS Filters</Label>
                    {showInPublic ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Toggle visibility as a shortcut button in the terminal grid.</p>
                </div>
                <Switch 
                  id="public-toggle"
                  checked={showInPublic} 
                  onCheckedChange={setShowInPublic}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" className="font-bold text-slate-500" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px] font-bold rounded-xl h-11 shadow-lg shadow-indigo-200 dark:shadow-none" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

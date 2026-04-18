"use client"

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchCollections, 
  fetchCollectionParts, 
  syncCollectionParts, 
  fetchParts 
} from "@/lib/api";
import { 
  ArrowLeft, 
  Search, 
  LayoutGrid, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  Save,
} from "lucide-react";

type ProductMapping = {
  id: number;
  part_name: string;
  sku: string | null;
  brand?: string;
};

export default function CollectionMappingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<ProductMapping[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Fetch collection details
      const allCols = await fetchCollections();
      const current = allCols.find((c: any) => String(c.id) === collectionId);
      if (!current) throw new Error("Collection not found");
      setCollection(current);

      // 2. Fetch all products (Previously incorrectly named fetchInventory)
      const inventory = await fetchParts();
      setAllProducts(inventory);

      // 3. Fetch current mappings
      const currentParts = await fetchCollectionParts(collectionId);
      setSelectedIds(new Set(currentParts.map((p: any) => p.id)));
      
    } catch (err) {
      toast({ 
        title: "Error", 
        description: (err as Error).message || "Failed to load mapping data", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [collectionId]);

  const filtered = useMemo(() => {
    let list = allProducts;
    if (showSelectedOnly) {
      list = list.filter(p => selectedIds.has(p.id));
    }
    
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(p => 
        p.part_name.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [allProducts, query, selectedIds, showSelectedOnly]);

  const toggleProduct = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await syncCollectionParts(collectionId, Array.from(selectedIds));
      toast({ 
        title: "Success", 
        description: "Collection products updated successfully",
        className: "bg-emerald-600 text-white border-none"
      });
      // Small delay then go back
      setTimeout(() => router.push("/master-data/collections"), 1500);
    } catch (err) {
      toast({ 
        title: "Error", 
        description: (err as Error).message || "Failed to save mappings", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading Mapping...">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20 mb-4" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Mapping interface...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Manage: ${collection?.name || 'Collection'}`}>
      <div className="w-full px-4 md:px-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.push("/master-data/collections")}
                className="rounded-full h-11 w-11 hover:bg-white dark:hover:bg-slate-900 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-indigo-600" />
                <h1 className="text-2xl font-black tracking-tight">{collection?.name}</h1>
              </div>
              <p className="text-muted-foreground text-sm font-medium">Assign products to this collection for POS categories</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Total Assigned</p>
                <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">{selectedIds.size} <span className="text-sm font-bold opacity-60 ml-px text-indigo-500">Items</span></p>
             </div>
             <Button 
                onClick={handleSave} 
                className="bg-indigo-600 hover:bg-indigo-700 h-12 px-6 font-bold rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none gap-2"
                disabled={saving}
             >
               {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               Save Changes
             </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-card">
          <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by product name, SKU or brand..." 
                className="pl-10 h-11 bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 rounded-xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 h-11 px-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Label htmlFor="selection-filter" className="text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">Selected Only</Label>
               <Checkbox 
                  id="selection-filter" 
                  checked={showSelectedOnly}
                  onCheckedChange={(val) => setShowSelectedOnly(Boolean(val))}
                  className="data-[state=checked]:bg-indigo-600 border-indigo-200"
               />
            </div>
          </CardContent>
        </Card>

        {/* Product List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
          {filtered.map((p) => {
            const isSelected = selectedIds.has(p.id);
            return (
              <Card 
                key={p.id} 
                onClick={() => toggleProduct(p.id)}
                className={`group cursor-pointer transition-all duration-300 border-2 rounded-3xl overflow-hidden hover:scale-[1.02] ${isSelected ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-500/5 shadow-lg shadow-indigo-100 dark:shadow-none' : 'border-transparent bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 shadow-sm'}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                    {isSelected ? <CheckCircle2 className="w-7 h-7" /> : <Package className="w-7 h-7" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold transition-colors truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>{p.part_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                       {p.sku && <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 border-slate-200 dark:border-slate-800 opacity-60">{p.sku}</Badge>}
                       {p.brand && <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 border-indigo-100 text-indigo-600 bg-indigo-50/30">{p.brand}</Badge>}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>
                         {isSelected && <CheckCircle2 className="w-4 h-4" /> }
                      </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {filtered.length === 0 && (
             <div className="col-span-full py-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                   <AlertCircle className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No products found</h3>
                <p className="text-muted-foreground mt-1">Try adjusting your search query or filters.</p>
             </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

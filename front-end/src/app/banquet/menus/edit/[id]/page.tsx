"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Loader2, 
  Utensils, 
  ChefHat, 
  PlusCircle,
  X,
  ArrowLeft,
  Save,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Appetizer", "Salad", "Main Course", "Side Dish", "Dessert", "Beverage"];

export default function EditBanquetMenuPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const menuId = params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState<any>({
    name: "",
    description: "",
    price_per_pax: "",
    cost_price: 0,
    is_active: 1,
    items: []
  });

  const [newItem, setNewItem] = useState({ 
    part_id: "", 
    name: "", 
    category: CATEGORIES[0], 
    qty: 1,
    unit_cost: 0
  });

  useEffect(() => {
    if (menuId) {
      loadData();
    }
  }, [menuId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Parts
      const partsRes = await api("/api/part/list");
      const partsData = await partsRes.json();
      setParts(partsData.data || []);

      // Load Menu
      const menuRes = await api(`/api/banquet/menus/${menuId}`);
      const menuData = await menuRes.json();
      const menu = menuData.data;

      // Load Menu Items
      const itemsRes = await api(`/api/banquet/menu_items?menu_id=${menuId}`);
      const itemsData = await itemsRes.json();
      const items = (itemsData.data || []).map((i: any) => ({
        ...i,
        unit_cost: i.unit_cost || 0
      }));

      setFormData({
        name: menu.name,
        description: menu.description || "",
        price_per_pax: menu.price_per_pax,
        cost_price: Number(menu.cost_price) || 0,
        is_active: Number(menu.is_active),
        items: items
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to load menu data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addTempItem = () => {
    if (!newItem.name.trim()) return;
    const items = [...formData.items, { ...newItem, id: Date.now(), is_new: true }];
    const totalCost = items.reduce((sum, i) => sum + (Number(i.unit_cost) * Number(i.qty)), 0);
    
    setFormData({
      ...formData,
      items,
      cost_price: totalCost
    });
    setNewItem({ part_id: "", name: "", category: CATEGORIES[0], qty: 1, unit_cost: 0 });
  };

  const removeTempItem = (id: any) => {
    const items = formData.items.filter((i: any) => (i.id !== id));
    const totalCost = items.reduce((sum, i) => sum + (Number(i.unit_cost) * Number(i.qty)), 0);
    setFormData({
      ...formData,
      items,
      cost_price: totalCost
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Update Menu and Items
      // Note: The backend currently supports updating menu, but for items we might need to handle them specially 
      // if we want to sync the full list in one go.
      // I'll update the backend to support full item sync if it doesn't already.
      const res = await api(`/api/banquet/menus/${menuId}`, {
        method: "PUT",
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Menu updated successfully" });
        router.push("/banquet/menus");
      }
    } catch (err) {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Edit Menu: {formData.name}</h2>
            <p className="text-muted-foreground">Modify menu details, pricing and dish composition.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Menu Name</Label>
                    <Input 
                      placeholder="e.g. Platinum Wedding Menu" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price Per Pax (LKR)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={formData.price_per_pax}
                      onChange={e => setFormData({...formData, price_per_pax: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description / Tagline</Label>
                  <Input 
                    placeholder="Short summary of the menu style" 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    checked={formData.is_active === 1} 
                    onChange={e => setFormData({...formData, is_active: e.target.checked ? 1 : 0})}
                    id="is_active"
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Set as Active Menu</Label>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Dish List / Items</CardTitle>
                <Badge variant="outline">{formData.items.length} Items</Badge>
              </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-3 bg-muted/30 p-4 rounded-2xl border border-dashed border-primary/20">
                  <div className="flex-1">
                    <Label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Select Item from Master</Label>
                    <SearchableSelect 
                      options={parts.map(p => ({ 
                        value: String(p.id), 
                        label: `${p.part_name} (Cost: LKR ${Number(p.cost_price).toLocaleString()})` 
                      }))}
                      value={newItem.part_id}
                      onValueChange={v => {
                        const p = parts.find(x => String(x.id) === v);
                        if (p) setNewItem({...newItem, part_id: v, name: p.part_name, unit_cost: p.cost_price});
                      }}
                      placeholder="Search in Item Master..."
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <Label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Category</Label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="w-full md:w-24">
                    <Label className="text-[10px] uppercase font-bold opacity-50 mb-1 block">Qty</Label>
                    <Input 
                      type="number" 
                      value={newItem.qty} 
                      onChange={e => setNewItem({...newItem, qty: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={addTempItem} className="w-full md:w-auto" disabled={!newItem.part_id}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {CATEGORIES.map(cat => {
                    const catItems = formData.items.filter((i: any) => i.category === cat);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="h-px flex-1 bg-muted"></div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">{cat}</span>
                           <div className="h-px flex-1 bg-muted"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {catItems.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-background group hover:border-primary/30 transition-colors shadow-sm">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{item.name}</span>
                                <span className="text-[10px] text-muted-foreground">Qty: {item.qty} | Unit Cost: LKR {Number(item.unit_cost).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-primary">LKR {(item.qty * item.unit_cost).toLocaleString()}</span>
                                <button 
                                  onClick={() => removeTempItem(item.id)}
                                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Action */}
          <div className="space-y-6">
            <Card className="bg-primary text-white border-none shadow-xl sticky top-6">
              <CardHeader>
                <CardTitle className="text-white/80 text-xs uppercase tracking-widest">Summary & Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-2xl bg-white/10 border border-white/20">
                   <p className="text-xs text-white/60 mb-1">Selling Price (per Pax)</p>
                   <p className="text-3xl font-black">LKR {Number(formData.price_per_pax || 0).toLocaleString()}</p>
                </div>

                <div className="space-y-3 p-4 rounded-2xl bg-black/20 border border-white/5">
                   <div className="flex justify-between items-center">
                      <span className="text-xs text-white/60">Calculated Cost</span>
                      <span className="font-bold">LKR {Number(formData.cost_price).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs text-white/60">Profit Margin</span>
                      <span className={cn(
                        "font-black text-lg",
                        (Number(formData.price_per_pax) - formData.cost_price) > 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        LKR {(Number(formData.price_per_pax) - formData.cost_price).toLocaleString()}
                      </span>
                   </div>
                   <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold opacity-50">Margin %</span>
                      <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                        {formData.price_per_pax > 0 ? Math.round(((Number(formData.price_per_pax) - formData.cost_price) / Number(formData.price_per_pax)) * 100) : 0}%
                      </Badge>
                   </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                   <div className="flex justify-between text-sm">
                      <span className="opacity-70">Included Items</span>
                      <span className="font-bold">{formData.items.length}</span>
                   </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button 
                  className="w-full bg-white text-primary hover:bg-white/90 font-bold py-6 text-lg rounded-xl shadow-lg"
                  onClick={handleSubmit}
                  disabled={submitting || !formData.name}
                >
                  {submitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Update Menu Plan
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => router.push("/banquet/menus")}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

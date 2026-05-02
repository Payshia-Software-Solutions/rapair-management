"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Search, 
  Loader2, 
  Edit, 
  Trash2, 
  Utensils, 
  ChefHat, 
  XCircle,
  PlusCircle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = ["Appetizer", "Salad", "Main Course", "Side Dish", "Dessert", "Beverage"];

export default function BanquetMenusPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [currentMenu, setCurrentMenu] = useState<any | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const res = await api("/api/banquet/menus");
      const data = await res.json();
      setMenus(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load menus", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async (menuId: number) => {
    setItemLoading(true);
    try {
      const res = await api(`/api/banquet/menu_items?menu_id=${menuId}`);
      const data = await res.json();
      setMenuItems(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteMenu = async (id: number) => {
    if (!confirm("Are you sure? This will delete the menu and all its items.")) return;
    try {
      const res = await api(`/api/banquet/menus/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Menu deleted" });
        loadMenus();
      }
    } catch (err) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  };

  const filteredMenus = menus.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Banquet Menus</h2>
            <p className="text-muted-foreground">Manage preset food menus and items for events.</p>
          </div>
          <Button onClick={() => router.push("/banquet/menus/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Menu
          </Button>
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search menus..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenus.map((menu) => (
              <Card key={menu.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{menu.name}</CardTitle>
                    </div>
                    <Badge variant={menu.is_active ? "default" : "secondary"}>
                      {menu.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground min-h-[40px]">
                    {menu.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Price per Pax</p>
                      <p className="text-xl font-black text-primary">LKR {Number(menu.price_per_pax).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setCurrentMenu(menu);
                      loadMenuItems(menu.id);
                      setIsItemDialogOpen(true);
                    }}>
                      <ChefHat className="w-4 h-4 mr-2" />
                      View Items
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => router.push(`/banquet/menus/edit/${menu.id}`)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => handleDeleteMenu(menu.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Menu Items Dialog (Viewer Only) */}
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Menu Composition: {currentMenu?.name}</DialogTitle>
              <DialogDescription>A detailed list of dishes included in this menu tier.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-6">
                <div className="max-h-[450px] overflow-y-auto space-y-4 pr-2">
                  {itemLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-2 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-xs">Loading dish list...</p>
                    </div>
                  ) : (
                    <>
                      {CATEGORIES.map(cat => {
                        const items = menuItems.filter(i => i.category === cat);
                        if (items.length === 0) return null;
                        return (
                          <div key={cat} className="space-y-2">
                            <div className="flex items-center gap-2">
                               <div className="h-px flex-1 bg-muted"></div>
                               <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded">{cat}</span>
                               <div className="h-px flex-1 bg-muted"></div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {items.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold text-foreground">{item.name}</span>
                                     {item.description && <span className="text-[10px] text-muted-foreground">{item.description}</span>}
                                  </div>
                                  <Badge variant="secondary" className="font-bold">
                                    {Number(item.qty).toLocaleString()} {item.unit || 'Items'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {menuItems.length === 0 && (
                        <div className="text-center py-12 bg-muted/5 rounded-3xl border border-dashed">
                          <ChefHat className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground italic">No dishes have been added to this menu yet.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsItemDialogOpen(false)} className="w-full">Close Viewer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

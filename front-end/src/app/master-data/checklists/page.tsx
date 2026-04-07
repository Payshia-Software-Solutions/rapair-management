"use client"

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Plus, Trash2, ListChecks, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ITEMS = [
  'Check brake fluid',
  'Inspect brake pads',
  'Check rotors',
  'Check coolant level',
  'Inspect radiator',
  'Check thermostat',
  'Change oil',
  'Rotate tires',
  'Top up fluids'
];

export default function ChecklistItemsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [newItem, setNewItem] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      setItems([newItem.trim(), ...items]);
      setNewItem('');
      toast({ title: "Item Added", description: "Successfully added to the global checklist repository." });
    }
  };

  const handleDelete = (name: string) => {
    setItems(items.filter(i => i !== name));
    toast({ title: "Item Removed", variant: "destructive" });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Checklist Repository</h1>
          <p className="text-muted-foreground mt-1">Manage global templates for repair inspections</p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 bg-rose-50 text-rose-700 border-rose-200">
          {items.length} Template Items
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Add Template Item</CardTitle>
              <CardDescription>Create a new reusable checklist task</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Item Description (e.g. Inspect Air Filter)" 
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2 bg-rose-600 hover:bg-rose-700">
                  <Plus className="w-4 h-4" />
                  Save to Repo
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search templates..." className="pl-9" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => (
              <Card key={item} className="border-none shadow-sm group hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                      <ListChecks className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium leading-tight">{item}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

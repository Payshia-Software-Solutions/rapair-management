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
import { Tags, Plus, Trash2, Hash } from 'lucide-react';
import { REPAIR_CATEGORIES } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState(REPAIR_CATEGORIES);
  const [newCat, setNewCat] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCat.trim()) {
      setCategories([...categories, newCat.trim()]);
      setNewCat('');
      toast({ title: "Category Added", description: `${newCat} is now available for repairs.` });
    }
  };

  const handleDelete = (name: string) => {
    setCategories(categories.filter(c => c !== name));
    toast({ title: "Category Removed", description: `${name} has been removed.`, variant: "destructive" });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Repair Categories</h1>
          <p className="text-muted-foreground mt-1">Classify repair jobs for better reporting and assignment</p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1 bg-purple-50 text-purple-700 border-purple-200">
          {categories.length} System Categories
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Add New Category</CardTitle>
              <CardDescription>Define a new repair classification</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Category Name (e.g. Hybrid System)" 
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-muted/30">
                {categories.map((cat, idx) => (
                  <div key={cat} className="flex items-center justify-between p-4 group hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">#{(idx + 1).toString().padStart(2, '0')}</span>
                      <h3 className="font-semibold text-sm">{cat}</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(cat)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchHRCategories,
  HRCategoryRow,
  api
} from "@/lib/api/hrm";
import { Loader2, Layers, Plus, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<HRCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState({ name: "", prefix: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHRCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: "Sync Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddCat = async () => {
    if (!newCat.name || !newCat.prefix) return;
    try {
      await api('/api/hrsettings/categories', { method: 'POST', body: JSON.stringify(newCat) });
      toast({ title: "Success", description: "Category added" });
      setNewCat({ name: "", prefix: "" });
      void loadData();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message });
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
           <Link href="/hrm/settings" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mb-2">
             <ArrowLeft className="w-3 h-3" /> Back to Settings
           </Link>
           <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
             <Layers className="w-8 h-8 text-blue-500" />
             Staff Categories
           </h1>
           <p className="text-muted-foreground mt-1">Manage employment classifications and identification groups</p>
        </div>
      </div>

      {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading categories...</p>
          </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="border-none shadow-md bg-card/60">
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg">Add New Category</CardTitle>
                    <CardDescription>Categories define the 'rank' or 'type' of staff (e.g. Executive, Worker, Intern)</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Category Name</Label>
                            <Input 
                                placeholder="e.g. Management" 
                                className="h-11 font-medium"
                                value={newCat.name} 
                                onChange={e=>setNewCat({...newCat, name: e.target.value})} 
                            />
                        </div>
                        <div className="w-32 space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Short Prefix</Label>
                            <Input 
                                placeholder="MG" 
                                className="h-11 font-mono font-bold"
                                maxLength={5} 
                                value={newCat.prefix} 
                                onChange={e=>setNewCat({...newCat, prefix: e.target.value.toUpperCase()})} 
                            />
                        </div>
                        <Button className="mt-7 h-11 px-6 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700" onClick={handleAddCat}>
                            <Plus className="w-4 h-4 mr-2" />
                            Save Category
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card/60">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6">Category</TableHead>
                                <TableHead className="text-center w-32">Rank Prefix</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map(c => (
                                <TableRow key={c.id} className="hover:bg-muted/10 border-muted/10">
                                    <TableCell className="font-semibold px-6">{c.name}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="font-mono text-blue-500 border-blue-500/20 bg-blue-500/5 uppercase tracking-widest px-3">
                                            {c.prefix}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {categories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-20 text-muted-foreground italic">
                                        No categories configured yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

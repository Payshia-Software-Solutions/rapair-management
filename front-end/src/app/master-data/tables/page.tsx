"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchTables, createTable, updateTable, deleteTable, fetchLocations } from "@/lib/api";
import { LayoutGrid, Loader2, Plus, Trash2, Pencil, Search, MapPin } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RestaurantTablesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTables();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void fetchLocations().then(data => setLocations(Array.isArray(data) ? data : []));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || String(r.id).includes(q));
  }, [rows, query]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    // Default to current context if available
    const activeLoc = typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : "";
    setLocationId(activeLoc || "");
    setIsDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingId(String(row.id));
    setName(row.name ?? "");
    setLocationId(String(row.location_id ?? ""));
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateTable(editingId, { name: n, location_id: locationId });
        toast({ title: "Updated", description: "Table updated" });
      } else {
        await createTable({ name: n, location_id: locationId });
        toast({ title: "Created", description: "Table created" });
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this table? This might impact existing historical records.")) return;
    try {
      await deleteTable(String(id));
      toast({ title: "Deleted", description: "Table deleted" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            Restaurant Tables
          </h1>
          <p className="text-muted-foreground mt-1">Manage physical tables for Dine-In POS services</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 border-primary/20 text-primary">
            {rows.length} Tables
          </Badge>
          <Button className="gap-2 bg-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New Table
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Table Directory</CardTitle>
          <CardDescription>Search and maintain restaurant tables</CardDescription>
          <div className="pt-3 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-[22px]" />
            <Input
              className="pl-9"
              placeholder="Search tables..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading tables...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[90px]">ID</TableHead>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-mono text-xs font-bold">#{r.id}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium bg-blue-50/50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20">
                        {r.location_name || `Location #${r.location_id}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void remove(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No tables found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Table" : "Create Table"}</DialogTitle>
              <DialogDescription>Define a table name as it will appear in the POS Dine-In selector.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="table-name" className="text-right">Table Name</Label>
                <Input
                  id="table-name"
                  className="col-span-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Table 01 or VIP Room"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">Location</Label>
                <div className="col-span-3">
                  <Select value={locationId} onValueChange={setLocationId} required>
                    <SelectTrigger id="location" className="w-full">
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Save Changes" : "Create Table")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

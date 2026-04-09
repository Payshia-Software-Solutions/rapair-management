"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createLocation, deleteLocation, fetchLocations, updateLocation } from "@/lib/api";
import { Loader2, MapPin, Plus, Trash2, Pencil, Search } from "lucide-react";
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

type LocationRow = {
  id: number;
  name: string;
  location_type?: "service" | "warehouse";
  address?: string | null;
  phone?: string | null;
};

export default function AdminLocationsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [locationType, setLocationType] = useState<"service" | "warehouse">("service");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchLocations();
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
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      String(r.id).includes(q) ||
      (r.address ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setLocationType("service");
    setAddress("");
    setPhone("");
    setIsDialogOpen(true);
  };

  const openEdit = (row: LocationRow) => {
    setEditingId(row.id);
    setName(row.name ?? "");
    setLocationType(row.location_type ?? "service");
    setAddress(row.address ?? "");
    setPhone(row.phone ?? "");
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    setIsSubmitting(true);
    try {
    const payload = { name: n, location_type: locationType, address: address.trim() || undefined, phone: phone.trim() || undefined };
      if (editingId) {
        await updateLocation(String(editingId), payload);
        toast({ title: "Updated", description: "Location updated" });
      } else {
        await createLocation(payload);
        toast({ title: "Created", description: "Location created" });
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
    if (!confirm("Delete this location?")) return;
    try {
      await deleteLocation(String(id));
      toast({ title: "Deleted", description: "Location deleted" });
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
            <MapPin className="w-6 h-6 text-primary" />
            Service Locations
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage service center locations</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 border-primary/20 text-primary">
            {rows.length} Locations
          </Badge>
          <Button className="gap-2 bg-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New Location
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Directory</CardTitle>
          <CardDescription>Search and maintain locations</CardDescription>
          <div className="pt-3 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-[22px]" />
            <Input
              className="pl-9"
              placeholder="Search by name, address, phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading locations...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[90px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-mono text-xs font-bold">#{r.id}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location_type ?? "service"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.address ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.phone ?? "-"}</TableCell>
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
                          disabled={r.id === 1}
                          title={r.id === 1 ? "Default location cannot be deleted" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No locations found.
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
              <DialogTitle>{editingId ? "Edit Location" : "Create Location"}</DialogTitle>
              <DialogDescription>
                Locations are used to scope orders and service bays. Master data remains company-wide.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="loc-name" className="text-right">Name</Label>
                <Input
                  id="loc-name"
                  className="col-span-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <div className="col-span-3 flex gap-2">
                  <Button
                    type="button"
                    variant={locationType === "service" ? "default" : "outline"}
                    onClick={() => setLocationType("service")}
                  >
                    Service Center
                  </Button>
                  <Button
                    type="button"
                    variant={locationType === "warehouse" ? "default" : "outline"}
                    onClick={() => setLocationType("warehouse")}
                  >
                    Warehouse
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="loc-address" className="text-right">Address</Label>
                <Input
                  id="loc-address"
                  className="col-span-3"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="loc-phone" className="text-right">Phone</Label>
                <Input
                  id="loc-phone"
                  className="col-span-3"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Save" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

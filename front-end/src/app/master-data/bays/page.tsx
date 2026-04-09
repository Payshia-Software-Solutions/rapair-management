"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createBay, deleteBay, fetchBaysAll, updateBay, updateBayStatus, type BayListAllRow } from "@/lib/api";
import { Grid, Plus, Trash2, MapPin, AlertCircle, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Bay = {
  id: number;
  location_id: number;
  location_name: string;
  name: string;
  status: "Available" | "Occupied" | "Out of Service";
  created_at?: string;
};

export default function BaysPage() {
  const { toast } = useToast();
  const [bays, setBays] = useState<Bay[]>([]);
  const [locations, setLocations] = useState<Array<{ id: number; name: string; location_type?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | "all">("all");
  const [formLocationId, setFormLocationId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBaysAll();
      const locs = Array.isArray((data as any)?.locations) ? (data as any).locations : [];
      const bayRows = Array.isArray((data as any)?.bays) ? ((data as any).bays as BayListAllRow[]) : [];

      setLocations(
        locs
          .map((l: any) => ({ id: Number(l.id), name: String(l.name ?? ""), location_type: l.location_type }))
          .filter((l: any) => l.id > 0 && l.name)
      );
      setBays(
        bayRows
          .map((b: any) => ({
            id: Number(b.id),
            location_id: Number(b.location_id),
            location_name: String(b.location_name ?? ""),
            name: String(b.name ?? ""),
            status: (String(b.status ?? "Available") as Bay["status"]) || "Available",
            created_at: b.created_at ? String(b.created_at) : undefined,
          }))
          .filter((b) => Number.isFinite(b.id) && b.id > 0 && Number.isFinite(b.location_id) && b.location_id > 0 && !!b.name)
      );
    } catch {
      toast({ title: "Error", description: "Failed to load bays", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      selectedLocationId === "all" ? bays : bays.filter((b) => b.location_id === selectedLocationId);
    if (!q) return base;
    return base.filter((b) => b.name.toLowerCase().includes(q) || b.location_name.toLowerCase().includes(q));
  }, [bays, query, selectedLocationId]);

  const locationCount = useMemo(() => {
    // Prefer the locations list from the API (shows allowed locations even if no bays yet).
    if (locations.length > 0) return locations.length;
    const ids = new Set<number>();
    for (const b of bays) ids.add(b.location_id);
    return ids.size;
  }, [bays, locations]);

  const grouped = useMemo(() => {
    const byLoc = new Map<number, Bay[]>();
    for (const b of filtered) {
      const key = b.location_id;
      if (!byLoc.has(key)) byLoc.set(key, []);
      byLoc.get(key)!.push(b);
    }
    const locOrder =
      selectedLocationId === "all"
        ? locations.map((l) => l.id)
        : [selectedLocationId as number];
    return locOrder
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => {
        const loc = locations.find((l) => l.id === id);
        return {
          location_id: id,
          location_name: loc?.name ?? (filtered.find((b) => b.location_id === id)?.location_name ?? `Location ${id}`),
          bays: byLoc.get(id) ?? [],
        };
      })
      .filter((x) => x.bays.length > 0 || selectedLocationId !== "all"); // if filtering by a single location, show empty state via main logic
  }, [filtered, locations, selectedLocationId]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    // Default to current context location if it exists; otherwise fall back to first available location.
    const ls = typeof window !== "undefined" ? Number(window.localStorage.getItem("location_id") || "") : NaN;
    const fallback = locations[0]?.id ?? null;
    const init = Number.isFinite(ls) && ls > 0 ? ls : fallback;
    setFormLocationId(init);
    setIsDialogOpen(true);
  };

  const openEdit = (bay: Bay) => {
    setEditId(bay.id);
    setName(bay.name);
    setFormLocationId(bay.location_id);
    setIsDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        await updateBay(String(editId), { name: trimmed });
        toast({ title: "Updated", description: "Bay updated successfully" });
      } else {
        await createBay({ name: trimmed, location_id: formLocationId ?? undefined });
        toast({ title: "Created", description: "Bay created successfully" });
      }
      setIsDialogOpen(false);
      await load();
    } catch {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: number, bayName: string) => {
    if (!confirm(`Delete ${bayName}?`)) return;
    try {
      await deleteBay(String(id));
      toast({ title: "Deleted", description: "Bay removed", variant: "destructive" });
      await load();
    } catch {
      toast({ title: "Error", description: "Failed to delete bay", variant: "destructive" });
    }
  };

  const setStatus = async (bay: Bay, status: Bay["status"]) => {
    try {
      await updateBayStatus(String(bay.id), status);
      setBays((prev) => prev.map((b) => (b.id === bay.id ? { ...b, status } : b)));
      toast({ title: "Updated", description: `${bay.name} marked as ${status}` });
    } catch {
      toast({ title: "Error", description: "Failed to update bay status", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workshop Bays</h1>
          <p className="text-muted-foreground mt-1">Configure physical repair locations and zones</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-fit px-3 py-1 bg-cyan-50 text-cyan-700 border-cyan-200">
            {locationCount} Active Locations
          </Badge>
          <Button onClick={openAdd} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4" />
            Add Bay
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm bg-cyan-50/50">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
              <p className="text-xs text-cyan-800 leading-relaxed">
                Bays represent physical slots where vehicles are parked for repair. Ensure names are unique for clear assignment.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Search</CardTitle>
              <CardDescription>Find a bay by name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Select
                  value={String(selectedLocationId)}
                  onValueChange={(v) => setSelectedLocationId(v === "all" ? "all" : Number(v))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Search bays..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading bays...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold">No bays found</h3>
              <p className="text-muted-foreground max-w-xs">
                {query ? "No bays match your search criteria." : "Get started by adding your first bay."}
              </p>
              {query && (
                <Button variant="ghost" className="mt-4" onClick={() => setQuery("")}>Clear Search</Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {(selectedLocationId === "all" ? grouped : [{ location_id: selectedLocationId as number, location_name: "", bays: filtered }]).map((g) => {
                const locName =
                  selectedLocationId === "all"
                    ? g.location_name
                    : locations.find((l) => l.id === (selectedLocationId as number))?.name ?? filtered[0]?.location_name ?? "";
                return (
                  <div key={g.location_id} className="space-y-3">
                    {selectedLocationId === "all" && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-base font-bold">{locName}</h2>
                          <span className="text-xs text-muted-foreground">{g.bays.length} bays</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {g.bays.map((bay) => (
                        <Card key={bay.id} className="border-none shadow-sm group hover:ring-2 hover:ring-cyan-200 transition-all">
                          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 relative">
                            <div className="p-3 bg-cyan-100 rounded-2xl text-cyan-700">
                              <MapPin className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-sm">{bay.name}</h3>

                            <div className="w-full">
                              <Select value={bay.status} onValueChange={(v) => void setStatus(bay, v as Bay["status"])}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Available">Available</SelectItem>
                                  <SelectItem value="Occupied">Occupied</SelectItem>
                                  <SelectItem value="Out of Service">Out of Service</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => openEdit(bay)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => void remove(bay.id, bay.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Bay" : "Add Bay"}</DialogTitle>
              <DialogDescription>Set the display name used across the system.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editId && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Location</Label>
                  <div className="col-span-3">
                    <Select
                      value={formLocationId ? String(formLocationId) : ""}
                      onValueChange={(v) => setFormLocationId(Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bayname" className="text-right">Name</Label>
                <Input
                  id="bayname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. Bay 10"
                  required
                />
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

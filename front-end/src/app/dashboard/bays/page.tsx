"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Grid, Loader2, RefreshCcw, Clock, User as UserIcon, ArrowUpRight, MapPin, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type BayRow = {
  id: number;
  name: string;
  status: "Available" | "Occupied" | "Out of Service" | string;
  active_order: null | {
    id: number;
    vehicle_id: number | null;
    vehicle_model: string;
    vehicle_identifier: string | null;
    mileage: number | null;
    priority: string | null;
    status: string;
    expected_time: string | null;
    release_time?: string | null;
    technician: string | null;
    created_at: string;
    updated_at: string;
  };
  active_orders_count: number;
};

function statusMeta(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "available") {
    return {
      label: "Available",
      badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
      dot: "bg-emerald-500",
      card: "border-emerald-500/15 hover:border-emerald-500/30",
    };
  }
  if (s === "occupied") {
    return {
      label: "Occupied",
      badge: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
      dot: "bg-amber-500",
      card: "border-amber-500/15 hover:border-amber-500/30",
    };
  }
  return {
    label: status || "Out of Service",
    badge: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
    dot: "bg-slate-400",
    card: "border-slate-500/15 hover:border-slate-500/30",
  };
}

export default function BaysBoardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [viewMode, setViewMode] = useState<"current" | "all">("current");
  const [canWrite, setCanWrite] = useState(false);
  const [locations, setLocations] = useState<Array<{
    location_id: number;
    location_name: string;
    bays: BayRow[];
    unassigned_active_orders: any[];
    unknown_assigned_orders: any[];
  }>>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addLocationId, setAddLocationId] = useState<number | null>(null);
  const [addBayName, setAddBayName] = useState("");
  const [adding, setAdding] = useState(false);

  const decodeToken = () => {
    try {
      const token = window.localStorage.getItem("auth_token");
      if (!token) return null;
      const part = token.split(".")[1];
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };

  const openAddBay = (locId: number) => {
    setAddLocationId(locId);
    setAddBayName("");
    setAddOpen(true);
  };

  const submitAddBay = async () => {
    const locId = Number(addLocationId ?? 0);
    const name = addBayName.trim();
    if (!locId || !name) return;
    setAdding(true);
    try {
      const res = await api("/api/bay/create", {
        method: "POST",
        headers: { "X-Location-Id": String(locId) },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || j?.status !== "success") throw new Error(j?.message || `Failed to create bay (HTTP ${res.status})`);
      toast({ title: "Bay created", description: `Created "${name}"` });
      setAddOpen(false);
      setAddLocationId(null);
      setAddBayName("");
      await load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message || "Failed to create bay", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const tokenJson: any = decodeToken();
      const role = String(tokenJson?.role ?? "");
      const allowed = Array.isArray(tokenJson?.allowed_locations) ? tokenJson.allowed_locations : [];
      const allowedClean = allowed
        .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
        .filter((x: any) => x.id > 0 && x.name);

      // If user has access to multiple locations, show location-wise board.
      const multi = role === "Admin" || allowedClean.length > 1;
      setViewMode(multi ? "all" : "current");

      // Permission check for creating bays.
      let perms: string[] = [];
      try {
        const pr = await api("/api/auth/permissions");
        const pj = await pr.json();
        perms = pj?.status === "success" && Array.isArray(pj.data) ? pj.data : [];
      } catch {
        perms = [];
      }
      setCanWrite(role === "Admin" || perms.includes("*") || perms.includes("bays.write"));

      const res = await api(multi ? "/api/bay/board_all" : "/api/bay/board");
      if (!res.ok) throw new Error(`Failed to load bays (HTTP ${res.status})`);
      const json = await res.json();
      const data = json?.status === "success" ? json.data : null;

      if (multi) {
        const locs = data?.locations ?? [];
        setLocations(Array.isArray(locs) ? locs : []);
      } else {
        const locId = Number(data?.location_id ?? 0);
        const nameFromLs = (typeof window !== "undefined" ? window.localStorage.getItem("location_name") : "") || "";
        const locName = nameFromLs || (locId > 0 ? `Location #${locId}` : "Current Location");
        const one = {
          location_id: locId > 0 ? locId : 0,
          location_name: locName,
          bays: Array.isArray(data?.bays) ? data.bays : [],
          unassigned_active_orders: Array.isArray(data?.unassigned_active_orders) ? data.unassigned_active_orders : [],
          unknown_assigned_orders: Array.isArray(data?.unknown_assigned_orders) ? data.unknown_assigned_orders : [],
        };
        setLocations([one]);
      }
    } catch (e) {
      setLocations([]);
      setError((e as Error).message || "Failed to load bays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const by: Record<string, number> = { Available: 0, Occupied: 0, "Out of Service": 0 };
    for (const loc of locations) {
      for (const r of loc.bays || []) {
        if (r.status === "Available") by.Available += 1;
        else if (r.status === "Occupied") by.Occupied += 1;
        else by["Out of Service"] += 1;
      }
    }
    return by;
  }, [locations]);

  const totalBays = useMemo(() => locations.reduce((sum, l) => sum + (l.bays?.length ?? 0), 0), [locations]);

  const fmtExpected = (value: string | null) => {
    if (!value) return null;
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const orderBadge = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "in progress") return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300";
    if (s === "pending") return "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300";
    return "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300";
  };

  const priorityBadge = (p: string | null) => {
    const s = String(p || "").toLowerCase();
    if (s === "urgent" || s === "emergency") return "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300";
    if (s === "high") return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300";
    if (s === "medium") return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300";
    return "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Grid className="w-6 h-6 text-primary" />
            Bays Board
          </h1>
          <p className="text-muted-foreground mt-1">
            Live view of service bays across your allowed locations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 border-primary/20 text-primary">
            {totalBays} Bays
          </Badge>
          <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Available</CardTitle>
            <CardDescription>Ready to accept a vehicle</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-extrabold tracking-tight">{counts.Available}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Occupied</CardTitle>
            <CardDescription>Currently in use</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-extrabold tracking-tight">{counts.Occupied}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Out of Service</CardTitle>
            <CardDescription>Unavailable / maintenance</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-extrabold tracking-tight">{counts["Out of Service"]}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                {viewMode === "all" ? "Workshop Bays (By Location)" : "Workshop Bays (Current Location)"}
              </CardTitle>
              <CardDescription>
                {viewMode === "all"
                  ? "All bays for locations you are allowed to access."
                  : "Uses the current location selected from the header switcher."}{" "}
                Assignment is taken from each active order's "Bay" field.
              </CardDescription>
            </div>
            {viewMode === "current" && canWrite && locations[0]?.location_id ? (
              <Button type="button" className="gap-2" onClick={() => openAddBay(Number(locations[0].location_id))}>
                <Plus className="w-4 h-4" />
                New Bay
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading bays...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <div className="font-semibold text-destructive">Failed to load</div>
              <div className="text-muted-foreground mt-1">{error}</div>
            </div>
          ) : locations.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">No bays found for your allowed locations.</div>
          ) : (
            <Accordion type="multiple" defaultValue={locations.map((l) => String(l.location_id))} className="w-full">
              {locations.map((loc) => {
                const locBays = Array.isArray(loc.bays) ? loc.bays : [];
                const locCounts = locBays.reduce(
                  (acc: any, b: BayRow) => {
                    if (b.status === "Available") acc.Available += 1;
                    else if (b.status === "Occupied") acc.Occupied += 1;
                    else acc.Out += 1;
                    return acc;
                  },
                  { Available: 0, Occupied: 0, Out: 0 }
                );

                return (
                  <AccordionItem key={loc.location_id} value={String(loc.location_id)}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">{loc.location_name}</span>
                          <span className="text-xs text-muted-foreground font-mono">#{loc.location_id}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300">
                            {locCounts.Available} Avail
                          </Badge>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300">
                            {locCounts.Occupied} Occ
                          </Badge>
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300">
                            {locCounts.Out} Out
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {canWrite ? (
                        <div className="flex items-center justify-end pb-3">
                          <Button type="button" variant="outline" className="gap-2" onClick={() => openAddBay(Number(loc.location_id))}>
                            <Plus className="w-4 h-4" />
                            Add Bay to {loc.location_name}
                          </Button>
                        </div>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2">
                        {locBays.map((b) => {
                          const m = statusMeta(b.status);
                          const o = b.active_order;
                          return (
                            <div
                              key={`${loc.location_id}-${b.id}`}
                              className={cn("rounded-xl border bg-card p-4 transition-colors", m.card)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-bold truncate">{b.name}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                    BAY #{b.id}
                                  </div>
                                </div>
                                <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", m.badge)}>
                                  <span className={cn("h-2 w-2 rounded-full", m.dot)} />
                                  {m.label}
                                </span>
                              </div>

                              <div className="mt-3">
                                {!o ? (
                                  <div className="text-xs text-muted-foreground">No active order assigned.</div>
                                ) : (
                                  <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="font-semibold truncate">{o.vehicle_model}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                          Order #{o.id} • {o.status}{o.priority ? ` • ${o.priority}` : ""}{o.expected_time ? ` • Expected ${fmtExpected(o.expected_time)}` : ""}{o.release_time ? ` • Release ${fmtExpected(o.release_time)}` : ""}
                                          {o.vehicle_identifier ? ` • ${o.vehicle_identifier}` : ""}
                                        </div>
                                      </div>
                                      <a
                                        href={`/orders/${o.id}`}
                                        className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                                        title="Open order"
                                      >
                                        View <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                                      </a>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", orderBadge(o.status))}>
                                        {o.status}
                                      </span>
                                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", priorityBadge(o.priority))}>
                                        {o.priority ?? "Priority"}
                                      </span>
                                      {b.active_orders_count > 1 ? (
                                        <span className="text-[11px] text-muted-foreground">
                                          +{b.active_orders_count - 1} more
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="grid gap-1 text-xs">
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="truncate">
                                          Expected: {fmtExpected(o.expected_time) ?? "-"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="truncate">
                                          Release: {fmtExpected((o as any).release_time ?? null) ?? "-"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <UserIcon className="w-3.5 h-3.5" />
                                        <span className="truncate">
                                          Technician: {o.technician ?? "Unassigned"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2 mt-6">
                        <Card className="border-none shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Unassigned Active Orders</CardTitle>
                            <CardDescription>Active orders that have no bay selected yet</CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {loc.unassigned_active_orders?.length ? (
                              <div className="space-y-2">
                                {loc.unassigned_active_orders.slice(0, 8).map((o: any) => (
                                  <div key={o.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 hover:bg-muted/10">
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{o.vehicle_model}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        Order #{o.id} • {o.status}{o.priority ? ` • ${o.priority}` : ""}{o.expected_time ? ` • Expected ${fmtExpected(o.expected_time)}` : ""}{o.release_time ? ` • Release ${fmtExpected(o.release_time)}` : ""}
                                      </div>
                                    </div>
                                    <a href={`/orders/${o.id}`} className="text-xs font-semibold text-primary hover:underline">
                                      View
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">None</div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Data Warnings</CardTitle>
                            <CardDescription>Active orders assigned to unknown bay names</CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {loc.unknown_assigned_orders?.length ? (
                              <div className="space-y-2">
                                {loc.unknown_assigned_orders.slice(0, 8).map((o: any) => (
                                  <div key={`${o.id}-${o.location}`} className="rounded-lg border p-3">
                                    <div className="font-semibold truncate">{o.vehicle_model}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Order #{o.id} • {o.status}{o.priority ? ` • ${o.priority}` : ""}{o.expected_time ? ` • Expected ${fmtExpected(o.expected_time)}` : ""}{o.release_time ? ` • Release ${fmtExpected(o.release_time)}` : ""}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">None</div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create New Bay</DialogTitle>
            <DialogDescription>
              {addLocationId ? `Location ID: ${addLocationId}` : "Select a location in the board to add a bay."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="bayName">Bay Name</Label>
            <Input
              id="bayName"
              value={addBayName}
              onChange={(e) => setAddBayName(e.target.value)}
              placeholder="e.g., Bay 5"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAddBay()}
              disabled={adding || !addLocationId || addBayName.trim() === ""}
              className="gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}




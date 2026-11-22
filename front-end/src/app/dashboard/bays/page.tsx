"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Grid, Loader2, RefreshCcw, MapPin, Plus, Wrench, CircleCheck, CircleSlash } from "lucide-react";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingState } from "@/components/page-shell";
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
  if (s === "available") return { label: "Available", dot: "bg-emerald-500", edge: "border-l-emerald-500" };
  if (s === "occupied") return { label: "Occupied", dot: "bg-amber-500", edge: "border-l-amber-500" };
  return { label: status || "Out of service", dot: "bg-muted-foreground", edge: "border-l-muted-foreground" };
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

  const fmtWhen = (value: string | null | undefined) => {
    if (!value) return null;
    const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const isUrgent = (p: string | null) => ["urgent", "emergency"].includes(String(p || "").toLowerCase());

  const OrderLine = ({ o }: { o: any }) => (
    <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{o.vehicle_model || `Order #${o.id}`}</span>
        <span className="block truncate text-xs text-muted-foreground">
          #{o.id} · {o.status}{o.expected_time ? ` · due ${fmtWhen(o.expected_time)}` : ""}{o.bay ? ` · bay "${o.bay}"` : ""}
        </span>
      </span>
      {o.priority && <Badge variant={isUrgent(o.priority) ? "destructive" : "outline"} className="font-normal">{o.priority}</Badge>}
    </Link>
  );

  return (
    <DashboardLayout title="Bays Board">
      <div className="space-y-5">
        <PageHeader
          title="Bays Board"
          description={viewMode === "all" ? "Service bays across your locations. Assignment comes from each active order's Bay field." : "Service bays at the current location. Assignment comes from each active order's Bay field."}
          actions={<>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            {viewMode === "current" && canWrite && locations[0]?.location_id ? (
              <Button onClick={() => openAddBay(Number(locations[0].location_id))}><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> New bay</Button>
            ) : null}
          </>}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Bays" value={totalBays} icon={<Grid />} />
          <StatCard label="Available" value={counts.Available} hint="Ready for a vehicle" icon={<CircleCheck />} />
          <StatCard label="Occupied" value={counts.Occupied} hint="In use" icon={<Wrench />} />
          <StatCard label="Out of service" value={counts["Out of Service"]} hint="Maintenance / unavailable" icon={<CircleSlash />} />
        </div>

        {loading && !locations.length ? <Card><LoadingState label="Loading bays…" /></Card> : error ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span className="font-medium">Couldn't load bays.</span> <span className="text-muted-foreground">{error}</span>
          </div>
        ) : locations.length === 0 ? <Card><EmptyState title="No bays" description="No bays found for your locations." /></Card> : (
          locations.map((loc) => {
            const bays = Array.isArray(loc.bays) ? loc.bays : [];
            const free = bays.filter((b) => b.status === "Available").length;
            return (
              <section key={loc.location_id} className="space-y-3" aria-label={loc.location_name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> {loc.location_name}
                    <span className="text-sm font-normal text-muted-foreground">· {free} of {bays.length} free</span>
                  </h2>
                  {viewMode === "all" && canWrite && (
                    <Button size="sm" variant="outline" onClick={() => openAddBay(Number(loc.location_id))}><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add bay</Button>
                  )}
                </div>

                {bays.length === 0 ? <Card><EmptyState title="No bays at this location" /></Card> : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {bays.map((b) => {
                      const m = statusMeta(b.status);
                      const o = b.active_order;
                      return (
                        <Card key={`${loc.location_id}-${b.id}`} className={cn("border-l-4 p-3 space-y-2", m.edge)}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-medium">{b.name}</p>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs">
                              <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden="true" /> {m.label}
                            </span>
                          </div>
                          {!o ? <p className="text-xs text-muted-foreground">No active order.</p> : (
                            <Link href={`/orders/${o.id}`} className="block rounded-md border bg-muted/30 p-2 hover:bg-muted/50">
                              <p className="truncate text-sm font-medium">{o.vehicle_model}{o.vehicle_identifier ? ` · ${o.vehicle_identifier}` : ""}</p>
                              <p className="text-xs text-muted-foreground">#{o.id} · {o.status}{b.active_orders_count > 1 ? ` · +${b.active_orders_count - 1} more` : ""}</p>
                              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                                <dt className="text-muted-foreground">Technician</dt><dd className="truncate">{o.technician || "Unassigned"}</dd>
                                <dt className="text-muted-foreground">Due</dt><dd className="truncate tabular-nums">{fmtWhen(o.expected_time) || "—"}</dd>
                                {o.release_time && <><dt className="text-muted-foreground">Release</dt><dd className="truncate tabular-nums">{fmtWhen(o.release_time)}</dd></>}
                              </dl>
                              {o.priority && <Badge variant={isUrgent(o.priority) ? "destructive" : "outline"} className="mt-1.5 font-normal">{o.priority}</Badge>}
                            </Link>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {(loc.unassigned_active_orders?.length > 0 || loc.unknown_assigned_orders?.length > 0) && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    {loc.unassigned_active_orders?.length > 0 && (
                      <SectionCard title="Waiting for a bay" description="Active orders with no bay selected">
                        <ul className="divide-y">{loc.unassigned_active_orders.slice(0, 8).map((o: any) => <li key={o.id}><OrderLine o={o} /></li>)}</ul>
                      </SectionCard>
                    )}
                    {loc.unknown_assigned_orders?.length > 0 && (
                      <SectionCard title="Unknown bay names" description="Orders point to a bay that doesn't exist here. Fix the Bay field on the order.">
                        <ul className="divide-y">{loc.unknown_assigned_orders.slice(0, 8).map((o: any) => <li key={`${o.id}-${o.location}`}><OrderLine o={o} /></li>)}</ul>
                      </SectionCard>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New bay</DialogTitle>
            <DialogDescription>
              {locations.find((l) => Number(l.location_id) === Number(addLocationId))?.location_name || "Pick a location on the board first."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bayName">Bay name</Label>
            <Input id="bayName" value={addBayName} onChange={(e) => setAddBayName(e.target.value)} placeholder="e.g. Bay 5" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button onClick={() => void submitAddBay()} disabled={adding || !addLocationId || addBayName.trim() === ""}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 mr-2" aria-hidden="true" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bed, BedDouble, Brush, DoorOpen, RefreshCcw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatCard, EmptyState, LoadingState } from "@/components/page-shell";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Status is shown with a label and a coloured edge, never colour alone.
const STATUS: Record<string, { label: string; edge: string; dot: string }> = {
  Available: { label: "Available", edge: "border-l-emerald-500", dot: "bg-emerald-500" },
  Occupied: { label: "Occupied", edge: "border-l-primary", dot: "bg-primary" },
  Dirty: { label: "Needs cleaning", edge: "border-l-amber-500", dot: "bg-amber-500" },
};

export default function RoomRackPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchRack = async () => {
    setLoading(true);
    try {
      const res = await api("/api/hotel/room-rack");
      const data = await res.json();
      setRooms(data.data || []);
    } catch {
      toast({ title: "Couldn't load the room rack", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRack(); }, []);

  const count = (s: string) => rooms.filter((r) => r.status === s).length;
  const pct = (n: number) => (rooms.length ? `${Math.round((n / rooms.length) * 100)}% of rooms` : undefined);
  const shown = filter ? rooms.filter((r) => r.status === filter) : rooms;

  const filters = [
    { key: null, label: `All (${rooms.length})` },
    ...Object.entries(STATUS).map(([k, v]) => ({ key: k, label: `${v.label} (${count(k)})` })),
  ];

  return (
    <DashboardLayout title="Room Rack">
      <div className="space-y-5">
        <PageHeader
          title="Room Rack"
          description="Live occupancy and housekeeping status."
          actions={<>
            <Button variant="outline" onClick={() => void fetchRack()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button asChild><Link href="/front-office/reservations/new">New reservation</Link></Button>
          </>}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Rooms" value={rooms.length} icon={<Bed />} />
          <StatCard label="Available" value={count("Available")} hint={pct(count("Available"))} icon={<DoorOpen />} />
          <StatCard label="Occupied" value={count("Occupied")} hint={pct(count("Occupied"))} icon={<BedDouble />} />
          <StatCard label="Needs cleaning" value={count("Dirty")} hint={pct(count("Dirty"))} icon={<Brush />} />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b p-2" role="tablist" aria-label="Filter rooms">
            {filters.map((f) => (
              <Button key={f.label} size="sm" variant={filter === f.key ? "secondary" : "ghost"} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>

          {loading && !rooms.length ? <LoadingState /> : rooms.length === 0 ? (
            <EmptyState title="No rooms yet" description="Set up your room inventory to use the rack."
              action={<Button size="sm" asChild><Link href="/front-office/rooms">Set up rooms</Link></Button>} />
          ) : shown.length === 0 ? <EmptyState title="No rooms with this status" /> : (
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {shown.map((room) => {
                const st = STATUS[room.status] || { label: room.status, edge: "border-l-muted-foreground", dot: "bg-muted-foreground" };
                return (
                  <div key={room.id} className={cn("flex flex-col gap-2 rounded-md border border-l-4 bg-card p-3", st.edge)}>
                    <div>
                      <p className="text-lg font-semibold leading-none tabular-nums">{room.room_number}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{room.type_name || "—"}</p>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs">
                      <span className={cn("h-2 w-2 rounded-full", st.dot)} aria-hidden="true" /> {st.label}
                    </p>
                    {room.status === "Available" && (
                      <Button size="sm" variant="outline" className="h-7" asChild>
                        <Link href={`/front-office/reservations/new?room_id=${room.id}`}>Check in</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

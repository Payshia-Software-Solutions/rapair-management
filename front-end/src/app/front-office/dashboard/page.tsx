"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { LayoutDashboard, Loader2, Bed, User, History, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function RoomRackPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRack = async () => {
    setLoading(true);
    try {
      const res = await api("/api/hotel/room-rack");
      const data = await res.json();
      setRooms(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load room rack", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRack(); }, []);

  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'Available').length,
    occupied: rooms.filter(r => r.status === 'Occupied').length,
    dirty: rooms.filter(r => r.status === 'Dirty').length,
  };

  return (
    <DashboardLayout title="Room Rack">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-primary" />
              Room Rack
            </h1>
            <p className="text-muted-foreground">Live occupancy and status overview</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRack} disabled={loading} className="gap-2">
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Rooms", val: stats.total, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
            { label: "Available", val: stats.available, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
            { label: "Occupied", val: stats.occupied, color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
            { label: "Dirty", val: stats.dirty, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold">{s.val}</span>
                  <Badge variant="secondary" className={cn("text-[10px] h-4", s.color)}>
                    {s.total > 0 ? Math.round((s.val / stats.total) * 100) : 0}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {rooms.map((room) => (
              <Card 
                key={room.id} 
                className={cn(
                  "relative overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer",
                  room.status === 'Available' ? "border-emerald-100 bg-emerald-50/30 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/5" :
                  room.status === 'Occupied' ? "border-blue-100 bg-blue-50/30 hover:border-blue-300 dark:border-blue-500/20 dark:bg-blue-500/5" :
                  room.status === 'Dirty' ? "border-amber-100 bg-amber-50/30 hover:border-amber-300 dark:border-amber-500/20 dark:bg-amber-500/5" :
                  "border-slate-100 bg-slate-50/30 hover:border-slate-300 dark:border-slate-500/20 dark:bg-slate-500/5"
                )}
              >
                <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                  <div className={cn(
                    "p-2 rounded-xl",
                    room.status === 'Available' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" :
                    room.status === 'Occupied' ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20" :
                    room.status === 'Dirty' ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20" :
                    "bg-slate-100 text-slate-600 dark:bg-slate-500/20"
                  )}>
                    <Bed className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-black tracking-tighter leading-none">{room.room_number}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold truncate px-1">{room.type_name}</div>
                  </div>
                  
                  <div className="pt-1">
                    {room.status === 'Available' ? (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 font-bold uppercase tracking-tight" asChild>
                        <Link href={`/front-office/reservations/new?room_id=${room.id}`}>Check In</Link>
                      </Button>
                    ) : room.status === 'Occupied' ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] uppercase font-bold">Occupied</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase font-bold">{room.status}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {rooms.length === 0 && !loading && (
          <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
            <Bed className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold">No Rooms Found</h3>
            <p className="text-sm text-muted-foreground mb-6">Setup your room inventory to start managing the rack.</p>
            <Button asChild>
              <Link href="/front-office/rooms">Setup Rooms</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

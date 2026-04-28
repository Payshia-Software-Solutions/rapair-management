"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Loader2,
  Search,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { 
  format, 
  addDays, 
  startOfDay, 
  isSameDay, 
  isWithinInterval, 
  eachDayOfInterval,
  subDays,
  isAfter,
  isBefore,
  differenceInDays
} from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Mail, Bed, Clock, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export default function HotelCalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [viewDays, setViewDays] = useState(14); // 14-day view
  const [selectedRes, setSelectedRes] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, resRes] = await Promise.all([
        api("/api/hotel/rooms"),
        api("/api/hotel/reservations")
      ]);
      const rData = await rRes.json();
      const resData = await resRes.json();
      setRooms(rData.data || []);
      setReservations(resData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await api(`/api/hotel/check-in/${id}`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Success", description: "Guest checked in" });
        loadData();
        setSelectedRes(null);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to check in", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await api(`/api/hotel/check-out/${id}`, { 
        method: "POST",
        body: JSON.stringify({ tax_total: 0 }) 
      });
      if (res.ok) {
        toast({ title: "Success", description: "Guest checked out and invoice generated" });
        loadData();
        setSelectedRes(null);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to check out", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startDate,
      end: addDays(startDate, viewDays - 1)
    });
  }, [startDate, viewDays]);

  const getReservationForRoomAndDay = (roomId: number, day: Date) => {
    return reservations.find(res => {
      if (res.room_id !== roomId) return false;
      const start = startOfDay(new Date(res.check_in));
      const end = startOfDay(new Date(res.check_out));
      return (isSameDay(day, start) || (isAfter(day, start) && isBefore(day, end)));
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Hotel Calendar</h2>
            <p className="text-muted-foreground">Visual room availability and reservation timeline.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md overflow-hidden bg-background shadow-sm">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-none border-r hover:bg-muted"
                onClick={() => setStartDate(subDays(startDate, 7))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-1.5 text-sm font-semibold min-w-[150px] text-center bg-muted/10">
                {format(startDate, "MMM d")} - {format(days[days.length-1], "MMM d, yyyy")}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-none border-l hover:bg-muted"
                onClick={() => setStartDate(addDays(startDate, 7))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => router.push("/front-office/reservations/new")} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Check-in
            </Button>
          </div>
        </div>

        <TooltipProvider>
          <Card className="overflow-hidden border shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                {/* Header row with dates */}
                <div className="flex border-b bg-muted/30">
                  <div className="w-56 shrink-0 p-4 font-bold border-r sticky left-0 bg-muted/40 z-20 backdrop-blur-sm">
                    Room / Date
                  </div>
                  {days.map((day, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex-1 min-w-[70px] p-2 text-center border-r last:border-r-0 transition-colors",
                        isSameDay(day, new Date()) ? "bg-primary/10 text-primary font-bold shadow-inner" : ""
                      )}
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider opacity-60 mb-0.5">{format(day, "EEE")}</div>
                      <div className="text-sm">{format(day, "d")}</div>
                    </div>
                  ))}
                </div>

                {/* Room rows */}
                {rooms.map((room) => (
                  <div key={room.id} className="flex border-b hover:bg-muted/5 transition-colors group">
                    <div className="w-56 shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex flex-col gap-1 shadow-sm group-hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Room {room.room_number}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none uppercase tracking-tighter">
                          {room.room_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          room.status === 'Available' ? "bg-emerald-500" :
                          room.status === 'Occupied' ? "bg-amber-500" : "bg-slate-400"
                        )}></div>
                        {room.status}
                      </div>
                    </div>
                    
                    <div className="flex flex-1 relative h-16">
                      {days.map((day, dIdx) => {
                        const res = getReservationForRoomAndDay(room.id, day);
                        const isArrival = res && isSameDay(new Date(res.check_in), day);
                        
                        return (
                          <div 
                            key={dIdx} 
                            className={cn(
                              "flex-1 min-w-[70px] border-r last:border-r-0 h-full relative",
                              isSameDay(day, new Date()) ? "bg-primary/[0.03]" : ""
                            )}
                          >
                            {res && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "absolute inset-y-2.5 left-0 right-[-1px] z-10 px-1",
                                      isArrival ? "ml-2" : ""
                                    )}
                                  >
                                    <div 
                                      className={cn(
                                        "h-full rounded-md flex items-center px-3 text-[11px] font-bold text-white shadow-md overflow-hidden truncate whitespace-nowrap cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all",
                                        res.status === 'CheckedIn' ? "bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-400" : 
                                        res.status === 'Confirmed' ? "bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400" : 
                                        "bg-gradient-to-r from-slate-500 to-slate-600 border-slate-400"
                                      )}
                                      onClick={() => setSelectedRes(res)}
                                    >
                                      {isArrival ? (
                                        <div className="flex items-center gap-1.5">
                                          <User className="w-3 h-3 opacity-80" />
                                          <span>{res.customer_name}</span>
                                        </div>
                                      ) : ""}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="p-3 bg-popover border shadow-xl animate-in fade-in zoom-in-95 duration-200">
                                  <div className="space-y-2 min-w-[180px]">
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="font-bold text-sm">{res.customer_name}</span>
                                      <Badge className={cn(
                                        "text-[10px] h-5",
                                        res.status === 'CheckedIn' ? "bg-emerald-500" : "bg-blue-500"
                                      )}>
                                        {res.status}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <CalendarIcon className="w-3 h-3" />
                                        {format(new Date(res.check_in), "MMM d")} - {format(new Date(res.check_out), "MMM d")}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Bed className="w-3 h-3" />
                                        Room {res.room_number} ({res.room_type})
                                      </div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TooltipProvider>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground bg-muted/20 p-5 rounded-xl border border-dashed">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm"></div>
            <span className="font-medium">Confirmed / Pending</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm"></div>
            <span className="font-medium">In House / Checked In</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-gradient-to-r from-slate-500 to-slate-600 shadow-sm"></div>
            <span className="font-medium">Checked Out / Other</span>
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedRes} onOpenChange={(o) => !o && setSelectedRes(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
            {selectedRes && (
              <>
                <div className={cn(
                  "p-6 text-white",
                  selectedRes.status === 'CheckedIn' ? "bg-emerald-600" : "bg-blue-600"
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
                      {selectedRes.reservation_no}
                    </Badge>
                    <div className="text-right">
                      <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Status</p>
                      <p className="font-bold">{selectedRes.status}</p>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{selectedRes.customer_name}</h2>
                  <div className="flex items-center gap-4 text-sm text-white/80">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedRes.customer_phone || "No phone"}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 bg-background">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-muted/40 border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Check-In</p>
                      <p className="font-bold text-sm">{format(new Date(selectedRes.check_in), "EEE, MMM d, yyyy")}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Check-Out</p>
                      <p className="font-bold text-sm">{format(new Date(selectedRes.check_out), "EEE, MMM d, yyyy")}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Bed className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">Room {selectedRes.room_number}</p>
                          <p className="text-xs text-muted-foreground">{selectedRes.room_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Stay Duration</p>
                        <p className="font-bold">{differenceInDays(new Date(selectedRes.check_out), new Date(selectedRes.check_in))} Night(s)</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">Occupancy</p>
                          <p className="text-xs text-muted-foreground">{selectedRes.adults} Adults, {selectedRes.children} Children</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Charge</p>
                      <p className="text-xl font-black text-primary">LKR {Number(selectedRes.total_amount).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className="bg-white border-primary/20 text-primary">
                      VAT Included
                    </Badge>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl" asChild>
                      <Link href={`/front-office/reservations/${selectedRes.id}`}>
                        Open Full Details
                      </Link>
                    </Button>
                    
                    {selectedRes.status === 'Confirmed' && (
                      <Button 
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" 
                        onClick={() => handleCheckIn(selectedRes.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Check-In Guest
                      </Button>
                    )}

                    {selectedRes.status === 'CheckedIn' && (
                      <Button 
                        className="flex-1 rounded-xl" 
                        onClick={() => handleCheckOut(selectedRes.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                        Check-Out
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

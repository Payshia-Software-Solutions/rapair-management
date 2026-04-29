"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Loader2,
  Plus,
  LayoutGrid,
  Clock,
  User,
  Phone,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { 
  format, 
  addDays, 
  startOfDay, 
  isSameDay, 
  eachDayOfInterval,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BanquetCalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [halls, setHalls] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [viewDays, setViewDays] = useState(30); 
  const [viewType, setViewType] = useState<'timeline' | 'grid'>('grid');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const viewOptions = [
    { label: "Week", days: 7 },
    { label: "2 Weeks", days: 14 },
    { label: "Month", days: 30 }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hRes, bRes] = await Promise.all([
        api("/api/banquet/halls"),
        api("/api/banquet/bookings")
      ]);
      const hData = await hRes.json();
      const bData = await bRes.json();
      setHalls(hData.data || []);
      setBookings(bData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_method: "Cash",
    payment_amount: 0,
    payment_reference: "",
    payment_notes: ""
  });

  const handleGenerateInvoice = (booking: any) => {
    const balance = Number(booking.total_amount) - Number(booking.advance_paid);
    setPaymentData({
      payment_method: "Cash",
      payment_amount: balance > 0 ? balance : 0,
      payment_reference: "",
      payment_notes: "Final payment at invoicing"
    });
    setIsPaymentDialogOpen(true);
  };

  const confirmInvoice = async () => {
    if (!selectedBooking) return;
    setActionLoading(true);
    try {
      const res = await api(`/api/banquet/generate_invoice/${selectedBooking.id}`, { 
        method: "POST",
        body: JSON.stringify(paymentData)
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Invoice generated and payments recorded" });
        setIsPaymentDialogOpen(false);
        router.push(`/sales/invoices/${data.data.invoice_id}`);
      } else {
        toast({ title: "Error", description: data.error || "Invoicing failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error during invoicing", variant: "destructive" });
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

  const getBookingsForHallAndDay = (hallId: number, day: Date) => {
    return bookings.filter(b => {
      return b.hall_id === hallId && isSameDay(new Date(b.booking_date), day);
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
            <h2 className="text-2xl font-bold tracking-tight">Banquet Calendar</h2>
            <p className="text-muted-foreground">Visualize hall availability and event schedule.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-muted/20 p-1 rounded-lg border mr-2">
              {viewOptions.map((opt) => (
                <Button
                  key={opt.days}
                  variant={viewDays === opt.days ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs font-bold px-3 rounded-md"
                  onClick={() => setViewDays(opt.days)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center bg-muted/20 p-1 rounded-lg border mr-2">
               <Button
                  variant={viewType === 'timeline' ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs font-bold px-3 rounded-md"
                  onClick={() => setViewType('timeline')}
               >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                  Timeline
               </Button>
               <Button
                  variant={viewType === 'grid' ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs font-bold px-3 rounded-md"
                  onClick={() => {
                    setViewType('grid');
                    setStartDate(startOfMonth(startDate));
                    setViewDays(30);
                  }}
               >
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  Calendar
               </Button>
            </div>

            <div className="flex items-center border rounded-md overflow-hidden bg-background shadow-sm">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-none border-r hover:bg-muted"
                onClick={() => {
                  if (viewType === 'grid') {
                    setStartDate(subMonths(startDate, 1));
                  } else {
                    setStartDate(subDays(startDate, viewDays === 30 ? 30 : 7));
                  }
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-1.5 text-sm font-semibold min-w-[150px] text-center bg-muted/10">
                {viewType === 'grid' ? format(startDate, "MMMM yyyy") : `${format(startDate, "MMM d")} - ${format(days[days.length-1], "MMM d, yyyy")}`}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-none border-l hover:bg-muted"
                onClick={() => {
                  if (viewType === 'grid') {
                    setStartDate(addMonths(startDate, 1));
                  } else {
                    setStartDate(addDays(startDate, viewDays === 30 ? 30 : 7));
                  }
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => router.push("/banquet/bookings/new")} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        <TooltipProvider>
          {viewType === 'timeline' ? (
            <Card className="overflow-hidden border shadow-sm">
              <div className="overflow-x-auto">
                <div style={{ minWidth: viewDays === 30 ? '2400px' : viewDays === 14 ? '1200px' : '900px' }}>
                  {/* Header row with dates */}
                  <div className="flex border-b bg-muted/30">
                    <div className="w-56 shrink-0 p-4 font-bold border-r sticky left-0 bg-muted/40 z-20 backdrop-blur-sm">
                      Hall / Date
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

                  {/* Hall rows */}
                  {halls.map((hall) => (
                    <div key={hall.id} className="flex border-b hover:bg-muted/5 transition-colors group">
                      <div className="w-56 shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex flex-col gap-1 shadow-sm group-hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{hall.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <LayoutGrid className="w-3 h-3" />
                          {hall.capacity} Pax
                        </div>
                      </div>
                      
                      <div className="flex flex-1 relative min-h-[80px]">
                        {days.map((day, dIdx) => {
                          const dayBookings = getBookingsForHallAndDay(hall.id, day);
                          
                          return (
                            <div 
                              key={dIdx} 
                              className={cn(
                                "flex-1 min-w-[70px] border-r last:border-r-0 h-full relative p-1 flex flex-col gap-1",
                                isSameDay(day, new Date()) ? "bg-primary/[0.03]" : ""
                              )}
                            >
                              {dayBookings.map((b) => (
                                <Tooltip key={b.id}>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className={cn(
                                        "h-8 rounded-md flex items-center px-2 text-[10px] font-bold text-white shadow-sm overflow-hidden truncate whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all",
                                        b.status === 'Invoiced' ? "bg-emerald-500 border-emerald-400" : 
                                        b.status === 'Confirmed' ? "bg-blue-500 border-blue-400" : 
                                        "bg-slate-500 border-slate-400"
                                      )}
                                      onClick={() => setSelectedBooking(b)}
                                    >
                                      <span className="truncate">{b.session[0]}: {b.customer_name}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="p-3 bg-popover border shadow-xl">
                                    <div className="space-y-2 min-w-[180px]">
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="font-bold text-sm">{b.customer_name}</span>
                                        <Badge className="text-[10px]">{b.status}</Badge>
                                      </div>
                                      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="w-3 h-3" />
                                          {b.session} Session
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <LayoutGrid className="w-3 h-3" />
                                          {b.hall_name}
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 bg-muted/30 border-b">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-4 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[600px]">
                {(() => {
                  const start = startOfWeek(startOfMonth(startDate));
                  const end = endOfWeek(endOfMonth(startDate));
                  const calendarDays = eachDayOfInterval({ start, end });
                  
                  return calendarDays.map((day, idx) => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, startDate);
                    const dayBookings = bookings.filter(b => isSameDay(new Date(b.booking_date), day));
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "min-h-[120px] p-2 border-r border-b last:border-r-0 relative group transition-colors hover:bg-muted/5",
                          !isCurrentMonth ? "bg-muted/10 opacity-40" : "",
                          isToday ? "bg-primary/[0.03]" : ""
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold mb-2 transition-colors",
                          isToday ? "bg-primary text-white shadow-md scale-110" : "text-muted-foreground group-hover:text-primary"
                        )}>
                          {format(day, "d")}
                        </div>
                        
                        <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                          {dayBookings.map(b => (
                             <Tooltip key={b.id}>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "px-2 py-1 rounded-md text-[9px] font-bold text-white shadow-sm cursor-pointer truncate",
                                      b.status === 'Invoiced' ? "bg-emerald-500" : 
                                      b.status === 'Confirmed' ? "bg-blue-500" : 
                                      "bg-slate-500"
                                    )}
                                    onClick={() => setSelectedBooking(b)}
                                  >
                                    {b.session[0]}: {b.customer_name}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                   <div className="text-xs">
                                      <p className="font-bold">{b.customer_name}</p>
                                      <p className="opacity-70">{b.hall_name} • {b.session}</p>
                                   </div>
                                </TooltipContent>
                             </Tooltip>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          )}
        </TooltipProvider>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground bg-muted/20 p-5 rounded-xl border border-dashed">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-blue-500"></div>
            <span className="font-medium">Confirmed Booking</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-md bg-emerald-500"></div>
            <span className="font-medium">Invoiced / Completed</span>
          </div>
          <div className="flex items-center gap-2.5">
             <span className="opacity-50 italic">M: Morning, E: Evening, F: Full Day</span>
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
            {selectedBooking && (
              <>
                <div className={cn(
                  "p-6 text-white",
                  selectedBooking.status === 'Invoiced' ? "bg-emerald-600" : "bg-blue-600"
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                      {selectedBooking.booking_no}
                    </Badge>
                    <div className="text-right">
                      <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Status</p>
                      <p className="font-bold">{selectedBooking.status}</p>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{selectedBooking.customer_name}</h2>
                  <div className="flex items-center gap-4 text-sm text-white/80">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedBooking.customer_phone || "No phone"}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 bg-background">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-muted/40 border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Date</p>
                      <p className="font-bold text-sm">{format(new Date(selectedBooking.booking_date), "EEE, MMM d, yyyy")}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Session</p>
                      <p className="font-bold text-sm">{selectedBooking.session}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">{selectedBooking.hall_name}</p>
                          <p className="text-xs text-muted-foreground">Event Venue</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-black text-primary">LKR {Number(selectedBooking.total_amount).toLocaleString()}</p>
                    </div>
                    <div className="text-right text-xs">
                       <p className="text-muted-foreground">Advance Paid</p>
                       <p className="font-bold text-emerald-600">LKR {Number(selectedBooking.advance_paid).toLocaleString()}</p>
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl" asChild>
                      <Link href={`/banquet/bookings/${selectedBooking.id}`}>
                        Open Details
                      </Link>
                    </Button>
                    
                    {selectedBooking.status === 'Confirmed' && (
                      <Button 
                        className="flex-1 rounded-xl" 
                        onClick={() => handleGenerateInvoice(selectedBooking)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
                        Generate Invoice
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Handling Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Handle Event Payment</DialogTitle>
              <DialogDescription>Record final payments while generating the invoice.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                   <span>Remaining Balance</span>
                   <span className="font-bold text-primary">LKR {(Number(selectedBooking?.total_amount || 0) - Number(selectedBooking?.advance_paid || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                   <span>Advance Already Paid</span>
                   <span className="text-emerald-600">LKR {Number(selectedBooking?.advance_paid || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select 
                  value={paymentData.payment_method} 
                  onValueChange={v => setPaymentData({...paymentData, payment_method: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Credit/Debit Card</SelectItem>
                    <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount Being Paid Now</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">LKR</span>
                  <Input 
                    type="number" 
                    className="pl-12"
                    value={paymentData.payment_amount}
                    onChange={e => setPaymentData({...paymentData, payment_amount: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reference / Auth Code</Label>
                <Input 
                  placeholder="e.g. Card Ref, Transfer ID"
                  value={paymentData.payment_reference}
                  onChange={e => setPaymentData({...paymentData, payment_reference: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <textarea 
                  className="w-full min-h-[80px] p-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Any extra details about this payment..."
                  value={paymentData.payment_notes}
                  onChange={e => setPaymentData({...paymentData, payment_notes: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2">
              <Button 
                onClick={confirmInvoice} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 font-bold"
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Receipt className="w-4 h-4 mr-2" />}
                Confirm Invoice & Payment
              </Button>
              <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)} className="w-full">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

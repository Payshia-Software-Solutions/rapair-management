"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ClipboardList, Loader2, Receipt, User, Calendar, Clock, MoreVertical, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function BanquetBookingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await api("/api/banquet/bookings");
      const data = await response.json();
      setBookings(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBookings(); }, []);

  const handleGenerateInvoice = async (id: number) => {
    if (!confirm("Generate invoice for this booking?")) return;
    setProcessingId(id);
    try {
      const response = await api(`/api/banquet/generate_invoice/${id}`, { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Invoiced", description: "Invoice generated successfully" });
        router.push(`/sales/invoices/${data.data.invoice_id}`);
      } else {
        throw new Error(data.message || "Invoicing failed");
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    setProcessingId(id);
    try {
      const response = await api(`/api/banquet/cancel_booking/${id}`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      if (response.ok) {
        toast({ title: "Cancelled", description: "Booking has been cancelled" });
        loadBookings();
      }
    } catch (err) {
      toast({ title: "Error", description: "Cancellation failed", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout title="Banquet Bookings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Event Ledger
            </h1>
            <p className="text-muted-foreground">Track banquet reservations and status</p>
          </div>
          <Button onClick={() => router.push("/banquet/bookings/new")}>New Booking</Button>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Customer</TableHead>
                  <TableHead>Venue & Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total (LKR)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6 text-muted-foreground" /></TableCell></TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No bookings found</TableCell></TableRow>
                ) : bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {b.customer_name?.[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{b.customer_name}</span>
                          <span className="text-[10px] text-muted-foreground">{b.customer_phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{b.hall_name}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(b.booking_date).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        <Clock className="w-3 h-3 mr-1" /> {b.session}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-bold uppercase",
                        b.status === 'Confirmed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        b.status === 'Invoiced' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        b.status === 'Cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      )}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Number(b.total_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {b.status === 'Confirmed' && (
                          <Button 
                            size="sm" 
                            className="h-8 gap-2"
                            onClick={() => handleGenerateInvoice(b.id)}
                            disabled={processingId === b.id}
                          >
                            {processingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
                            Invoice
                          </Button>
                        )}
                        {b.invoice_id && (
                           <Button size="sm" variant="outline" className="h-8 gap-2" asChild>
                              <Link href={`/sales/invoices/${b.invoice_id}`}>
                                <Receipt className="w-3 h-3" />
                                View
                              </Link>
                           </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/banquet/bookings/${b.id}`}>View Details</Link>
                            </DropdownMenuItem>
                            {b.status !== 'Cancelled' && b.status !== 'Invoiced' && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleCancel(b.id)}>
                                <XCircle className="w-4 h-4 mr-2" /> Cancel Booking
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

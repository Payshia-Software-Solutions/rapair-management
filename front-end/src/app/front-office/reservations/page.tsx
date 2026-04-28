"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ClipboardList, Loader2, LogOut, Receipt, History, User, XCircle, AlertCircle, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function ReservationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [res, setRes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Cancellation State
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingRes, setCancellingRes] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const loadRes = async () => {
    setLoading(true);
    try {
      const response = await api("/api/hotel/reservations");
      const data = await response.json();
      setRes(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load reservations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRes(); }, []);

  const handleCheckout = async (id: number) => {
    if (!confirm("Confirm check-out and generate invoice?")) return;
    setProcessingId(id);
    try {
      const response = await api(`/api/hotel/check-out/${id}`, {
        method: "POST",
        body: JSON.stringify({ tax_total: 0 }) // Placeholder for tax
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Checked Out", description: "Invoice generated successfully" });
        router.push(`/sales/invoices/${data.data.invoice_id}`);
      } else {
        throw new Error(data.message || "Checkout failed");
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelReservation = async () => {
    if (!cancellingRes || !cancelReason.trim()) {
        toast({ title: "Reason Required", description: "Please provide a reason for cancellation", variant: "destructive" });
        return;
    }

    setIsCancelling(true);
    try {
        const response = await api(`/api/hotel/cancel_reservation/${cancellingRes.id}`, {
            method: "POST",
            body: JSON.stringify({ reason: cancelReason })
        });
        if (response.ok) {
            toast({ title: "Cancelled", description: "Reservation has been cancelled." });
            setIsCancelDialogOpen(false);
            setCancelReason("");
            setCancellingRes(null);
            await loadRes();
        } else {
            const data = await response.json();
            throw new Error(data.message || "Cancellation failed");
        }
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
        setIsCancelling(false);
    }
  };

  return (
    <DashboardLayout title="Reservations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Reservation Ledger
            </h1>
            <p className="text-muted-foreground">Manage guest stays and billing</p>
          </div>
          <Button onClick={() => router.push("/front-office/reservations/new")}>New Check-In</Button>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total (LKR)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6 text-muted-foreground" /></TableCell></TableRow>
                ) : res.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No reservations found</TableCell></TableRow>
                ) : res.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {r.customer_name?.[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{r.customer_name}</span>
                          <span className="text-[10px] text-muted-foreground">{r.customer_phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary">Room {r.room_number}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{r.room_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-[11px]">
                        <span className="font-medium">In: {new Date(r.check_in).toLocaleDateString()}</span>
                        <span className="text-muted-foreground font-medium">Out: {new Date(r.check_out).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-bold uppercase",
                        r.status === 'CheckedIn' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        r.status === 'CheckedOut' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      )}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Number(r.total_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'CheckedIn' ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 gap-2 border-primary/20 hover:bg-primary hover:text-white"
                          onClick={() => handleCheckout(r.id)}
                          disabled={processingId === r.id}
                        >
                          {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                          Check Out
                        </Button>
                      ) : r.invoice_id ? (
                        <Button size="sm" variant="ghost" className="h-8 gap-2" asChild>
                          <Link href={`/sales/invoices/${r.invoice_id}`}>
                            <Receipt className="w-3 h-3" />
                            View Invoice
                          </Link>
                        </Button>
                      ) : null}
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

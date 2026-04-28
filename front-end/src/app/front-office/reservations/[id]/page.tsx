"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  ArrowLeft, 
  Printer, 
  Calendar as CalendarIcon, 
  User, 
  Phone, 
  Mail, 
  Bed, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Trash2,
  Plus,
  ArrowRightLeft,
  Settings2,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";

export default function SingleReservationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<any | null>(null);
  const [extraItems, setExtraItems] = useState<any[]>([]);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ item_id: "", description: "", quantity: "1", unit_price: "" });
  const [editForm, setEditForm] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    method: "Cash",
    amount: "0",
    notes: ""
  });

  useEffect(() => {
    if (params.id) {
      loadReservation(String(params.id));
      loadExtraItems(String(params.id));
    }
  }, [params.id]);

  const loadReservation = async (id: string) => {
    setLoading(true);
    try {
      const response = await api(`/api/hotel/reservation/${id}`);
      const data = await response.json();
      if (data.status === "success") {
        setRes(data.data);
        setEditForm(data.data);
      } else {
        toast({ title: "Error", description: data.message || "Failed to load reservation", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadExtraItems = async (id: string) => {
    try {
      const response = await api(`/api/hotel/items/${id}`);
      const data = await response.json();
      if (data.status === "success") setExtraItems(data.data || []);
    } catch (err) {}
  };

  const loadRooms = async () => {
    try {
      const res = await api("/api/hotel/rooms");
      const data = await res.json();
      setRooms(data.data || []);
    } catch (err) {}
  };

  const loadMasterItems = async (q: string = "") => {
    try {
      const res = await api(`/api/part/list?q=${q}`);
      const data = await res.json();
      setMasterItems(data.data || []);
    } catch (err) {}
  };

  const handleAddItem = async () => {
    setActionLoading(true);
    try {
      const resApi = await api(`/api/hotel/items/${params.id}`, {
        method: "POST",
        body: JSON.stringify(newItem)
      });
      if (resApi.ok) {
        toast({ title: "Success", description: "Item added" });
        setIsItemModalOpen(false);
        setNewItem({ item_id: "", description: "", quantity: "1", unit_price: "" });
        loadExtraItems(String(params.id));
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    try {
      const resApi = await api(`/api/hotel/remove-item/${itemId}`, { method: "DELETE" });
      if (resApi.ok) {
        toast({ title: "Success", description: "Item removed" });
        loadExtraItems(String(params.id));
      }
    } catch (err) {}
  };

  const handleUpdate = async () => {
    setActionLoading(true);
    try {
      const resApi = await api(`/api/hotel/update-reservation/${params.id}`, {
        method: "POST",
        body: JSON.stringify(editForm)
      });
      if (resApi.ok) {
        toast({ title: "Success", description: "Reservation updated" });
        setIsEditModalOpen(false);
        loadReservation(String(params.id));
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update reservation", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const resApi = await api(`/api/hotel/check-in/${params.id}`, { method: "POST" });
      if (resApi.ok) {
        toast({ title: "Success", description: "Guest checked in" });
        loadReservation(String(params.id));
      }
    } catch (err) {
      toast({ title: "Error", description: "Check-in failed", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      // 1. Generate Invoice
      const resApi = await api(`/api/hotel/check-out/${params.id}`, { 
        method: "POST",
        body: JSON.stringify({ tax_total: 0 }) 
      });
      const data = await resApi.json();
      
      if (resApi.ok) {
        // 2. Record Payment (if amount > 0)
        if (Number(paymentData.amount) > 0) {
          await api("/api/paymentreceipt/create", {
            method: "POST",
            body: JSON.stringify({
              invoice_id: data.data.invoice_id,
              invoice_no: data.data.invoice_no,
              customer_id: data.data.customer_id,
              customer_name: data.data.customer_name,
              location_id: data.data.location_id,
              amount: paymentData.amount,
              payment_method: paymentData.method,
              payment_date: new Date().toISOString().split('T')[0],
              notes: paymentData.notes || "Checkout Payment"
            })
          });
        }

        toast({ title: "Success", description: "Check-out and Payment recorded" });
        
        // Open invoice in new tab
        window.open(`/cms/invoices/${data.data.invoice_id}/print?autoprint=1`, '_blank');
        
        // Redirect current tab to dashboard
        router.push("/front-office/dashboard");
      }
    } catch (err) {
      toast({ title: "Error", description: "Check-out failed", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setIsCheckoutModalOpen(false);
    }
  };

  const extraTotal = extraItems.reduce((acc, item) => acc + Number(item.total_price), 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!res) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Reservation not found.</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const nights = differenceInDays(new Date(res.check_out), new Date(res.check_in)) || 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{res.reservation_no}</CardTitle>
                  <p className="text-xs text-muted-foreground">Created on {format(new Date(res.created_at || Date.now()), "PPP")}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={cn(
                    "px-3 py-1",
                    res.status === 'CheckedIn' ? "bg-emerald-500" : 
                    res.status === 'Confirmed' ? "bg-blue-500" : "bg-slate-500"
                  )}>
                    {res.status}
                  </Badge>
                  <Badge variant="outline" className="font-bold border-primary text-primary">
                    {res.meal_plan} Plan
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Guest</p>
                    <h3 className="text-lg font-bold">{res.customer_name}</h3>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        {res.customer_phone || "No phone"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" />
                        {res.customer_email || "No email"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Room Information</p>
                    <h3 className="text-lg font-bold">Room {res.room_number}</h3>
                    <p className="text-sm text-muted-foreground uppercase">{res.room_type}</p>
                    <Badge variant="secondary" className="mt-2">{res.adults} Adults, {res.children} Children</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/30 border border-dashed mb-8">
                  <div className="flex flex-col items-center justify-center p-4 border-r border-dashed">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Check-In</p>
                    <p className="text-lg font-black">{format(new Date(res.check_in), "EEE, MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">From 2:00 PM</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Check-Out</p>
                    <p className="text-lg font-black">{format(new Date(res.check_out), "EEE, MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">Before 12:00 PM</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-sm font-bold">Stay Charges</h4>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => {
                      loadMasterItems();
                      setIsItemModalOpen(true);
                    }}>
                      <Plus className="w-3 h-3" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Room Charge ({res.room_type} x {nights} Night(s))</span>
                      <span className="font-medium">LKR {Number(res.total_amount).toLocaleString()}</span>
                    </div>
                    
                    {extraItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-2 group">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.description}</span>
                          <span className="text-[10px] text-muted-foreground">Qty: {Number(item.quantity)} x LKR {Number(item.unit_price).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-emerald-600">+ LKR {Number(item.total_price).toLocaleString()}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between pt-4 border-t font-black text-xl text-primary">
                      <span>Total Amount</span>
                      <span>LKR {(Number(res.total_amount) + extraTotal).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm uppercase font-bold text-muted-foreground">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {res.status === 'Confirmed' && (
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl shadow-lg shadow-emerald-600/10 gap-2"
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Process Check-In
                  </Button>
                )}
                
                {res.status !== 'CheckedOut' && (
                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl gap-2"
                    onClick={() => {
                      loadRooms();
                      setIsEditModalOpen(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Settings2 className="w-4 h-4" />
                    Edit Stay / Switch Room
                  </Button>
                )}

                {res.status === 'CheckedIn' && (
                  <Button 
                    className="w-full h-11 rounded-xl shadow-lg shadow-primary/10 gap-2"
                    onClick={() => {
                      setPaymentData({
                        ...paymentData,
                        amount: String(Number(res.total_amount) + extraTotal)
                      });
                      setIsCheckoutModalOpen(true);
                    }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Generate Bill & Checkout
                  </Button>
                )}
                {res.invoice_id && (
                  <Button variant="outline" className="w-full h-11 rounded-xl gap-2" asChild>
                    <a href={`/cms/invoices/${res.invoice_id}/print?autoprint=1`} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4" />
                      View/Print Invoice
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Need Help?</p>
                <p className="text-[10px] text-muted-foreground">Contact front desk or system administrator for manual adjustments.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Item Modal */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Extra Item</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Master Item</Label>
                <SearchableSelect 
                  placeholder="Search products or services..."
                  options={masterItems.map(i => ({ 
                    value: i.id, 
                    label: `${i.part_name} (${i.sku || 'No SKU'}) - LKR ${Number(i.price).toLocaleString()}` 
                  }))}
                  onValueChange={(val) => {
                    const item = masterItems.find(i => String(i.id) === String(val));
                    if (item) {
                      setNewItem({
                        ...newItem,
                        item_id: String(item.id),
                        description: item.part_name,
                        unit_price: String(item.price)
                      });
                    }
                  }}
                  onSearch={loadMasterItems}
                />
                {newItem.description && (
                  <div className="p-2 bg-primary/5 rounded border text-xs text-primary font-medium">
                    Selected: {newItem.description}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number" 
                    value={newItem.quantity} 
                    onChange={e => setNewItem({...newItem, quantity: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (LKR)</Label>
                  <Input 
                    type="number" 
                    value={newItem.unit_price} 
                    onChange={e => setNewItem({...newItem, unit_price: e.target.value})} 
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddItem} disabled={actionLoading || !newItem.item_id}>
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add to Bill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Reservation Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Edit Stay Details</DialogTitle></DialogHeader>
            {editForm && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Assigned Room</Label>
                  <Select value={String(editForm.room_id)} onValueChange={v => setEditForm({...editForm, room_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map(room => (
                        <SelectItem key={room.id} value={String(room.id)}>
                          Room {room.room_number} ({room.type_name}) - {room.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic">Note: Switching rooms during a stay will update the room rack status.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Check-In Date</Label>
                    <Input type="date" value={editForm.check_in.split(' ')[0]} onChange={e => setEditForm({...editForm, check_in: e.target.value + ' 14:00:00'})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-Out Date</Label>
                    <Input type="date" value={editForm.check_out.split(' ')[0]} onChange={e => setEditForm({...editForm, check_out: e.target.value + ' 12:00:00'})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adults</Label>
                    <Input type="number" value={editForm.adults} onChange={e => setEditForm({...editForm, adults: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Children</Label>
                    <Input type="number" value={editForm.children} onChange={e => setEditForm({...editForm, children: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Meal Plan</Label>
                  <Select value={editForm.meal_plan} onValueChange={v => setEditForm({...editForm, meal_plan: v})}>
                    <SelectTrigger><SelectValue placeholder="Select Meal Plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RO">RO - Room Only</SelectItem>
                      <SelectItem value="BB">BB - Bed & Breakfast</SelectItem>
                      <SelectItem value="HB">HB - Half Board</SelectItem>
                      <SelectItem value="FB">FB - Full Board</SelectItem>
                      <SelectItem value="AI">AI - All Inclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Total Amount (LKR)</Label>
                  <Input type="number" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: e.target.value})} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Checkout & Payment Modal */}
        <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Checkout</DialogTitle>
              <DialogDescription>Generate final bill and record payment for guest {res.customer_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium">Total Balance Due</span>
                <span className="text-xl font-black">LKR {(Number(res.total_amount) + extraTotal).toLocaleString()}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid</Label>
                  <Input 
                    type="number" 
                    value={paymentData.amount} 
                    onChange={e => setPaymentData({...paymentData, amount: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Notes</Label>
                <Input 
                  placeholder="e.g. Paid via Visa ending in 1234" 
                  value={paymentData.notes}
                  onChange={e => setPaymentData({...paymentData, notes: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCheckoutModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCheckOut} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment & Checkout
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Helper for status colors
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

import Link from "next/link";

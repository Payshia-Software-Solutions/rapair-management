"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Loader2, 
  Calendar, 
  User, 
  LayoutGrid, 
  Receipt,
  ArrowLeft,
  Truck,
  Package,
  X,
  PlusCircle,
  Clock,
  Phone,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  SelectValue 
} from "@/components/ui/select";

export default function BanquetBookingDetailsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Assignment form
  const [assignForm, setAssignForm] = useState({
    resource_id: "",
    vendor_id: "",
    description: "",
    qty: 1,
    unit_cost: 0,
    unit_price: 0,
    notes: ""
  });

  // Staff form
  const [staffForm, setStaffForm] = useState({
    employee_id: "",
    role: "",
    notes: ""
  });

  // Invoicing state
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    payment_amount: 0,
    payment_method: "Cash",
    payment_notes: "Final payment for banquet",
    cheque: {
      cheque_no: "",
      bank_name: "",
      branch_name: "",
      cheque_date: format(new Date(), "yyyy-MM-dd"),
      payee_name: ""
    }
  });

  useEffect(() => {
    if (bookingId) {
      loadData();
    }
  }, [bookingId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, aRes, rRes, sRes, stRes, eRes] = await Promise.all([
        api(`/api/banquet/bookings/${bookingId}`),
        api(`/api/banquet/assignments?booking_id=${bookingId}`),
        api("/api/banquet/resources"),
        api("/api/suppliers"),
        api(`/api/banquet/staff?booking_id=${bookingId}`),
        api("/api/banquet/get_employees")
      ]);

      const bData = await bRes.json();
      const aData = await aRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      const stData = await stRes.json();
      const eData = await eRes.json();

      setBooking(bData.data);
      setAssignments(aData.data || []);
      setResources(rData.data || []);
      setSuppliers(sData.data || []);
      setStaff(stData.data || []);
      setEmployees(eData.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load booking details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!assignForm.description && !assignForm.resource_id) {
        toast({ title: "Validation", description: "Please select a resource or enter a description", variant: "destructive" });
        return;
    }
    setAssignmentLoading(true);
    try {
      const res = await api("/api/banquet/assignments", {
        method: "POST",
        body: JSON.stringify({ ...assignForm, booking_id: bookingId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Assigned successfully" });
        setAssignForm({ resource_id: "", vendor_id: "", description: "", qty: 1, unit_cost: 0, unit_price: 0, notes: "" });
        const aRes = await api(`/api/banquet/assignments?booking_id=${bookingId}`);
        const aData = await aRes.json();
        setAssignments(aData.data || []);
      }
    } catch (err) {
      toast({ title: "Error", description: "Assignment failed", variant: "destructive" });
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleCompleteInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const res = await api(`/api/banquet/generate_invoice/${bookingId}`, {
        method: "POST",
        body: JSON.stringify(invoiceForm)
      });
      const result = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Invoice generated successfully" });
        setIsInvoicing(false);
        loadData(); // Refresh page data
      } else {
        toast({ title: "Error", description: result.error || "Invoicing failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Request failed", variant: "destructive" });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffForm.employee_id) return toast({ title: "Error", description: "Please select an employee" });
    setAssignmentLoading(true);
    try {
      const res = await api("/api/banquet/staff", {
        method: "POST",
        body: JSON.stringify({
          booking_id: bookingId,
          ...staffForm
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Staff assigned" });
        setStaffForm({ employee_id: "", role: "", notes: "" });
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Request failed" });
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleRemoveStaff = async (id: number) => {
    if (!confirm("Remove this staff assignment?")) return;
    try {
      const res = await api(`/api/banquet/staff/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Staff removed" });
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Request failed" });
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    if (!confirm("Remove this assignment?")) return;
    try {
      const res = await api(`/api/banquet/assignments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssignments(assignments.filter(a => a.id !== id));
        toast({ title: "Removed", description: "Assignment removed" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Removal failed", variant: "destructive" });
    }
  };

  if (loading || !booking) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Booking: {booking.booking_no}</h2>
                <Badge variant={booking.status === 'Invoiced' ? "default" : "secondary"}>{booking.status}</Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{booking.customer_name} | {format(new Date(booking.booking_date), "EEE, MMM d, yyyy")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push(`/banquet/bookings/${bookingId}/edit`)}>
              Edit Details
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="border-none shadow-sm bg-muted/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Venue</p>
                      <p className="font-bold text-sm">{booking.hall_name}</p>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-muted/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Session</p>
                      <p className="font-bold text-sm">{booking.session}</p>
                    </div>
                  </CardContent>
               </Card>
            </div>

            {/* Assignments Section */}
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Resource & Vendor Assignments</CardTitle>
                <Badge variant="outline">{assignments.length} Assignments</Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Assignment Form */}
                <div className="bg-muted/30 p-4 rounded-2xl border border-dashed border-primary/20 space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-[10px] uppercase font-bold opacity-50">Select Service / Resource</Label>
                        <SearchableSelect 
                          options={resources.map(r => {
                            const provider = r.resource_type === 'External' 
                              ? (suppliers.find(s => String(s.id) === String(r.default_supplier_id))?.name || 'External') 
                              : 'Internal';
                            return { 
                              value: String(r.id), 
                              label: `${r.name} [${provider}] (Sell: LKR ${Number(r.selling_price || 0).toLocaleString()})` 
                            };
                          })}
                          value={assignForm.resource_id}
                          onValueChange={v => {
                            const r = resources.find(x => String(x.id) === v);
                            if (r) {
                              setAssignForm({
                                ...assignForm, 
                                resource_id: v, 
                                description: r.name, 
                                unit_cost: Number(r.base_price || 0),
                                unit_price: Number(r.selling_price || 0),
                                vendor_id: r.default_supplier_id ? String(r.default_supplier_id) : assignForm.vendor_id
                              });
                            }
                          }}
                          placeholder="Select Service / Resource..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold opacity-50">Qty</Label>
                          <Input type="number" value={assignForm.qty} onChange={e => setAssignForm({...assignForm, qty: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold opacity-50">Price</Label>
                          <Input type="number" value={assignForm.unit_price} onChange={e => setAssignForm({...assignForm, unit_price: Number(e.target.value)})} />
                        </div>
                      </div>
                   </div>

                   <Button className="w-full" onClick={handleAddAssignment} disabled={assignmentLoading}>
                      {assignmentLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                      Add Assignment
                   </Button>
                </div>

                {/* Assignment List */}
                <div className="space-y-3">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-4 rounded-xl border bg-background hover:border-primary/30 transition-colors shadow-sm group">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          a.resource_id ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {a.resource_id ? <Package size={18} /> : <Truck size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{a.description}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            <span>{a.qty} units</span>
                            {a.vendor_name && <span className="text-orange-600">• Vendor: {a.vendor_name}</span>}
                            {a.resource_name && <span className="text-blue-600">• Resource: {a.resource_name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-bold">LKR {(Number(a.qty) * Number(a.unit_price)).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground italic">Cost: LKR {(Number(a.qty) * Number(a.unit_cost)).toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <div className="text-center py-12 border border-dashed rounded-3xl bg-muted/5">
                       <p className="text-sm text-muted-foreground italic">No extra resources or vendors assigned yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden mt-6">
              <CardHeader className="bg-slate-50/50 border-b">
                 <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Staff Assignments</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest opacity-50">Event Execution Team</p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[9px] px-2">{staff.length} Assigned</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 {/* Add Staff Form */}
                 <div className="p-4 bg-muted/20 border-b grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2 space-y-1">
                       <Label className="text-[10px] uppercase font-bold opacity-50">Select Employee</Label>
                       <SearchableSelect 
                         options={employees.map(e => ({ value: String(e.id), label: `${e.name} (${e.code}) - ${e.designation}` }))}
                         value={staffForm.employee_id}
                         onValueChange={v => setStaffForm({...staffForm, employee_id: v})}
                         placeholder="Select Staff..."
                       />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] uppercase font-bold opacity-50">Role / Designation</Label>
                       <Input 
                         placeholder="e.g. Supervisor, Waiter..." 
                         value={staffForm.role}
                         onChange={e => setStaffForm({...staffForm, role: e.target.value})}
                       />
                    </div>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                      onClick={handleAddStaff}
                      disabled={assignmentLoading}
                    >
                       {assignmentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                       Assign
                    </Button>
                 </div>

                 {/* Staff List */}
                 <div className="divide-y divide-slate-100">
                    {staff.map(s => (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                             {s.employee_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{s.employee_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              <span className="text-blue-600">{s.role || 'Team Member'}</span>
                              <span>• {s.employee_code}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveStaff(s.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full hover:bg-destructive/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {staff.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground italic text-sm">
                        No staff assigned to this event yet.
                      </div>
                    )}
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Detail */}
          <div className="space-y-6">
             <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-70">Hall + Menu</span>
                    <span className="font-bold">LKR {Number(booking.total_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-70">Extra Resources</span>
                    <span className="font-bold text-blue-600">LKR {assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t space-y-1">
                     <div className="flex justify-between items-center text-xs opacity-70">
                       <span>Gross Revenue</span>
                       <span>LKR {(Number(booking.total_amount) + Number(booking.discount_amount || 0) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0)).toLocaleString()}</span>
                     </div>
                     {Number(booking.discount_amount) > 0 && (
                       <div className="flex justify-between items-center text-xs text-orange-600">
                         <span>Discount</span>
                         <span>- LKR {Number(booking.discount_amount).toLocaleString()}</span>
                       </div>
                     )}
                     <div className="flex justify-between items-center pt-1">
                       <span className="font-bold text-sm">Net Total Revenue</span>
                       <span className="text-lg font-black text-primary">LKR {(Number(booking.total_amount) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0)).toLocaleString()}</span>
                     </div>
                   </div>
                  <div className="pt-2 border-t flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Estimated Total Cost</span>
                    <span className="font-medium">LKR {(Number(booking.total_cost || 0) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_cost), 0)).toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="bg-primary/5 p-4 flex flex-col gap-2">
                   <div className="w-full flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Advance Collected</span>
                      <span className="text-emerald-600 font-bold">LKR {Number(booking.advance_paid).toLocaleString()}</span>
                   </div>
                    {booking.status !== 'Invoiced' && booking.status !== 'Cancelled' ? (
                       <Button 
                         className="w-full shadow-lg rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" 
                         onClick={() => {
                            const balance = (Number(booking.total_amount) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0)) - Number(booking.advance_paid);
                            setInvoiceForm({...invoiceForm, payment_amount: Math.max(0, balance)});
                            setIsInvoicing(true);
                         }}
                       >
                          Complete & Invoice
                       </Button>
                    ) : booking.status === 'Invoiced' && (
                       <Button 
                         className="w-full shadow-lg rounded-xl font-bold" 
                         variant="outline"
                         onClick={() => router.push(`/sales/invoices/${booking.invoice_id}`)}
                       >
                          View Invoice
                       </Button>
                    )}

                    <Button variant="ghost" className="w-full rounded-xl text-xs text-muted-foreground" onClick={() => router.push("/banquet/calendar")}>
                       View in Calendar
                    </Button>
                </CardFooter>
             </Card>

             <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Host Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{booking.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{booking.customer_email || 'No Email'}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <Phone size={14} />
                      </div>
                      <p className="text-sm">{booking.customer_phone || 'No Phone'}</p>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>

      {/* Invoicing Dialog */}
      <Dialog open={isInvoicing} onOpenChange={setIsInvoicing}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Booking & Invoice</DialogTitle>
            <DialogDescription>
              This will generate a formal invoice and record the final payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
              <div className="flex justify-between text-sm">
                <span>Event Total</span>
                <span className="font-bold">LKR {(Number(booking?.total_amount) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Advance Paid</span>
                <span className="font-bold">- LKR {Number(booking?.advance_paid).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-black border-t pt-2">
                <span>Balance Due</span>
                <span className="text-primary">LKR {((Number(booking?.total_amount) + assignments.reduce((sum, a) => sum + (a.qty * a.unit_price), 0)) - Number(booking?.advance_paid)).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select 
                    value={invoiceForm.payment_method} 
                    onValueChange={(v) => setInvoiceForm({...invoiceForm, payment_method: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card Payment</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Amount (LKR)</Label>
                  <Input 
                    type="number" 
                    value={invoiceForm.payment_amount} 
                    onChange={(e) => setInvoiceForm({...invoiceForm, payment_amount: Number(e.target.value)})}
                  />
                </div>
              </div>

              {invoiceForm.payment_method === 'Cheque' && (
                <div className="p-4 border rounded-xl bg-orange-50/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Cheque No</Label>
                      <Input 
                        value={invoiceForm.cheque.cheque_no} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, cheque: {...invoiceForm.cheque, cheque_no: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Cheque Date</Label>
                      <Input 
                        type="date" 
                        value={invoiceForm.cheque.cheque_date} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, cheque: {...invoiceForm.cheque, cheque_date: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">Bank & Branch</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        placeholder="Bank" 
                        value={invoiceForm.cheque.bank_name} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, cheque: {...invoiceForm.cheque, bank_name: e.target.value}})}
                      />
                      <Input 
                        placeholder="Branch" 
                        value={invoiceForm.cheque.branch_name} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, cheque: {...invoiceForm.cheque, branch_name: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input 
                  placeholder="Additional notes for payment..." 
                  value={invoiceForm.payment_notes} 
                  onChange={(e) => setInvoiceForm({...invoiceForm, payment_notes: e.target.value})}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoicing(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700" 
              onClick={handleCompleteInvoice}
              disabled={invoiceLoading}
            >
              {invoiceLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm & Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

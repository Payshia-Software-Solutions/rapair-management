"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, fetchCustomers } from "@/lib/api";
import { Calendar, User, ArrowRight, Loader2, LayoutGrid, PlusCircle, Trash2, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function BanquetBookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({
    resource_id: "",
    vendor_id: "",
    description: "",
    qty: 1,
    unit_cost: 0,
    unit_price: 0
  });

  const [form, setForm] = useState({
    customer_id: "",
    hall_id: searchParams.get("hall_id") || "",
    menu_id: "",
    pax_count: 0,
    booking_date: new Date().toISOString().split('T')[0],
    session: "FullDay",
    notes: "",
    total_amount: 0,
    discount_amount: 0,
    advance_paid: 0
  });

  useEffect(() => {
    void (async () => {
      try {
        const [cData, hRes, mRes, rRes, sRes] = await Promise.all([
          fetchCustomers(),
          api("/api/banquet/halls"),
          api("/api/banquet/menus?active=1"),
          api("/api/banquet/resources"),
          api("/api/supplier/list?type=banquet")
        ]);
        const hData = await hRes.json();
        const mData = await mRes.json();
        const rData = await rRes.json();
        const sData = await sRes.json();
        setCustomers(Array.isArray(cData) ? cData : (cData.data || []));
        setHalls(hData.data || []);
        setMenus(mData.data || []);
        setResources(rData.data || []);
        setSuppliers(sData.data || []);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load dependencies", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedHall = halls.find(h => String(h.id) === String(form.hall_id));
  const selectedMenu = menus.find(m => String(m.id) === String(form.menu_id));

  // Update total when hall, session, menu, pax, discount or assignments changes
  useEffect(() => {
    let gross = 0;
    if (selectedHall) {
      let multiplier = 1;
      if (form.session === 'Morning' || form.session === 'Evening') multiplier = 0.6;
      gross += Math.round(Number(selectedHall.price_per_session) * multiplier);
    }
    if (selectedMenu && form.pax_count > 0) {
      gross += Number(selectedMenu.price_per_pax) * Number(form.pax_count);
    }
    
    assignments.forEach(a => {
      gross += (Number(a.qty) * Number(a.unit_price));
    });

    setForm(prev => ({ ...prev, total_amount: gross - (form.discount_amount || 0) }));
  }, [selectedHall, selectedMenu, form.session, form.pax_count, assignments, form.discount_amount]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api("/api/banquet/bookings", {
        method: "POST",
        body: JSON.stringify({...form, assignments})
      });
      if (res.ok) {
        toast({ title: "Success", description: "Banquet booking created" });
        router.push("/banquet/bookings");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create booking", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const hallCharge = (selectedHall ? Number(selectedHall.price_per_session) * (form.session === 'FullDay' ? 1 : 0.6) : 0);
  const menuCharge = (selectedMenu && form.pax_count > 0 ? Number(selectedMenu.price_per_pax) * form.pax_count : 0);
  const assignmentsCharge = assignments.reduce((sum, a) => sum + (Number(a.qty) * Number(a.unit_price)), 0);

  const handleAddAssignment = () => {
    if (!assignForm.description) return toast({ title: "Required", description: "Please enter a description" });
    if (assignForm.qty <= 0) return toast({ title: "Required", description: "Quantity must be at least 1" });

    const newAssignment = {
      id: `temp_${Date.now()}`,
      ...assignForm
    };

    setAssignments([...assignments, newAssignment]);
    setAssignForm({ resource_id: "", vendor_id: "", description: "", qty: 1, unit_cost: 0, unit_price: 0 });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>Back</Button>
        <h1 className="text-2xl font-bold">New Banquet Booking</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Host Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Customer / Host</Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => router.push("/cms/customers")}>New Customer</Button>
                </div>
                <SearchableSelect
                  options={customers.map(c => ({ 
                    value: String(c.id), 
                    label: `${c.name} (${c.phone || 'No Phone'})`
                  }))}
                  value={form.customer_id}
                  onValueChange={v => setForm({...form, customer_id: v})}
                  placeholder="Select customer..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Event Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Venue / Hall</Label>
                <Select value={form.hall_id} onValueChange={v => setForm({...form, hall_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Hall" /></SelectTrigger>
                  <SelectContent>
                    {halls.map(h => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.capacity} Pax)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Input type="date" value={form.booking_date} onChange={e => setForm({...form, booking_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Time Session</Label>
                  <Select value={form.session} onValueChange={v => setForm({...form, session: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Morning Session</SelectItem>
                      <SelectItem value="Evening">Evening Session</SelectItem>
                      <SelectItem value="FullDay">Full Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Pax Count</Label>
                  <Input type="number" value={form.pax_count} onChange={e => setForm({...form, pax_count: Number(e.target.value)})} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Select Menu Plan</Label>
                  <Select value={form.menu_id} onValueChange={v => setForm({...form, menu_id: v})}>
                    <SelectTrigger><SelectValue placeholder="No Menu (Hall Only)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Menu (Hall Only)</SelectItem>
                      {menus.map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name} (LKR {Number(m.price_per_pax).toLocaleString()}/pax)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes / Special Requests</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="e.g. Wedding, Birthday, Corporate Meeting..." />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Resource & Vendor Assignments</CardTitle>
              <Badge variant="outline">{assignments.length} Assignments</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
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

                 <Button className="w-full" variant="secondary" onClick={handleAddAssignment}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Assignment
                 </Button>
              </div>

              <div className="space-y-3">
                {assignments.map(a => {
                  const r = resources.find(x => String(x.id) === String(a.resource_id));
                  return (
                    <div key={a.id} className="flex items-center justify-between p-4 rounded-xl border bg-background hover:border-primary/30 transition-colors shadow-sm group">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          r?.resource_type === 'External' ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary"
                        )}>
                          {r?.resource_type === 'External' ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm">{a.description}</span>
                            {r?.resource_type === 'External' ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200 uppercase px-1.5 py-0">Outsourced</Badge>
                                <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                                  ({suppliers.find(s => String(s.id) === String(a.vendor_id))?.name || 'No Vendor'})
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 uppercase px-1.5 py-0">Internal</Badge>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Qty: {a.qty}</span>
                            <span>Cost: {Number(a.unit_cost).toLocaleString()}</span>
                            <span>Price: <b className="text-foreground">{Number(a.unit_price).toLocaleString()}</b></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total</p>
                          <p className="font-bold text-emerald-600">LKR {(Number(a.qty) * Number(a.unit_price)).toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive opacity-50 group-hover:opacity-100 transition-opacity" onClick={() => {
                          setAssignments(assignments.filter(x => x.id !== a.id));
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {assignments.length === 0 && (
                  <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-sm">No resources or services assigned yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-white/80 text-xs uppercase tracking-widest">Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-70">Hall Charge</span>
                <span className="font-bold">LKR {hallCharge.toLocaleString()}</span>
              </div>
              {menuCharge > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-70">Menu Charge ({form.pax_count} Pax)</span>
                  <span className="font-bold">LKR {menuCharge.toLocaleString()}</span>
                </div>
              )}
              {assignmentsCharge > 0 && (
                <div className="flex justify-between items-center text-sm text-emerald-400">
                  <span className="opacity-70">Extras & Services ({assignments.length})</span>
                  <span className="font-bold">+ LKR {assignmentsCharge.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                <span className="opacity-70 font-bold">Gross Total</span>
                <span className="font-bold">LKR {(form.total_amount + (form.discount_amount || 0)).toLocaleString()}</span>
              </div>
              <div className="space-y-2 pt-2">
                 <Label className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Apply Discount</Label>
                 <Input 
                    type="number" 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-8" 
                    value={form.discount_amount} 
                    onChange={e => setForm({...form, discount_amount: Number(e.target.value)})} 
                 />
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                <span className="opacity-70 font-bold text-emerald-400">Net Amount</span>
                <span className="font-bold text-lg text-emerald-400">LKR {form.total_amount.toLocaleString()}</span>
              </div>
              <div className="space-y-2 pt-4 border-t border-white/10">
                 <Label className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Advance Payment Received</Label>
                 <Input 
                    type="number" 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30" 
                    value={form.advance_paid} 
                    onChange={e => setForm({...form, advance_paid: Number(e.target.value)})} 
                 />
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="text-[10px] uppercase opacity-50 font-bold mb-1 tracking-widest">Balance to be Paid</div>
                <div className="text-2xl font-bold text-white">
                  LKR {(form.total_amount - form.advance_paid).toLocaleString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !form.customer_id || !form.hall_id}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 font-bold text-lg"
              >
                {submitting ? <Loader2 className="animate-spin mr-2" /> : "Confirm Booking"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewBanquetBookingPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
        <BanquetBookingForm />
      </Suspense>
    </DashboardLayout>
  );
}

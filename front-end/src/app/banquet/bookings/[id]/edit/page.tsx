"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Loader2 } from "lucide-react";

function EditBanquetBookingForm() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id;
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    hall_id: "",
    menu_id: "",
    pax_count: 0,
    booking_date: "",
    session: "FullDay",
    notes: "",
    total_amount: 0,
    advance_paid: 0,
    discount_amount: 0,
    status: ""
  });

  useEffect(() => {
    if (!bookingId) return;
    
    void (async () => {
      try {
        const [bRes, aRes, cData, hRes, mRes] = await Promise.all([
          api(`/api/banquet/bookings/${bookingId}`),
          api(`/api/banquet/assignments?booking_id=${bookingId}`),
          fetchCustomers(),
          api("/api/banquet/halls"),
          api("/api/banquet/menus?active=1")
        ]);
        
        const bData = await bRes.json();
        const aData = await aRes.json();
        const hData = await hRes.json();
        const mData = await mRes.json();
        
        setCustomers(Array.isArray(cData) ? cData : (cData.data || []));
        setHalls(hData.data || []);
        setMenus(mData.data || []);
        setAssignments(aData.data || []);
        
        if (bData.data) {
          setForm({
            customer_id: String(bData.data.customer_id),
            hall_id: String(bData.data.hall_id),
            menu_id: bData.data.menu_id ? String(bData.data.menu_id) : "none",
            pax_count: Number(bData.data.pax_count),
            booking_date: bData.data.booking_date,
            session: bData.data.session,
            notes: bData.data.notes || "",
            total_amount: Number(bData.data.total_amount),
            advance_paid: Number(bData.data.advance_paid),
            discount_amount: Number(bData.data.discount_amount || 0),
            status: bData.data.status
          });
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to load booking details", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  const selectedHall = halls.find(h => String(h.id) === String(form.hall_id));
  const selectedMenu = menus.find(m => String(m.id) === String(form.menu_id));

  // Update total when hall, session, menu, or pax changes
  useEffect(() => {
    if (loading) return; // Don't recalculate while initially loading

    let total = 0;
    if (selectedHall) {
      let multiplier = 1;
      if (form.session === 'Morning' || form.session === 'Evening') multiplier = 0.6;
      total += Math.round(Number(selectedHall.price_per_session) * multiplier);
    }
    if (selectedMenu && form.pax_count > 0 && form.menu_id !== 'none') {
      total += Number(selectedMenu.price_per_pax) * Number(form.pax_count);
    }
    
    // Add existing assignments to total
    assignments.forEach(a => {
      total += (Number(a.qty) * Number(a.unit_price));
    });

    setForm(prev => ({ ...prev, total_amount: total - (form.discount_amount || 0) }));
  }, [selectedHall, selectedMenu, form.session, form.pax_count, assignments, form.discount_amount, loading]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.menu_id === 'none') payload.menu_id = null;

      const res = await api(`/api/banquet/bookings/${bookingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Banquet booking updated" });
        router.push(`/banquet/bookings/${bookingId}`);
      } else {
        const errData = await res.json();
        toast({ title: "Error", description: errData.message || "Update failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update booking", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const hallCharge = (selectedHall ? Number(selectedHall.price_per_session) * (form.session === 'FullDay' ? 1 : 0.6) : 0);
  const menuCharge = (selectedMenu && form.pax_count > 0 && form.menu_id !== 'none' ? Number(selectedMenu.price_per_pax) * form.pax_count : 0);
  const assignmentsCharge = assignments.reduce((sum, a) => sum + (Number(a.qty) * Number(a.unit_price)), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>Back</Button>
        <h1 className="text-2xl font-bold">Edit Banquet Booking</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Host Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer / Host</Label>
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
                {submitting ? <Loader2 className="animate-spin mr-2" /> : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function EditBanquetBookingPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
        <EditBanquetBookingForm />
      </Suspense>
    </DashboardLayout>
  );
}

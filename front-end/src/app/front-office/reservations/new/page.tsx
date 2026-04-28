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
import { Calendar, User, ArrowRight, Loader2, Bed, Users, PlusCircle } from "lucide-react";

function ReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    room_id: searchParams.get("room_id") || "",
    check_in: new Date().toISOString().split('T')[0],
    check_out: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    adults: "1",
    children: "0",
    meal_plan: "BB",
    total_amount: 0
  });

  useEffect(() => {
    void (async () => {
      try {
        const [cData, rRes] = await Promise.all([
          fetchCustomers(),
          api("/api/hotel/rooms")
        ]);
        const rData = await rRes.json();
        setCustomers(Array.isArray(cData) ? cData : (cData.data || []));
        setRooms(rData.data || []);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load dependencies", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedRoom = rooms.find(r => String(r.id) === String(form.room_id));

  // Fetch rates when room category changes
  useEffect(() => {
    if (selectedRoom) {
      api(`/api/hotel/room-type-rates/${selectedRoom.type_id}`)
        .then(res => res.json())
        .then(data => setRates(data.data || []));
    }
  }, [selectedRoom?.type_id]);

  // Calculate total whenever room, dates, or meal plan change
  useEffect(() => {
    if (selectedRoom && form.check_in && form.check_out) {
      const start = new Date(form.check_in);
      const end = new Date(form.check_out);
      const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Lookup specific rate for meal plan
      const mealRate = rates.find(r => r.meal_plan === form.meal_plan);
      const dailyRate = (mealRate && Number(mealRate.rate) > 0) ? Number(mealRate.rate) : Number(selectedRoom.base_rate);
      
      setForm(prev => ({ ...prev, total_amount: dailyRate * diff }));
    }
  }, [selectedRoom, form.check_in, form.check_out, form.meal_plan, rates]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api("/api/hotel/reservations", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Reservation created. Checking in..." });
        // Automatically Check-in
        await api(`/api/hotel/check-in/${data.data.id}`, { method: "POST" });
        router.push("/front-office/dashboard");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create reservation", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>Cancel</Button>
        <h1 className="text-2xl font-bold">New Check-In</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Guest Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Guest</Label>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs gap-1"
                    onClick={() => router.push("/cms/customers")}
                  >
                    <PlusCircle className="w-3 h-3" />
                    New Guest
                  </Button>
                </div>
                <SearchableSelect
                  options={customers.map(c => ({ 
                    value: String(c.id), 
                    label: `${c.name} (${c.phone || 'No Phone'})`,
                    keywords: `${c.name} ${c.phone || ''} ${c.email || ''}`
                  }))}
                  value={form.customer_id}
                  onValueChange={v => setForm({...form, customer_id: v})}
                  placeholder="Search guest by name or phone..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adults</Label>
                  <Input type="number" value={form.adults} onChange={e => setForm({...form, adults: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Input type="number" value={form.children} onChange={e => setForm({...form, children: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meal Plan</Label>
                <Select value={form.meal_plan} onValueChange={v => setForm({...form, meal_plan: v})}>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Stay Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Room</Label>
                <Select value={form.room_id} onValueChange={v => setForm({...form, room_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Choose a room" /></SelectTrigger>
                  <SelectContent>
                    {rooms.filter(r => r.status === 'Available' || String(r.id) === String(form.room_id)).map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>Room {r.room_number} - {r.type_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check-In Date</Label>
                  <Input type="date" value={form.check_in} onChange={e => setForm({...form, check_in: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Check-Out Date</Label>
                  <Input type="date" value={form.check_out} onChange={e => setForm({...form, check_out: e.target.value})} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20">
            <CardHeader>
              <CardTitle className="text-white/80 text-xs uppercase tracking-widest">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Room Charge</span>
                <span className="font-bold">LKR {form.total_amount.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="text-[10px] uppercase opacity-50 font-bold mb-1">Stay Duration</div>
                <div className="text-lg font-bold">
                  {Math.max(1, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / (1000 * 60 * 60 * 24)))} Nights
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !form.customer_id || !form.room_id}
                className="w-full bg-white text-primary hover:bg-white/90 py-6 font-bold text-lg rounded-xl"
              >
                {submitting ? <Loader2 className="animate-spin" /> : "Confirm Check-In"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewReservationPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
        <ReservationForm />
      </Suspense>
    </DashboardLayout>
  );
}

"use client"

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { INITIAL_REPAIR_ORDERS } from '@/lib/mock-data';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  MapPin, 
  Car, 
  AlertCircle, 
  Calendar,
  User,
  History,
  FileText,
  Printer,
  Share2
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const priorityColors = {
  'Emergency': 'bg-red-500',
  'High': 'bg-orange-500',
  'Medium': 'bg-blue-500',
  'Low': 'bg-slate-400'
};

const statusColors = {
  'Pending': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-primary',
  'Completed': 'bg-green-100 text-green-700'
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  // Find the order from mock data
  const order = INITIAL_REPAIR_ORDERS.find(o => o.id === id);

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Order Not Found</h2>
          <p className="text-muted-foreground mb-6">The repair order ID {id} does not exist.</p>
          <Button onClick={() => router.push('/orders')}>Back to Queue</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button size="sm" className="bg-primary">Edit Order</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Main Header Card */}
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                      <Car className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight">{order.vehicleId}</h1>
                        <Badge className={cn(priorityColors[order.priority], "border-none text-white text-[10px]")}>
                          {order.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{order.id}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={cn(statusColors[order.status], "px-4 py-1 text-sm font-bold h-fit self-start sm:self-center")}>
                    {order.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Mileage</p>
                    <p className="text-sm font-semibold">{order.mileage.toLocaleString()} km</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Location</p>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {order.location || 'Not Assigned'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Technician</p>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <User className="w-3.5 h-3.5 text-primary" />
                      {order.technician || 'Unassigned'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Created At</p>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {format(new Date(order.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    Problem Description
                  </h3>
                  <div className="p-4 bg-orange-50/30 border border-orange-100 rounded-xl">
                    <p className="text-sm leading-relaxed italic text-slate-800">
                      "{order.problemDescription}"
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Repair Checklist
                    </h3>
                    <div className="space-y-2">
                      {order.checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
                          <div className="w-5 h-5 rounded-md border-2 border-muted flex items-center justify-center shrink-0 mt-0.5" />
                          <span className="text-sm font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" />
                      Assigned Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {order.categories.map((cat, i) => (
                        <Badge key={i} variant="outline" className="px-3 py-1.5 text-xs font-semibold bg-blue-50/50 border-blue-100 text-primary">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    {order.comments && (
                      <div className="mt-6 space-y-2">
                        <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Office Notes</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{order.comments}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline / History */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Order Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                  <div className="relative flex items-center justify-between gap-6 group">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 flex items-center justify-center bg-white rounded-full border-2 border-primary shadow-sm z-10">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Order Registered</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM d, yyyy • h:mm a')}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Officer</Badge>
                  </div>

                  {order.status !== 'Pending' && (
                    <div className="relative flex items-center justify-between gap-6 group">
                      <div className="flex items-center gap-4">
                        <div className="relative w-10 h-10 flex items-center justify-center bg-white rounded-full border-2 border-blue-500 shadow-sm z-10">
                          <Wrench className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Technician Assigned</p>
                          <p className="text-xs text-muted-foreground">{order.technician} assigned to {order.location}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {order.status === 'Completed' && (
                    <div className="relative flex items-center justify-between gap-6 group">
                      <div className="flex items-center gap-4">
                        <div className="relative w-10 h-10 flex items-center justify-center bg-white rounded-full border-2 border-green-500 shadow-sm z-10">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Repair Finalized</p>
                          <p className="text-xs text-muted-foreground">Verification completed and vehicle ready.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-primary text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">Expected Completion</CardTitle>
                <CardDescription className="text-white/70">Estimated deadline for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{format(new Date(order.expectedTime), 'h:mm a')}</p>
                    <p className="text-xs text-white/70">{format(new Date(order.expectedTime), 'EEEE, MMM d')}</p>
                  </div>
                </div>
                
                <Separator className="bg-white/10" />
                
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Time Remaining</p>
                  <p className="text-sm font-medium">Approx. 4 hours 20 mins</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Customer Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-bold">Confidential</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="text-sm font-bold">+1 (555) 012-3456</span>
                </div>
                <Button variant="outline" className="w-full mt-2">Send Status SMS</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

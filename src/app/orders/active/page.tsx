"use client"

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { INITIAL_REPAIR_ORDERS } from '@/lib/mock-data';
import { RepairOrder, Priority, RepairStatus, REPAIR_CATEGORIES, CategoryCompletion } from '@/lib/types';
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
  Clock, 
  Wrench, 
  CheckCircle2, 
  MapPin,
  Car,
  Timer,
  AlertCircle,
  Plus,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const priorityColors: Record<Priority, string> = {
  'Emergency': 'bg-red-500',
  'High': 'bg-orange-500',
  'Medium': 'bg-blue-500',
  'Low': 'bg-slate-400'
};

export default function ActiveJobsPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<RepairOrder[]>(
    INITIAL_REPAIR_ORDERS.filter(o => o.status === 'In Progress')
  );
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  
  // Completion form state
  const [completedCats, setCompletedCats] = useState<CategoryCompletion[]>([]);

  const handleOpenComplete = (order: RepairOrder) => {
    setSelectedOrder(order);
    setCompletedCats(order.categories.map(cat => ({ name: cat, comment: '' })));
    setIsCompleteDialogOpen(true);
  };

  const toggleCategory = (catName: string) => {
    setCompletedCats(prev => {
      const exists = prev.find(c => c.name === catName);
      if (exists) {
        return prev.filter(c => c.name !== catName);
      } else {
        return [...prev, { name: catName, comment: '' }];
      }
    });
  };

  const updateCategoryComment = (catName: string, comment: string) => {
    setCompletedCats(prev => prev.map(c => 
      c.name === catName ? { ...c, comment } : c
    ));
  };

  const handleCompleteSubmit = () => {
    if (!selectedOrder) return;

    setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));

    toast({
      title: "Repair Completed",
      description: `Job finished for ${selectedOrder.vehicleId}.`
    });
    setIsCompleteDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Active Workshop Jobs</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Real-time status of vehicles in the bays</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-blue-50 text-primary border-blue-200 px-3 py-1">
            {orders.length} Active Repairs
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.length === 0 ? (
          <Card className="col-span-full border-dashed p-12 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Wrench className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">No Active Jobs</h3>
            <p className="text-muted-foreground max-w-xs">Assign orders from the queue to start seeing them here.</p>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="border-none shadow-md hover:shadow-lg transition-all overflow-hidden group">
              <CardHeader className="bg-muted/30 p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm">{order.location}</span>
                  </div>
                  <Badge className={`${priorityColors[order.priority]} border-none text-white text-[10px]`}>
                    {order.priority}
                  </Badge>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Car className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg">{order.vehicleId}</h3>
                      <p className="text-[10px] text-muted-foreground font-mono">{order.id}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Estimated Progress</Label>
                    <span className="text-xs font-bold text-primary">65%</span>
                  </div>
                  <Progress value={65} className="h-1.5" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Technician</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {order.technician?.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold">{order.technician}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Due Time</p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      {format(new Date(order.expectedTime), 'h:mm a')}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Focus Task
                  </p>
                  <p className="text-xs font-medium line-clamp-2 italic">
                    {order.problemDescription}
                  </p>
                </div>

                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => handleOpenComplete(order)}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Complete
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Finalize Repair
            </DialogTitle>
            <DialogDescription>
              Confirm completion for {selectedOrder?.vehicleId}. Verify categories and add notes.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 px-6 py-2">
            <div className="space-y-6 pb-6">
              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification Categories</Label>
                <div className="grid grid-cols-1 gap-3">
                  {REPAIR_CATEGORIES.map((cat) => {
                    const isSelected = completedCats.some(c => c.name === cat);
                    const selectedCat = completedCats.find(c => c.name === cat);
                    
                    return (
                      <div key={cat} className={cn(
                        "p-4 rounded-xl border transition-all",
                        isSelected ? "bg-primary/5 border-primary shadow-sm" : "bg-card border-border"
                      )}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              id={`cat-${cat}`} 
                              checked={isSelected}
                              onCheckedChange={() => toggleCategory(cat)}
                            />
                            <Label htmlFor={`cat-${cat}`} className="font-bold cursor-pointer">{cat}</Label>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </div>
                        {isSelected && (
                          <div className="mt-2 animate-in slide-in-from-top-2">
                            <Input 
                              placeholder="Optional category-specific comments..." 
                              className="text-xs bg-white/50"
                              value={selectedCat?.comment || ''}
                              onChange={(e) => updateCategoryComment(cat, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Global Technician Notes</Label>
                <Input placeholder="E.g. Verified fix, test drove 5km..." className="h-12" />
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <Timer className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Actual repair time logged: 4h 15m</span>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 border-t flex-row gap-2 bg-muted/20">
            <Button variant="outline" className="flex-1" onClick={() => setIsCompleteDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCompleteSubmit} 
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={completedCats.length === 0}
            >
              Complete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

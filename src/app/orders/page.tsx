"use client"

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { INITIAL_REPAIR_ORDERS, BAYS, TECHNICIANS } from '@/lib/mock-data';
import { RepairOrder, Priority, RepairStatus, BayLocation } from '@/lib/types';
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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Filter, 
  MoreHorizontal, 
  ArrowUpDown, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  ChevronRight,
  ExternalLink,
  UserPlus,
  MapPin,
  Car
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const priorityColors: Record<Priority, string> = {
  'Emergency': 'bg-red-500',
  'High': 'bg-orange-500',
  'Medium': 'bg-blue-500',
  'Low': 'bg-slate-400'
};

const statusColors: Record<RepairStatus, string> = {
  'Pending': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-primary',
  'Completed': 'bg-green-100 text-green-700'
};

export default function OrderQueuePage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<RepairOrder[]>(INITIAL_REPAIR_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);

  const [assignment, setAssignment] = useState({
    bay: '' as BayLocation,
    technician: '',
    proposedTime: ''
  });

  const handleOpenAssign = (order: RepairOrder) => {
    setSelectedOrder(order);
    setAssignment({
      bay: order.location || '' as BayLocation,
      technician: order.technician || '',
      proposedTime: order.proposedTime || ''
    });
    setIsAssignDialogOpen(true);
  };

  const handleAssignSubmit = () => {
    if (!selectedOrder) return;
    
    setOrders(prev => prev.map(o => 
      o.id === selectedOrder.id 
        ? { 
            ...o, 
            location: assignment.bay, 
            technician: assignment.technician, 
            proposedTime: assignment.proposedTime,
            status: 'In Progress' as RepairStatus
          } 
        : o
    ));

    toast({
      title: "Vehicle Assigned",
      description: `Assigned ${selectedOrder.vehicleId} to ${assignment.bay}.`
    });
    setIsAssignDialogOpen(false);
  };

  const handleOpenComplete = (order: RepairOrder) => {
    setSelectedOrder(order);
    setIsCompleteDialogOpen(true);
  };

  const handleCompleteSubmit = () => {
    if (!selectedOrder) return;

    setOrders(prev => prev.map(o => 
      o.id === selectedOrder.id 
        ? { 
            ...o, 
            status: 'Completed' as RepairStatus,
            completedAt: new Date().toISOString()
          } 
        : o
    ));

    toast({
      title: "Repair Completed",
      description: `Job finished for ${selectedOrder.vehicleId}.`
    });
    setIsCompleteDialogOpen(false);
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const priorityWeight = { 'Emergency': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return new Date(a.expectedTime).getTime() - new Date(b.expectedTime).getTime();
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workshop Order Queue</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage vehicle intake and shop flow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-initial">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-initial">
            <ArrowUpDown className="w-4 h-4" />
            Sort
          </Button>
        </div>
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block shadow-md border-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Expected By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-mono text-xs font-bold">{order.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{order.vehicleId}</span>
                      <span className="text-xs text-muted-foreground">{order.mileage.toLocaleString()} km</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={order.problemDescription}>
                    {order.problemDescription}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${priorityColors[order.priority]} border-none text-white`}>
                      {order.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${statusColors[order.status]} font-semibold`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.location ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <MapPin className="w-3 h-3 text-primary" />
                          {order.location}
                        </div>
                        {order.technician && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Wrench className="w-3 h-3" />
                            {order.technician}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {format(new Date(order.expectedTime), 'MMM d, h:mm a')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Workshop Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenAssign(order)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Assign Bay/Tech
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenComplete(order)} disabled={order.status === 'Completed'}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Complete Job
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-primary font-medium">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {sortedOrders.map((order) => (
          <Card key={order.id} className="border-none shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted-foreground font-bold">{order.id}</span>
                <Badge variant="secondary" className={`${statusColors[order.status]} text-[10px]`}>
                  {order.status}
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{order.vehicleId}</h3>
                    <p className="text-xs text-muted-foreground">{order.mileage.toLocaleString()} km</p>
                  </div>
                </div>
                <Badge className={`${priorityColors[order.priority]} border-none text-white text-[10px]`}>
                  {order.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {order.problemDescription}
              </p>
              
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{format(new Date(order.expectedTime), 'MMM d, h:mm a')}</span>
                </div>
                {order.location && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {order.location}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 gap-2" 
                  onClick={() => handleOpenAssign(order)}
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenComplete(order)} disabled={order.status === 'Completed'}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Job
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-primary font-medium">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Assign Repair
            </DialogTitle>
            <DialogDescription>
              Assign {selectedOrder?.vehicleId} to a workshop bay.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bay">Location / Bay</Label>
              <Select 
                value={assignment.bay} 
                onValueChange={(val) => setAssignment({...assignment, bay: val as BayLocation})}
              >
                <SelectTrigger id="bay">
                  <SelectValue placeholder="Select bay" />
                </SelectTrigger>
                <SelectContent>
                  {BAYS.map(bay => <SelectItem key={bay} value={bay}>{bay}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tech">Technician</Label>
              <Select 
                value={assignment.technician} 
                onValueChange={(val) => setAssignment({...assignment, technician: val})}
              >
                <SelectTrigger id="tech">
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {TECHNICIANS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignSubmit} className="flex-1 bg-primary">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Complete Repair
            </DialogTitle>
            <DialogDescription>
              Mark {selectedOrder?.vehicleId} as finished.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Final Notes</Label>
              <Input placeholder="E.g. Replaced all pads..." />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsCompleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCompleteSubmit} className="flex-1 bg-green-600 hover:bg-green-700">Finish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

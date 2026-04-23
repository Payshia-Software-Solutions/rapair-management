"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchLeaveRequests, 
  fetchLeaveTypes, 
  createLeaveRequest, 
  updateLeaveStatus,
  fetchEmployees,
  EmployeeRow,
  LeaveRequestRow,
  LeaveTypeRow
} from "@/lib/api";
import { Loader2, Plane, Plus, CheckCircle2, XCircle, Clock, CalendarIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LeavePage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<LeaveRequestRow>>({
    employee_id: undefined,
    leave_type_id: undefined,
    start_date: "",
    end_date: "",
    reason: ""
  });

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const [reqData, typeData, empData] = await Promise.all([
        fetchLeaveRequests(status === 'All' ? undefined : status),
        fetchLeaveTypes(),
        fetchEmployees()
      ]);
      setRequests(reqData);
      setLeaveTypes(typeData);
      setEmployees(empData.filter(e => e.status === 'Active'));
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(statusFilter);
  }, [statusFilter]);

  const openAdd = () => {
    setFormData({
      employee_id: undefined,
      leave_type_id: leaveTypes[0]?.id,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      reason: ""
    });
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await createLeaveRequest(formData);
      toast({ title: "Submitted", description: "Leave request submitted for approval" });
      setIsDialogOpen(false);
      void load(statusFilter);
    } catch (err) {
      toast({ title: "Submission Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateLeaveStatus(id, status);
      toast({ title: "Updated", description: `Request ${status.toLowerCase()} successfully` });
      void load(statusFilter);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <Plane className="w-6 h-6 text-primary rotate-[-20deg]" />
            Leave Management
          </h1>
          <p className="text-muted-foreground mt-1">Review, approve and manage employee time-off requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-card border-muted/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">Request Log</CardTitle>
              <CardDescription>Filtering by: <span className="font-semibold text-primary">{statusFilter}</span></CardDescription>
            </div>
            <div className="flex gap-4 px-4 py-1 rounded-full bg-muted/30">
               <div className="text-xs font-semibold text-orange-500 uppercase flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                 {requests.filter(r => r.status === 'Pending').length} Pending
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 text-foreground">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading request bank...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-muted/20">
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/10 transition-colors border-b border-muted/20">
                        <TableCell>
                          <div className="font-semibold">{req.employee_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {req.employee_id}</div>
                        </TableCell>
                        <TableCell>
                           <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-none px-2 shadow-none">
                             {req.leave_type_name || "Leave"}
                           </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            {req.start_date} <span className="text-muted-foreground">→</span> {req.end_date}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {req.total_days}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`
                              ${req.status === 'Approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                req.status === 'Pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                                'bg-red-500/10 text-red-500 border-red-500/20'}
                            `}
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === 'Pending' ? (
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-green-500/30 text-green-500 hover:bg-green-500/10"
                                onClick={() => void handleStatusUpdate(req.id, "Approved")}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-red-500/30 text-red-500 hover:bg-red-500/10"
                                onClick={() => void handleStatusUpdate(req.id, "Rejected")}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Action taken</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No leave requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card text-foreground border-muted/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              New Leave Request
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Employee</Label>
              <Select 
                value={String(formData.employee_id || "")} 
                onValueChange={v => setFormData({...formData, employee_id: Number(v)})}
              >
                <SelectTrigger className="border-muted/30">
                  <SelectValue placeholder="Select Staff" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Leave Type</Label>
              <Select 
                value={String(formData.leave_type_id || "")} 
                onValueChange={v => setFormData({...formData, leave_type_id: Number(v)})}
              >
                <SelectTrigger className="border-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Start Date</Label>
                <Input 
                  type="date" 
                  value={formData.start_date || ""} 
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  className="border-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">End Date</Label>
                <Input 
                  type="date" 
                  value={formData.end_date || ""} 
                  onChange={e => setFormData({...formData, end_date: e.target.value})}
                  className="border-muted/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason for Leave</Label>
              <Input 
                value={formData.reason || ""} 
                onChange={e => setFormData({...formData, reason: e.target.value})}
                placeholder="Brief explanation..."
                className="border-muted/30"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4 border-muted/10">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving} className="border-muted/30">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

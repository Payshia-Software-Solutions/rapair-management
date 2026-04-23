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
  fetchAttendance, 
  logAttendance, 
  fetchEmployees,
  EmployeeRow,
  AttendanceRow
} from "@/lib/api";
import { Loader2, ClipboardList, Plus, Calendar, Clock, User } from "lucide-react";
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

export default function AttendancePage() {
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<AttendanceRow>>({
    employee_id: undefined,
    date: new Date().toISOString().split("T")[0],
    clock_in: "",
    clock_out: "",
    status: "Present",
    notes: ""
  });

  const load = async (date: string) => {
    setLoading(true);
    try {
      const [attData, empData] = await Promise.all([
        fetchAttendance(date),
        fetchEmployees()
      ]);
      setAttendance(attData);
      setEmployees(empData.filter(e => e.status === 'Active'));
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(selectedDate);
  }, [selectedDate]);

  const openAdd = () => {
    setFormData({
      employee_id: undefined,
      date: selectedDate,
      clock_in: "08:30",
      clock_out: "17:30",
      status: "Present",
      notes: ""
    });
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!formData.employee_id || !formData.date) {
      toast({ title: "Error", description: "Employee and Date are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Backend expects DATETIME or simple string for clock_in/out. 
      // We'll combine date + time if provided.
      const payload = {
        ...formData,
        clock_in: formData.clock_in ? `${formData.date} ${formData.clock_in}:00` : null,
        clock_out: formData.clock_out ? `${formData.date} ${formData.clock_out}:00` : null,
      };

      await logAttendance(payload);
      toast({ title: "Success", description: "Attendance recorded successfully" });
      setIsDialogOpen(false);
      void load(selectedDate);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <ClipboardList className="w-6 h-6 text-primary" />
            Attendance Tracking
          </h1>
          <p className="text-muted-foreground mt-1">Review daily clock-in/out logs and employee presence</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            className="w-40 bg-card border-muted/20"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Log Attendance
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Daily Log: {selectedDate}</CardTitle>
                <CardDescription>Real-time presence summary for all active staff</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500">{attendance.filter(a => a.status === 'Present' || a.status === 'Late').length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Present</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{employees.length - attendance.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Absent</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 text-foreground">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Fetching attendance logs...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-muted/20">
                      <TableHead>Employee</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/10 transition-colors border-b border-muted/20">
                        <TableCell>
                          <div className="font-semibold">{log.employee_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {log.employee_id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-sm tracking-tight text-blue-500">
                            <Clock className="w-3.5 h-3.5" />
                            {log.clock_in ? new Date(log.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-sm tracking-tight text-orange-500">
                            <Clock className="w-3.5 h-3.5" />
                            {log.clock_out ? new Date(log.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`
                              ${log.status === 'Present' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                log.status === 'Late' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                                log.status === 'Half-Day' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20'}
                            `}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {log.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8 text-primary hover:bg-primary/10">
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {attendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No logs for this date.
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
              Log Manual Attendance
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Select Employee
              </Label>
              <Select 
                value={String(formData.employee_id || "")} 
                onValueChange={v => setFormData({...formData, employee_id: Number(v)})}
              >
                <SelectTrigger className="border-muted/30">
                  <SelectValue placeholder="Full Name" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Date
              </Label>
              <Input 
                type="date" 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="border-muted/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Clock In</Label>
                <Input 
                  type="time" 
                  value={formData.clock_in || ""} 
                  onChange={e => setFormData({...formData, clock_in: e.target.value})}
                  className="border-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Clock Out</Label>
                <Input 
                  type="time" 
                  value={formData.clock_out || ""} 
                  onChange={e => setFormData({...formData, clock_out: e.target.value})}
                  className="border-muted/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Presence Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={v => setFormData({...formData, status: v as any})}
              >
                <SelectTrigger className="border-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present (On-time)</SelectItem>
                  <SelectItem value="Late">Late Entry</SelectItem>
                  <SelectItem value="Half-Day">Half Day</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Internal Notes</Label>
              <Input 
                value={formData.notes || ""} 
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Reason for late entry, etc."
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
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

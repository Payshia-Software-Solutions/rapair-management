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
  fetchPayroll, 
  generatePayroll, 
  updatePayrollStatus,
  PayrollRow 
} from "@/lib/api/hrm";
import { Loader2, Banknote, Plus, CheckCircle, Wallet, Calendar, Calculator, Users, Clock, Info } from "lucide-react";
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

export default function PayrollPage() {
  const { toast } = useToast();
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  
  const [isGenDialogOpen, setIsGenDialogOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<any[] | null>(null);

  const months = [
    { v: 1, n: "January" }, { v: 2, n: "February" }, { v: 3, n: "March" },
    { v: 4, n: "April" }, { v: 5, n: "May" }, { v: 6, n: "June" },
    { v: 7, n: "July" }, { v: 8, n: "August" }, { v: 9, n: "September" },
    { v: 10, n: "October" }, { v: 11, n: "November" }, { v: 12, n: "December" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const load = async (m: number, y: number) => {
    setLoading(true);
    try {
      const data = await fetchPayroll(m, y);
      setPayroll(data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(month, year);
  }, [month, year]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePayroll({ month, year });
      toast({ title: "Success", description: "Payroll generated for selected month" });
      setIsGenDialogOpen(false);
      void load(month, year);
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await updatePayrollStatus(id, status);
      toast({ title: "Status Updated", description: `Payroll marked as ${status}` });
      void load(month, year);
    } catch (err) {
      toast({ title: "Update Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const showBreakdown = (p: PayrollRow) => {
      if (!p.breakdown) {
          toast({ title: "No Breakdown", description: "Historical data not available for this record." });
          return;
      }
      try {
          const items = JSON.parse(p.breakdown);
          setSelectedBreakdown(items);
      } catch (e) {
          console.error(e);
      }
  };

  const totalPayout = payroll.reduce((acc, curr) => acc + Number(curr.net_salary), 0);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 text-foreground">
            <Banknote className="w-8 h-8 text-primary" />
            Payroll Management
          </h1>
          <p className="text-muted-foreground mt-1">Review monthly salary distributions and processing status</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-32 bg-card border-none shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.v} value={String(m.v)}>{m.n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 bg-card border-none shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsGenDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center gap-2 px-6">
            <Calculator className="w-4 h-4" />
            Process
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-primary/5 border-primary/10 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Total Staff</CardDescription>
            <CardTitle className="text-2xl">{payroll.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Total Payout</CardDescription>
            <CardTitle className="text-2xl font-mono text-green-600">
              {totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/10 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending Approval</CardDescription>
            <CardTitle className="text-2xl text-orange-600">
              {payroll.filter(p => p.status === 'Draft').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0 text-foreground">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Calculating payroll...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 font-bold">
                    <TableRow className="border-b border-muted/20">
                      <TableHead className="w-[250px]">Employee</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/10 transition-colors border-b border-muted/20">
                        <TableCell>
                          <div className="font-semibold">{p.employee_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {p.employee_id}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm tracking-tight">
                          {Number(p.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-green-600">
                          {Number(p.allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-red-500">
                          {Number(p.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary">
                          <button onClick={() => showBreakdown(p)} className="flex items-center gap-1 hover:underline">
                            {Number(p.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`
                              ${p.status === 'Paid' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                p.status === 'Draft' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                                'bg-blue-500/10 text-blue-500 border-blue-500/20'}
                            `}
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                             {p.status === 'Draft' && (
                               <Button size="sm" variant="outline" className="h-8 text-orange-500 border-orange-500/30 font-semibold" onClick={() => void updateStatus(p.id, "Approved")}>
                                 Approve
                               </Button>
                             )}
                             {p.status === 'Approved' && (
                               <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-500/30 font-semibold" onClick={() => void updateStatus(p.id, "Paid")}>
                                 Mark Paid
                               </Button>
                             )}
                             {p.status === 'Paid' && (
                               <CheckCircle className="w-5 h-5 text-green-500 mr-4" />
                             )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payroll.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic">
                          <Calculator className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          Payroll not processed for {months.find(m => m.v === month)?.n} {year}. <br/>
                          Click 'Process' to generate entries.
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

      <Dialog open={isGenDialogOpen} onOpenChange={setIsGenDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card text-foreground border-muted/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Process Payroll
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center space-y-4">
             <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium">Generate payroll entries for:</p>
                <p className="text-2xl font-bold font-mono tracking-wider text-primary">
                  {months.find(m => m.v === month)?.n.toUpperCase()}, {year}
                </p>
             </div>
             <p className="text-xs text-muted-foreground">
               This will create draft payroll records for all active employees based on their current basic salary profile AND recurring item templates.
             </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4 border-muted/10">
            <Button variant="outline" onClick={() => setIsGenDialogOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating} className="bg-primary text-white px-8">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm & Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBreakdown} onOpenChange={(o) => !o && setSelectedBreakdown(null)}>
        <DialogContent className="sm:max-w-[450px] bg-card text-foreground border-muted/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Salary Breakdown
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="py-2">Component</TableHead>
                            <TableHead className="py-2 text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedBreakdown?.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="py-2">
                                    <div className="font-medium text-sm">{item.name}</div>
                                    <div className="text-[10px] uppercase text-muted-foreground">{item.type}</div>
                                </TableCell>
                                <TableCell className={`py-2 text-right font-mono font-bold ${item.type === 'Deduction' ? 'text-red-500' : 'text-green-600'}`}>
                                    {item.type === 'Deduction' ? '-' : '+'} 
                                    {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBreakdown(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

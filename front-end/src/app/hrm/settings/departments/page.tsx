"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchHRDepartments, 
  HRDepartmentRow,
  api
} from "@/lib/api/hrm";
import { Loader2, Building2, Plus, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export default function DepartmentsPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<HRDepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDept, setNewDept] = useState({ name: "", prefix: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHRDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: "Sync Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddDept = async () => {
    if (!newDept.name || !newDept.prefix) return;
    try {
      await api('/api/hrsettings/departments', { method: 'POST', body: JSON.stringify(newDept) });
      toast({ title: "Success", description: "Department added" });
      setNewDept({ name: "", prefix: "" });
      void loadData();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message });
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
           <Link href="/hrm/settings" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mb-2">
             <ArrowLeft className="w-3 h-3" /> Back to Settings
           </Link>
           <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
             <Building2 className="w-8 h-8 text-primary" />
             Staff Departments
           </h1>
           <p className="text-muted-foreground mt-1">Manage organizational divisions for staff grouping</p>
        </div>
      </div>

      {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading departments...</p>
          </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="border-none shadow-md bg-card/60">
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg">Add New Department</CardTitle>
                    <CardDescription>Departments are used to group staff and generate unique serial IDs</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Department Name</Label>
                            <Input 
                                placeholder="e.g. Quality Assurance" 
                                className="h-11 font-medium"
                                value={newDept.name} 
                                onChange={e=>setNewDept({...newDept, name: e.target.value})} 
                            />
                        </div>
                        <div className="w-32 space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">ID Prefix</Label>
                            <Input 
                                placeholder="QA" 
                                className="h-11 font-mono font-bold"
                                maxLength={5} 
                                value={newDept.prefix} 
                                onChange={e=>setNewDept({...newDept, prefix: e.target.value.toUpperCase()})} 
                            />
                        </div>
                        <Button className="mt-7 h-11 px-6 shadow-lg shadow-primary/20" onClick={handleAddDept}>
                            <Plus className="w-4 h-4 mr-2" />
                            Save Department
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card/60">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6">Department</TableHead>
                                <TableHead className="text-center w-32">Unique Prefix</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {departments.map(d => (
                                <TableRow key={d.id} className="hover:bg-muted/10 border-muted/10">
                                    <TableCell className="font-semibold px-6">{d.name}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="font-mono text-primary border-primary/20 bg-primary/5 uppercase tracking-widest px-3">
                                            {d.prefix}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {departments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-20 text-muted-foreground italic">
                                        No departments configured yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

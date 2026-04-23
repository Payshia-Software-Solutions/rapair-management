"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { 
  fetchEmployees, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee, 
  EmployeeRow,
  fetchHRDepartments,
  fetchHRCategories,
  generateEmployeeCode,
  HRDepartmentRow,
  HRCategoryRow,
  fetchSalaryItems,
  saveSalaryItem,
  deleteSalaryItem,
  SalaryItemRow,
  fetchSalaryTemplates,
  SalaryTemplateRow,
  applySalaryTemplateToEmployee
} from "@/lib/api/hrm";
import { Loader2, Users, Plus, Search, Edit2, Trash2, Mail, Phone, Briefcase, RefreshCw, Banknote, Trash, Wand2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmployeesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<HRDepartmentRow[]>([]);
  const [categories, setCategories] = useState<HRCategoryRow[]>([]);
  const [globalSchemes, setGlobalSchemes] = useState<SalaryTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Salary Template State
  const [salaryItems, setSalaryItems] = useState<SalaryItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", amount: 0, type: "Allowance" as const });
  const [applyingSchemeId, setApplyingSchemeId] = useState<string>("");

  const [formData, setFormData] = useState<Partial<EmployeeRow>>({
    employee_code: "",
    first_name: "",
    last_name: "",
    nic: "",
    email: "",
    phone: "",
    designation: "",
    category_id: undefined,
    department_id: undefined,
    basic_salary: 0,
    status: "Active",
    joined_date: new Date().toISOString().split("T")[0]
  });

  const load = async () => {
    setLoading(true);
    try {
      const [empData, deptData, catData, schemeData] = await Promise.all([
        fetchEmployees(), 
        fetchHRDepartments(),
        fetchHRCategories(),
        fetchSalaryTemplates()
      ]);
      setEmployees(empData);
      setDepartments(deptData);
      setCategories(catData);
      setGlobalSchemes(Array.isArray(schemeData) ? schemeData : []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // auto-code generation logic
  useEffect(() => {
    if (editingEmployee || !formData.department_id || !formData.category_id) return;
    
    const triggerGen = async () => {
      setGeneratingCode(true);
      try {
        const code = await generateEmployeeCode(formData.department_id!, formData.category_id!);
        setFormData(prev => ({ ...prev, employee_code: code }));
      } catch (err) {
        console.error(err);
      } finally {
        setGeneratingCode(false);
      }
    };
    
    if (!formData.employee_code || formData.employee_code.startsWith('EMP-')) {
       void triggerGen();
    }
  }, [formData.department_id, formData.category_id]);

  const handleManualGen = async () => {
    if (!formData.department_id || !formData.category_id) return;
    setGeneratingCode(true);
    try {
      const code = await generateEmployeeCode(formData.department_id!, formData.category_id!);
      setFormData(prev => ({ ...prev, employee_code: code }));
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingCode(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q || !Array.isArray(employees)) return employees || [];
    return employees.filter(e => 
      e.first_name.toLowerCase().includes(q) || 
      e.last_name.toLowerCase().includes(q) || 
      e.employee_code.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q)
    );
  }, [employees, query]);

  const openAdd = () => {
    setEditingEmployee(null);
    setSalaryItems([]);
    setApplyingSchemeId("");
    setFormData({
      employee_code: "",
      first_name: "",
      last_name: "",
      nic: "",
      email: "",
      phone: "",
      designation: "",
      category_id: Array.isArray(categories) ? categories[0]?.id : undefined,
      department_id: Array.isArray(departments) ? departments[0]?.id : undefined,
      basic_salary: 0,
      status: "Active",
      joined_date: new Date().toISOString().split("T")[0]
    });
    setIsDialogOpen(true);
  };

  const openEdit = async (emp: EmployeeRow) => {
    setEditingEmployee(emp);
    setFormData({ ...emp });
    setIsDialogOpen(true);
    setApplyingSchemeId("");
    
    // Load salary items
    setLoadingItems(true);
    try {
        const items = await fetchSalaryItems(emp.id);
        setSalaryItems(items);
    } catch (err) {
        console.error(err);
    } finally {
        setLoadingItems(false);
    }
  };

  const handleAddSalaryItem = async () => {
    if (!editingEmployee || !newItem.name || !newItem.amount) return;
    try {
        await saveSalaryItem({ ...newItem, employee_id: editingEmployee.id, is_recurring: 1 });
        const items = await fetchSalaryItems(editingEmployee.id);
        setSalaryItems(items);
        setNewItem({ name: "", amount: 0, type: "Allowance" });
        toast({ title: "Template Updated" });
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message });
    }
  };

  const handleApplyScheme = async () => {
      if (!editingEmployee || !applyingSchemeId) return;
      try {
          await applySalaryTemplateToEmployee(editingEmployee.id, Number(applyingSchemeId));
          const items = await fetchSalaryItems(editingEmployee.id);
          setSalaryItems(items);
          setApplyingSchemeId("");
          toast({ title: "Scheme Applied", description: "Standard allowances and deductions imported." });
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      }
  };

  const handleRemoveSalaryItem = async (id: number) => {
    if (!editingEmployee) return;
    try {
        await deleteSalaryItem(id);
        const items = await fetchSalaryItems(editingEmployee.id);
        setSalaryItems(items);
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message });
    }
  };

  const save = async () => {
    if (!formData.first_name || !formData.last_name || !formData.employee_code) {
      toast({ title: "Validation Error", description: "Name and Employee Code are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, formData);
        toast({ title: "Updated", description: "Employee details updated successfully" });
      } else {
        await createEmployee(formData);
        toast({ title: "Created", description: "New employee added successfully" });
      }
      setIsDialogOpen(false);
      void load();
    } catch (err) {
      toast({ title: "Save Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      await deleteEmployee(id);
      toast({ title: "Deleted", description: "Employee removed" });
      void load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 text-foreground">
            <Users className="w-8 h-8 text-primary" />
            Staff Directory
          </h1>
          <p className="text-muted-foreground mt-1">Manage personnel records and organizational structure</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center gap-2 px-6 py-5 rounded-xl font-bold">
          <Plus className="w-5 h-5" />
          Register Employee
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-xl overflow-hidden bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b bg-muted/10 flex flex-row items-center justify-between space-y-0 py-5 px-6">
            <div className="space-y-1">
              <CardTitle className="text-xl">Employee List</CardTitle>
              <CardDescription>Filtering {filteredItems.length} active records</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code or NIC..."
                className="pl-10 h-11 bg-background/50 border-muted/30 rounded-lg"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 text-foreground">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Syncing staff directory...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-muted/20">
                      <TableHead className="w-[140px] px-6">Emp ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Pay Grade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-primary/5 transition-colors border-b border-muted/20">
                        <TableCell className="px-6">
                           <div className="font-mono text-xs font-black tracking-widest text-primary p-1 rounded bg-primary/10 inline-block">
                             {emp.employee_code}
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{emp.first_name} {emp.last_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase font-bold tracking-tighter">
                                {emp.category_name || "N/A"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                             <div className="text-sm font-medium">{emp.department_name || "Unassigned"}</div>
                             <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {emp.designation || "No Designation"}
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {emp.email && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span>{emp.email}</span>
                              </div>
                            )}
                            {emp.phone && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{emp.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">
                          {Number(emp.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`
                              font-bold text-[10px] uppercase tracking-wider
                              ${emp.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                emp.status === 'Inactive' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                                'bg-red-500/10 text-red-500 border-red-500/20'}
                            `}
                          >
                            {emp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-2 text-foreground">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/hrm/employees/${emp.id}`)} className="h-9 w-9 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-transform active:scale-90">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => void handleDelete(emp.id)} className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-transform active:scale-90">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[750px] bg-card text-foreground border-muted/20 shadow-2xl overflow-hidden p-0">
          <Tabs defaultValue="details" className="w-full">
            <div className="p-6 bg-muted/20 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="w-6 h-6 text-primary" />
                    </div>
                    <TabsList className="bg-background border">
                        <TabsTrigger value="details" className="font-bold">Basic Info</TabsTrigger>
                        <TabsTrigger value="payroll" className="font-bold" disabled={!editingEmployee}>
                            <Banknote className="w-3.5 h-3.5 mr-1" /> Salary Template
                        </TabsTrigger>
                    </TabsList>
                </div>
                {!editingEmployee && (
                    <Badge variant="outline" className="h-8 px-4 bg-green-500/10 text-green-500 border-green-500/20">
                        Registration Mode
                    </Badge>
                )}
            </div>

            <TabsContent value="details" className="mt-0">
                <div className="grid grid-cols-2 gap-6 p-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">Organizational Links</h3>
                        <div className="space-y-2">
                        <Label className="text-sm font-semibold">HR Department</Label>
                        <Select 
                            value={String(formData.department_id || "")} 
                            onValueChange={v => setFormData({...formData, department_id: Number(v)})}
                        >
                            <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select Dept" />
                            </SelectTrigger>
                            <SelectContent>
                            {Array.isArray(departments) && departments.map(d => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </div>
                        <div className="space-y-2">
                        <Label className="text-sm font-semibold">Employee Category</Label>
                        <Select 
                            value={String(formData.category_id || "")} 
                            onValueChange={v => setFormData({...formData, category_id: Number(v)})}
                        >
                            <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent>
                            {Array.isArray(categories) && categories.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="code" className="text-sm font-semibold flex items-center justify-between">
                                Employee Serial Code
                                {!editingEmployee && (
                                    <button 
                                        onClick={handleManualGen} 
                                        disabled={generatingCode}
                                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw className={`w-2.5 h-2.5 ${generatingCode ? 'animate-spin' : ''}`} />
                                        Re-generate
                                    </button>
                                )}
                            </Label>
                            <div className="relative">
                                <Input 
                                    id="code" 
                                    disabled={generatingCode}
                                    value={formData.employee_code} 
                                    onChange={e => setFormData({...formData, employee_code: e.target.value.toUpperCase()})}
                                    placeholder="GEN-CODE-XXXX"
                                    className={`h-11 font-mono font-bold tracking-widest ${generatingCode ? 'animate-pulse bg-primary/5' : 'bg-muted/10'}`}
                                />
                                {generatingCode && (
                                    <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-primary" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="desig" className="text-sm font-semibold">Job Designation</Label>
                            <Input 
                                id="desig" 
                                value={formData.designation || ""} 
                                onChange={e => setFormData({...formData, designation: e.target.value})}
                                className="h-11"
                                placeholder="e.g. Senior Accountant"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">Personal Profile</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fname" className="text-sm font-semibold">First Name</Label>
                                <Input id="fname" className="h-11" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lname" className="text-sm font-semibold">Last Name</Label>
                                <Input id="lname" className="h-11" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nic" className="text-sm font-semibold">NIC / Identity Number</Label>
                            <Input id="nic" className="h-11" value={formData.nic || ""} onChange={e => setFormData({...formData, nic: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="salary" className="text-sm font-semibold">Basic Salary (Monthly)</Label>
                            <Input id="salary" className="h-11 font-mono" type="number" value={formData.basic_salary} onChange={e => setFormData({...formData, basic_salary: Number(e.target.value)})} />
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="payroll" className="mt-0">
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                                <Banknote className="w-4 h-4 text-primary" />
                                Recurring Salary Template
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Define monthly allowances and deductions for this employee. 
                                You can pick a predefined scheme or add items manually.
                            </p>
                        </div>
                        <div className="w-56 space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Apply Global Scheme</Label>
                            <div className="flex gap-2">
                                <Select value={applyingSchemeId} onValueChange={setApplyingSchemeId}>
                                    <SelectTrigger className="h-9 bg-background">
                                        <SelectValue placeholder="Pick Scheme..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {globalSchemes.map(s => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="icon" variant="secondary" className="h-9 w-9 active:scale-95" onClick={handleApplyScheme} disabled={!applyingSchemeId}>
                                    <Wand2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end bg-muted/30 p-4 rounded-xl">
                        <div className="col-span-5 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Item Description</Label>
                            <Input placeholder="e.g. Housing Allowance" className="h-9" value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount</Label>
                            <Input type="number" className="h-9 font-mono" value={newItem.amount} onChange={e=>setNewItem({...newItem, amount: Number(e.target.value)})} />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                            <Select value={newItem.type} onValueChange={v=>setNewItem({...newItem, type: v as any})}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Allowance">Allowance</SelectItem>
                                    <SelectItem value="Deduction">Deduction</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1">
                            <Button size="icon" variant="default" className="h-9 w-9" onClick={handleAddSalaryItem}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="py-2">Component</TableHead>
                                    <TableHead className="py-2">Type</TableHead>
                                    <TableHead className="py-2 text-right">Monthly Amount</TableHead>
                                    <TableHead className="py-2 w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="bg-primary/5 italic">
                                    <TableCell className="py-2 font-semibold">Basic Base Salary</TableCell>
                                    <TableCell className="py-2"><Badge variant="outline" className="text-[9px] bg-primary/10 text-primary uppercase">Base</Badge></TableCell>
                                    <TableCell className="py-2 text-right font-mono font-bold">
                                        {Number(formData.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="py-2"></TableCell>
                                </TableRow>
                                {salaryItems.map(item => (
                                    <TableRow key={item.id} className="group">
                                        <TableCell className="py-2">{item.name}</TableCell>
                                        <TableCell className="py-2">
                                            <Badge variant="outline" className={`text-[9px] uppercase ${item.type === 'Allowance' ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'}`}>
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`py-2 text-right font-mono ${item.type === 'Deduction' ? 'text-red-500' : 'text-green-600'}`}>
                                            {item.type === 'Deduction' ? '-' : '+'} 
                                            {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveSalaryItem(item.id)}>
                                                <Trash className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </TabsContent>
          </Tabs>

          <div className="bg-muted/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t">
            <div className="flex items-center gap-4">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Current Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as any})}>
                        <SelectTrigger className="h-9 w-32 font-bold text-xs bg-background">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-foreground">
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Resigned">Resigned</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Joining Date</Label>
                    <Input id="joined" type="date" className="h-9 w-36 bg-background text-xs" value={formData.joined_date || ""} onChange={e => setFormData({...formData, joined_date: e.target.value})} />
                 </div>
            </div>
            
            <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={saving} className="font-bold text-muted-foreground">
                    Discard
                </Button>
                <Button onClick={save} disabled={saving || generatingCode} className="bg-primary text-white px-10 font-bold shadow-lg shadow-primary/20">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingEmployee ? "Apply Changes" : "Create Record"}
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

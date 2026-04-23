"use client"

import React, { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from "next/navigation";
import { 
    fetchEmployee, 
    updateEmployee, 
    EmployeeRow,
    fetchSalaryItems,
    saveSalaryItem,
    deleteSalaryItem,
    SalaryItemRow,
    fetchSalaryTemplates,
    SalaryTemplateRow,
    applySalaryTemplateToEmployee,
    fetchEmployeeDocuments,
    deleteEmployeeDocument,
    EmployeeDocumentRow,
    fetchHRDepartments,
    fetchHRCategories,
    HRDepartmentRow,
    HRCategoryRow,
    api,
    contentUrl
} from "@/lib/api";
import { 
    Loader2, Users, Banknote, FileText, ArrowLeft, Save, Trash, Plus, 
    Wand2, Shield, Phone, Mail, MapPin, Calendar, User, Briefcase, 
    Globe, Heart, Info, Upload, Download, File, X, GraduationCap,
    ChevronRight, Trash2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DOCUMENT_PRESETS = [
    "National ID (NIC)",
    "Birth Certificate",
    "Educational Certificate",
    "Professional Certification",
    "Appointment Letter",
    "Contract Agreement",
    "Health Certificate",
    "Passport Copy",
    "Driving License",
    "Other (Custom)"
];

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<EmployeeRow>>({});
  
  // Meta
  const [departments, setDepartments] = useState<HRDepartmentRow[]>([]);
  const [categories, setCategories] = useState<HRCategoryRow[]>([]);

  // Salary
  const [salaryItems, setSalaryItems] = useState<SalaryItemRow[]>([]);
  const [globalSchemes, setGlobalSchemes] = useState<SalaryTemplateRow[]>([]);
  const [newSalaryItem, setNewSalaryItem] = useState({ name: "", amount: 0, type: "Allowance" as const });
  const [applyingSchemeId, setApplyingSchemeId] = useState("");
  
  // Refs & Upload States
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tempAvatarFile, setTempAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Documents
  const [documents, setDocuments] = useState<EmployeeDocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", file: null as File | null });
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const eid = id as string;
      const [emp, depts, cats, items, schemes, docs] = await Promise.all([
        fetchEmployee(eid),
        fetchHRDepartments(),
        fetchHRCategories(),
        fetchSalaryItems(Number(eid)),
        fetchSalaryTemplates(),
        fetchEmployeeDocuments(eid)
      ]);

      if (!emp) {
          toast({ title: "Not Found", description: "Employee record not found", variant: "destructive" });
          router.push("/hrm/employees");
          return;
      }

      setEmployee(emp);
      setFormData(emp);
      setDepartments(depts);
      setCategories(cats);
      setSalaryItems(items);
      setGlobalSchemes(Array.isArray(schemes) ? schemes : []);
      setDocuments(docs);
    } catch (err) {
      toast({ title: "Sync Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void loadAll();
  }, [id]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
        // 1. Upload Avatar if staged
        if (tempAvatarFile) {
            setUploadingAvatar(true);
            const body = new FormData();
            body.append('file', tempAvatarFile);
            body.append('employee_id', String(employee!.id));
            
            const res = await api('/api/employee/upload_avatar', { 
                method: 'POST', 
                body,
                headers: {}
            });
            if (!res.ok) throw new Error("Avatar upload failed");
            setUploadingAvatar(false);
            setTempAvatarFile(null);
            setAvatarPreview(null);
        }

        // 2. Update other profile fields
        await updateEmployee(employee!.id, formData);
        toast({ title: "Success", description: "Personnel profile updated and synchronized" });
        void loadAll();
    } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
        setSaving(false);
        setUploadingAvatar(false);
    }
  };

  const handleAddSalaryItem = async () => {
      if (!newSalaryItem.name || !newSalaryItem.amount) return;
      try {
          await saveSalaryItem({ ...newSalaryItem, employee_id: employee!.id, is_recurring: 1 });
          setNewSalaryItem({ name: "", amount: 0, type: "Allowance" });
          const items = await fetchSalaryItems(employee!.id);
          setSalaryItems(items);
          toast({ title: "Added" });
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      }
  };

  const handleApplyScheme = async () => {
      if (!applyingSchemeId) return;
      try {
          await applySalaryTemplateToEmployee(employee!.id, Number(applyingSchemeId));
          setApplyingSchemeId("");
          const items = await fetchSalaryItems(employee!.id);
          setSalaryItems(items);
          toast({ title: "Scheme Applied" });
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      }
  };

  const handleRemoveSalaryItem = async (sid: number) => {
      try {
          await deleteSalaryItem(sid);
          const items = await fetchSalaryItems(employee!.id);
          setSalaryItems(items);
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !employee) return;
      
      setTempAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      toast({ title: "Photo Staged", description: "Click Save Profile to finalize upload." });
  };

  const handleFileUpload = async () => {
      if (!newDoc.file || !newDoc.title) return;
      setUploading(true);
      try {
          const body = new FormData();
          body.append('file', newDoc.file);
          body.append('title', newDoc.title);
          body.append('employee_id', String(employee!.id));

          const res = await api('/api/hrdocument/upload', { 
            method: 'POST', 
            body, 
            headers: {} // API client will handle boundary for FormData if headers empty
          });

          if (!res.ok) throw new Error("Upload failed");
          
          toast({ title: "Document Saved" });
          setNewDoc({ title: "", file: null });
          setSelectedPreset("");
          const docs = await fetchEmployeeDocuments(employee!.id);
          setDocuments(docs);
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      } finally {
          setUploading(false);
      }
  };

  const handleDeleteDoc = async (did: number) => {
      if (!confirm("Are you sure?")) return;
      try {
          await deleteEmployeeDocument(did);
          const docs = await fetchEmployeeDocuments(employee!.id);
          setDocuments(docs);
      } catch (err) {
          toast({ title: "Error", description: (err as Error).message });
      }
  };

  if (loading) {
      return (
          <DashboardLayout>
              <div className="flex flex-col items-center justify-center h-[60vh]">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">Opening personnel file...</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full p-2 md:p-4 lg:p-6">
        {/* Standardized Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Personnel Record #{employee?.employee_code || id}</h1>
              <p className="text-muted-foreground mt-1 font-medium">{employee?.first_name} {employee?.last_name} • {employee?.designation || "Employee"}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <a href="/hrm/employees">All Employees</a>
          </Button>
        </div>

        <Card className="border-none shadow-xl overflow-hidden bg-card rounded-2xl border border-border/60">
          <CardHeader className="bg-card border-b border-border/40 py-6 px-8">
            <CardTitle className="text-xl font-bold text-foreground">Personnel Profile</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">Detailed identity, role, and status management.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
            <Tabs defaultValue="general" className="space-y-8">
                <TabsList className="bg-muted/50 p-1 rounded-xl gap-1">
                    <TabsTrigger value="general" className="rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">General Profile</TabsTrigger>
                    <TabsTrigger value="contact" className="rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Contact Hub</TabsTrigger>
                    <TabsTrigger value="salary" className="rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Financial Vault</TabsTrigger>
                    <TabsTrigger value="documents" className="rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Media Archive</TabsTrigger>
                </TabsList>

                {/* GENERAL PROFILE TAB */}
                <TabsContent value="general" className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Identity Card */}
                    <div className="lg:col-span-4">
                        <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
                        <div className="h-[260px] rounded-xl border border-border bg-card shadow-inner overflow-hidden flex items-center justify-center relative group">
                            {avatarPreview || employee?.avatar_url ? (
                            <img src={avatarPreview || contentUrl('employees', employee!.avatar_url!)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                            <div className="text-muted/30 flex flex-col items-center gap-3">
                                <User className="w-16 h-16 opacity-20" />
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">No Identity Captured</div>
                            </div>
                            )}
                            {avatarPreview && (
                                <div className="absolute top-3 right-3 bg-primary text-white text-[8px] font-black uppercase px-2 py-1 rounded-md shadow-lg animate-pulse z-20">
                                    Staged
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors pointer-events-none" />
                        </div>
                        
                        <div className="space-y-3">
                            <input 
                                type="file" 
                                ref={avatarInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleAvatarChange} 
                            />
                            <Button variant="outline" className={`gap-2 w-full h-11 rounded-xl border-border bg-card hover:bg-muted transition-all font-bold text-xs uppercase tracking-widest shadow-sm ${avatarPreview ? "text-primary border-primary/40 bg-primary/5" : "text-muted-foreground"}`} onClick={() => avatarInputRef.current?.click()} disabled={saving || uploadingAvatar}>
                            {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className={`w-4 h-4 ${avatarPreview ? "text-primary" : "text-primary"}`} />}
                            {uploadingAvatar ? "Syncing..." : avatarPreview ? "Change Staged Photo" : "Upload Photo"}
                            </Button>

                            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Employee Code</span>
                                    <span className="text-sm font-mono font-bold text-foreground">{employee?.employee_code}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">National ID</span>
                                    <span className="text-sm font-bold text-foreground/80">{employee?.nic || "—"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Registry (EPF)</span>
                                    <span className="text-sm font-bold text-foreground/80">{employee?.epf_no || "—"}</span>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* Right Side Input Grid */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Status Select with Accent */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Status</Label>
                            <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                            <SelectTrigger className="font-bold border-amber-500/30 bg-amber-500/10 h-11 rounded-xl focus:ring-0 text-amber-600 dark:text-amber-400">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active" className="font-bold">Active (Operational)</SelectItem>
                                <SelectItem value="Inactive" className="font-bold">Inactive</SelectItem>
                                <SelectItem value="Resigned" className="font-bold">Resigned</SelectItem>
                                <SelectItem value="Terminated" className="font-bold">Terminated</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>

                        {/* Department Select with Accent */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Department</Label>
                            <Select value={String(formData.department_id || "")} onValueChange={(v) => setFormData({ ...formData, department_id: Number(v) })}>
                            <SelectTrigger className="font-bold border-blue-500/30 bg-blue-500/10 h-11 rounded-xl focus:ring-0 text-blue-600 dark:text-blue-400">
                                <SelectValue placeholder="Select dept..." />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(d => (
                                <SelectItem key={d.id} value={String(d.id)} className="font-bold">{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>

                        {/* Category Select with Accent */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Personnel Category</Label>
                            <Select value={String(formData.category_id || "")} onValueChange={(v) => setFormData({ ...formData, category_id: Number(v) })}>
                            <SelectTrigger className="font-bold border-green-500/30 bg-green-500/10 h-11 rounded-xl focus:ring-0 text-green-600 dark:text-green-400">
                                <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(c => (
                                <SelectItem key={c.id} value={String(c.id)} className="font-bold">{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">First Name</Label>
                            <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all font-medium text-foreground" value={formData.first_name} onChange={e=>setFormData({...formData, first_name: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Last Name</Label>
                            <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all font-medium text-foreground" value={formData.last_name} onChange={e=>setFormData({...formData, last_name: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Designation</Label>
                            <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all font-bold text-foreground" value={formData.designation || ""} onChange={e=>setFormData({...formData, designation: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Date of Birth</Label>
                            <Input type="date" className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all font-medium text-foreground" value={formData.dob || ""} onChange={e=>setFormData({...formData, dob: e.target.value})} />
                            <div className="text-[10px] text-muted-foreground/60 ml-1">Required for retirement tracking</div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Gender</Label>
                            <Select value={formData.gender || "Other"} onValueChange={v=>setFormData({...formData, gender: v as any})}>
                            <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card transition-all">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Blood Group</Label>
                            <Select value={formData.blood_group || ""} onValueChange={v=>setFormData({...formData, blood_group: v})}>
                                <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card transition-all font-bold">
                                <SelectValue placeholder="Chose..." />
                                </SelectTrigger>
                                <SelectContent>
                                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Nationality</Label>
                            <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all" value={formData.nationality || ""} onChange={e=>setFormData({...formData, nationality: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Religion / Belief</Label>
                            <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card focus:border-primary transition-all" value={formData.religion || ""} onChange={e=>setFormData({...formData, religion: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Marital Status</Label>
                            <Select value={formData.marital_status || "Single"} onValueChange={v=>setFormData({...formData, marital_status: v as any})}>
                            <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card transition-all">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Single">Single</SelectItem>
                                <SelectItem value="Married">Married</SelectItem>
                                <SelectItem value="Divorced">Divorced</SelectItem>
                                <SelectItem value="Widowed">Widowed</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/40">
                        <Button variant="outline" className="h-12 px-6 rounded-xl font-bold text-muted-foreground border-border hover:bg-muted" onClick={() => void loadAll()} disabled={saving}>
                            Reload
                        </Button>
                        <Button className="h-12 px-8 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-md gap-2" onClick={handleSaveProfile} disabled={saving}>
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Save Profile
                        </Button>
                        <Button variant="destructive" className="h-12 px-6 rounded-xl font-bold shadow-md gap-2" disabled={saving}>
                            <Trash className="w-4 h-4" />
                            Archive
                        </Button>
                        </div>
                    </div>
                    </div>
                </TabsContent>

                {/* CONTACT HUB TAB */}
                <TabsContent value="contact" className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Primary Phone</Label>
                                    <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card font-bold text-primary shadow-sm" value={formData.phone || ""} onChange={e=>setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Corporate Email</Label>
                                    <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card font-medium shadow-sm" value={formData.email || ""} onChange={e=>setFormData({...formData, email: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Residential Address</Label>
                                    <Input className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card shadow-sm" value={formData.address || ""} onChange={e=>setFormData({...formData, address: e.target.value})} />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-border/40">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                                    <Globe className="w-3.5 h-3.5" /> Social Connect
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">LinkedIn</Label>
                                        <Input placeholder="linkedin.com/in/..." className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card text-sm" value={formData.linkedin_url || ""} onChange={e=>setFormData({...formData, linkedin_url: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">Facebook</Label>
                                        <Input placeholder="facebook.com/..." className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card text-sm" value={formData.facebook_url || ""} onChange={e=>setFormData({...formData, facebook_url: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">X (Twitter)</Label>
                                        <Input placeholder="twitter.com/..." className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card text-sm" value={formData.twitter_url || ""} onChange={e=>setFormData({...formData, twitter_url: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">Instagram</Label>
                                        <Input placeholder="instagram.com/..." className="h-11 rounded-xl bg-muted/40 border-border focus:bg-card text-sm" value={formData.instagram_url || ""} onChange={e=>setFormData({...formData, instagram_url: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-1">
                            <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-6 space-y-4">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-rose-600 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" /> Emergency SOS
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 ml-1">Guardian Name</Label>
                                        <Input className="h-10 rounded-xl bg-card border-rose-500/20 focus:border-rose-500/40 font-bold text-foreground shadow-sm" value={formData.emergency_contact_name || ""} onChange={e=>setFormData({...formData, emergency_contact_name: e.target.value})} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 ml-1">Relationship</Label>
                                        <Input className="h-10 rounded-xl bg-card border-rose-500/20 focus:border-rose-500/40 font-medium text-foreground/80 shadow-sm" value={formData.emergency_contact_relationship || ""} onChange={e=>setFormData({...formData, emergency_contact_relationship: e.target.value})} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 ml-1">SOS Phone</Label>
                                        <Input className="h-10 rounded-xl bg-card border-rose-500/30 focus:border-rose-500/50 font-mono font-bold text-rose-600 dark:text-rose-400 shadow-sm text-lg" value={formData.emergency_contact_phone || ""} onChange={e=>setFormData({...formData, emergency_contact_phone: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>
                </TabsContent>

                {/* FINANCIAL VAULT TAB */}
                <TabsContent value="salary" className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-8 space-y-8">
                             {/* Compensation Grid */}
                             <div className="grid grid-cols-12 gap-4 items-end bg-muted/30 p-6 rounded-2xl border border-border/40">
                                <div className="col-span-12 md:col-span-5 space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Component Name</Label>
                                    <Input placeholder="e.g. Travel Allowance" className="h-11 rounded-xl bg-card border-border shadow-sm focus:border-primary" value={newSalaryItem.name} onChange={e=>setNewSalaryItem({...newSalaryItem, name: e.target.value})} />
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Value (LKR)</Label>
                                    <Input type="number" className="h-11 rounded-xl bg-card border-border shadow-sm font-mono font-bold text-foreground focus:border-primary" value={newSalaryItem.amount} onChange={e=>setNewSalaryItem({...newSalaryItem, amount: Number(e.target.value)})} />
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-2">
                                    <Label className="text-[11px] font-bold text-muted-foreground ml-1">Type</Label>
                                    <Select value={newSalaryItem.type} onValueChange={v=>setNewSalaryItem({...newSalaryItem, type: v as any})}>
                                        <SelectTrigger className="h-11 rounded-xl bg-card border-border shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Allowance">Allowance (+)</SelectItem>
                                            <SelectItem value="Deduction">Deduction (-)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-12 md:col-span-1">
                                    <Button size="icon" className="h-11 w-11 rounded-xl bg-primary shadow-md hover:bg-primary/90 transition-all text-white" onClick={handleAddSalaryItem}>
                                        <Plus className="w-5 h-5 font-bold" />
                                    </Button>
                                </div>
                             </div>

                             {/* Compensation Table: Matching "Stored Batches" aesthetic */}
                             <div className="space-y-4">
                                <h3 className="text-sm font-bold text-foreground">Compensation Stack</h3>
                                <div className="rounded-2xl border border-border/40 overflow-hidden shadow-sm bg-card">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="h-12 border-b border-border/40">
                                                <TableHead className="px-6 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Component</TableHead>
                                                <TableHead className="px-6 font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-right">Value (LKR)</TableHead>
                                                <TableHead className="w-20 px-6"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="h-14 border-b border-border/40 bg-primary/5 hover:bg-primary/10 transition-colors">
                                                <TableCell className="px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(41,82,163,0.5)]" />
                                                        <span className="font-extrabold text-[11px] uppercase tracking-wider text-foreground">Base Monthly Salary</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 text-right font-mono font-bold text-sm text-foreground">
                                                    {Number(formData.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="px-6"></TableCell>
                                            </TableRow>
                                            {salaryItems.map(item => (
                                                <TableRow key={item.id} className="group h-14 border-b border-border/40 hover:bg-muted/50 transition-all">
                                                    <TableCell className="px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${item.type === 'Allowance' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-tight group-hover:text-foreground transition-colors">{item.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={`px-6 text-right font-mono font-bold text-sm ${item.type === 'Deduction' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                                        {item.type === 'Deduction' ? '-' : '+'}
                                                        {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="px-6 text-right">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg" onClick={()=>handleRemoveSalaryItem(item.id)}>
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                             </div>
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                             <div className="rounded-2xl border border-border/40 bg-muted/20 p-6 space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Wand2 className="w-4 h-4 text-primary" /> Stack Automation
                                    </h3>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">Predefined Schemes</Label>
                                        <Select value={applyingSchemeId} onValueChange={setApplyingSchemeId}>
                                            <SelectTrigger className="h-11 bg-card border-border rounded-xl shadow-sm">
                                                <SelectValue placeholder="Choose a scheme..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {globalSchemes.map(s=><SelectItem key={s.id} value={String(s.id)} className="font-bold">{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button className="w-full h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-slate-900 dark:bg-slate-100 dark:text-slate-950 text-white hover:bg-slate-800 transition-all shadow-md" onClick={handleApplyScheme} disabled={!applyingSchemeId}>
                                        Apply Stack
                                    </Button>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-border/40">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-primary" /> Settlement Channel
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Beneficiary Bank</Label>
                                            <Input className="h-11 rounded-xl bg-card border-border shadow-sm font-bold text-foreground focus:border-primary" value={formData.bank_name || ""} onChange={e=>setFormData({...formData, bank_name: e.target.value})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Dispatch Account No</Label>
                                            <Input className="h-11 rounded-xl bg-card border-border shadow-sm font-mono font-bold text-primary focus:border-primary tracking-wider" value={formData.bank_account_no || ""} onChange={e=>setFormData({...formData, bank_account_no: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                {/* DOCUMENTS TAB */}
                <TabsContent value="documents" className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                        {/* Upload Card */}
                        <div className="md:col-span-4 space-y-6">
                            <div className="rounded-2xl border border-border/40 bg-card shadow-lg p-6 space-y-6 h-fit sticky top-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-primary" /> Vault Deposit
                                </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold text-muted-foreground ml-1">Document Type</Label>
                                            <Select value={selectedPreset} onValueChange={(val) => {
                                                setSelectedPreset(val);
                                                if (val !== "Other (Custom)") {
                                                    setNewDoc(prev => ({ ...prev, title: val }));
                                                } else {
                                                    setNewDoc(prev => ({ ...prev, title: "" }));
                                                }
                                            }}>
                                                <SelectTrigger className="h-11 rounded-xl border-border bg-muted/30 focus:bg-card transition-all shadow-sm font-medium">
                                                    <SelectValue placeholder="Select type..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-border shadow-xl">
                                                    {DOCUMENT_PRESETS.map(p => (
                                                        <SelectItem key={p} value={p} className="text-xs font-bold uppercase tracking-tight py-2.5">{p}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedPreset === "Other (Custom)" && (
                                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                <Label className="text-[11px] font-bold text-muted-foreground ml-1">Custom Label</Label>
                                                <Input 
                                                    placeholder="e.g. Health Certificate" 
                                                    className="h-11 rounded-xl border-border bg-muted/30 focus:bg-card transition-all shadow-sm font-medium" 
                                                    value={newDoc.title} 
                                                    onChange={e=>setNewDoc({...newDoc, title: e.target.value})} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground ml-1">File Source</Label>
                                        <div className={`relative h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden group ${newDoc.file ? 'border-primary bg-primary/5' : 'border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-primary/20'}`}>
                                            <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e=>setNewDoc({...newDoc, file: e.target.files?.[0] || null})} />
                                            {newDoc.file ? (
                                                <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
                                                    <div className="bg-card w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-primary/20">
                                                        <FileText className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div className="text-center px-4">
                                                        <p className="text-[10px] font-black text-foreground truncate max-w-[180px] uppercase tracking-tighter">{newDoc.file.name}</p>
                                                        <p className="text-[9px] text-primary font-bold uppercase mt-0.5">Ready for Vault</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 rounded-lg bg-card border border-border/40 text-[9px] font-bold uppercase tracking-widest hover:text-rose-600 z-20" onClick={(e) => { e.stopPropagation(); setNewDoc({...newDoc, file: null}); }}>
                                                        <X className="w-3 h-3 mr-1" /> Remove
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-12 h-12 rounded-full bg-card border border-border/40 flex items-center justify-center shadow-sm">
                                                        <Plus className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Select Archive File</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-primary text-white shadow-xl hover:bg-primary/90 transition-all gap-2" onClick={handleFileUpload} disabled={uploading || !newDoc.file || !newDoc.title}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                        {(!newDoc.file || !newDoc.title) && !uploading ? "Awaiting Data" : "Vault Document"}
                                    </Button>
                                </div>
                            </div>

                        {/* Document List */}
                        <div className="md:col-span-8 space-y-6">
                            <div className="flex items-center gap-4 bg-muted/30 p-6 rounded-2xl border border-border/40 h-20 shadow-inner">
                                 <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center text-primary border border-border/40 shadow-sm">
                                    <FileText className="w-5 h-5" />
                                 </div>
                                 <div className="flex-1">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Digital Evidence Vault</h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight opacity-70">Verified personnel credentials and archived records</p>
                                 </div>
                                 <Badge variant="outline" className="h-7 px-3 rounded-lg bg-card border-border text-muted-foreground uppercase font-black text-[9px] tracking-widest">
                                    {documents.length} Items
                                 </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {documents.map(doc => (
                                    <Card key={doc.id} className="border border-border/40 shadow-sm bg-card rounded-2xl overflow-hidden group hover:border-primary/20 hover:shadow-md transition-all duration-300">
                                        <CardContent className="p-0 flex items-center h-20">
                                            <div className="w-20 h-full bg-muted/20 flex items-center justify-center border-r border-border/40 shrink-0 group-hover:bg-primary/5 transition-colors">
                                                <FileText className="w-8 h-8 text-muted-foreground/30 group-hover:text-primary transition-colors duration-500" />
                                            </div>
                                            <div className="flex-1 px-5 min-w-0">
                                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-foreground truncate group-hover:text-primary transition-colors">{doc.title}</h4>
                                                <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
                                                   <Calendar className="w-3.5 h-3.5 opacity-50" />
                                                   <span>Archived {new Date(doc.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="px-5 flex gap-2">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border/40 text-muted-foreground/40 hover:text-primary hover:bg-muted/50 hover:shadow-sm transition-all" onClick={()=>window.open(contentUrl('documents', doc.file_path), '_blank')}>
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border/40 text-muted-foreground/40 hover:text-rose-600 hover:bg-rose-500/10 transition-all" onClick={()=>handleDeleteDoc(doc.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {documents.length === 0 && (
                                    <div className="col-span-full py-24 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center group hover:bg-muted/30 transition-all duration-500">
                                        <div className="w-20 h-20 rounded-full bg-card border border-border/40 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                                            <Shield className="w-10 h-10 text-muted-foreground/30" />
                                        </div>
                                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Vault Partition Empty</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-2 bg-card px-4 py-1 rounded-full border border-border/40 italic">No credentials discovered</p>
                                    </div>
                                )}
                            </div>
                        </div>
                     </div>
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

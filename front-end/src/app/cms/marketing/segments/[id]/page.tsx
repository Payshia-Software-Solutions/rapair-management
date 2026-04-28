"use client";

import React, { useState, useEffect, use } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchSmsSegmentDetails, 
  importSmsContacts,
  updateSmsContact,
  deleteSmsContact
} from "@/lib/api";
import { 
  Users, 
  Plus, 
  FileUp, 
  Download, 
  Loader2, 
  ArrowLeft,
  Search,
  Smartphone,
  Mail,
  User,
  Trash2,
  Table as TableIcon,
  Pencil,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function SegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [segment, setSegment] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deletingContact, setDeletingContact] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSmsSegmentDetails(id);
      if (data) {
        setSegment(data.segment);
        setContacts(data.contacts);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.phone) return;
    setSubmitting(true);
    try {
      await importSmsContacts({ 
        segment_id: parseInt(id), 
        contacts: [newContact] 
      });
      toast({ title: "Success", description: "Contact added successfully." });
      setIsManualModalOpen(false);
      setNewContact({ name: "", phone: "", email: "" });
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const csvContacts = lines.slice(1).map(line => {
        const parts = line.split(',');
        return { 
          name: parts[0]?.trim(), 
          phone: parts[1]?.trim(), 
          email: parts[2]?.trim() 
        };
      }).filter(c => c.phone);

      try {
        setSubmitting(true);
        await importSmsContacts({ 
          segment_id: parseInt(id), 
          contacts: csvContacts 
        });
        toast({ title: "Success", description: `Imported ${csvContacts.length} contacts.` });
        load();
      } catch (err: any) {
        toast({ title: "Import Failed", description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact.phone) return;
    setSubmitting(true);
    try {
      await updateSmsContact(editingContact);
      toast({ title: "Success", description: "Contact updated successfully." });
      setIsEditModalOpen(false);
      setEditingContact(null);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingContact) return;
    setSubmitting(true);
    try {
      await deleteSmsContact(deletingContact.id);
      toast({ title: "Deleted", description: "Contact removed from segment." });
      setIsDeleteModalOpen(false);
      setDeletingContact(null);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8,Full Name,Phone Number,Email Address\nJohn Doe,94771234567,john@example.com\nJane Smith,94777654321,jane@example.com";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sms_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredContacts = contacts.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !segment) {
    return (
      <DashboardLayout>
        <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin opacity-20" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 w-full mx-auto">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/cms/marketing/segments"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
              {segment?.name}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Managing contacts for this targeted audience</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar / Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="text-sm font-black uppercase tracking-widest opacity-80">Segment Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
                  <p className="text-sm font-medium">{segment?.description || "No description provided."}</p>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Contacts</span>
                    <span className="text-2xl font-black">{contacts.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest opacity-80">Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button onClick={() => setIsManualModalOpen(true)} className="w-full justify-start font-bold gap-3 h-12 rounded-2xl" variant="outline">
                  <Plus className="w-5 h-5 text-primary" /> Add Manually
                </Button>
                
                <label className="block w-full">
                  <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                  <div className="w-full flex items-center justify-start gap-3 h-12 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 px-4 cursor-pointer hover:bg-primary/10 transition-colors text-sm font-bold text-primary">
                    <FileUp className="w-5 h-5" /> Import CSV List
                  </div>
                </label>

                <Button onClick={downloadSample} variant="ghost" className="w-full justify-start font-bold gap-3 h-12 rounded-2xl text-muted-foreground">
                  <Download className="w-5 h-5" /> Get Sample Format
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contacts List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <Input 
                  placeholder="Search contacts in this segment..." 
                  className="pl-11 h-12 bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <div className="overflow-auto max-h-[700px]">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Contact Info</th>
                      <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Phone Number</th>
                      <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Email</th>
                      <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-20 text-center text-muted-foreground font-medium italic">
                          No contacts found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map(contact => (
                        <tr key={contact.id} className="hover:bg-muted/10 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center font-black text-primary uppercase">
                                {contact.name ? contact.name.charAt(0) : <User className="w-5 h-5" />}
                              </div>
                              <p className="font-black uppercase tracking-tight">{contact.name || "UNNAMED"}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 font-mono font-bold text-sm">
                              <Smartphone className="w-3 h-3 text-primary opacity-50" />
                              {contact.phone}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground">
                              <Mail className="w-3 h-3 opacity-50" />
                              {contact.email || "-"}
                            </div>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <Button 
                              onClick={() => {
                                setEditingContact(contact);
                                setIsEditModalOpen(true);
                              }}
                              variant="ghost" 
                              size="icon" 
                              className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              onClick={() => {
                                setDeletingContact(contact);
                                setIsDeleteModalOpen(true);
                              }}
                              variant="ghost" 
                              size="icon" 
                              className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Add Contact Manually</DialogTitle>
            <DialogDescription className="font-medium">Directly add a new contact to this targeted list.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualAdd} className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
              <Input 
                placeholder="e.g. John Doe"
                className="h-12 rounded-xl font-bold"
                value={newContact.name}
                onChange={e => setNewContact({...newContact, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number *</label>
              <Input 
                placeholder="e.g. 94771234567"
                className="h-12 rounded-xl font-bold font-mono"
                value={newContact.phone}
                required
                onChange={e => setNewContact({...newContact, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
              <Input 
                placeholder="e.g. john@example.com"
                className="h-12 rounded-xl font-bold"
                type="email"
                value={newContact.email}
                onChange={e => setNewContact({...newContact, email: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-black uppercase tracking-tight shadow-lg shadow-primary/20">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Contact to List"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Contact</DialogTitle>
            <DialogDescription className="font-medium">Update the details for this contact in the segment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
              <Input 
                placeholder="e.g. John Doe"
                className="h-12 rounded-xl font-bold"
                value={editingContact?.name || ""}
                onChange={e => setEditingContact({...editingContact, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number *</label>
              <Input 
                placeholder="e.g. 94771234567"
                className="h-12 rounded-xl font-bold font-mono"
                value={editingContact?.phone || ""}
                required
                onChange={e => setEditingContact({...editingContact, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
              <Input 
                placeholder="e.g. john@example.com"
                className="h-12 rounded-xl font-bold"
                type="email"
                value={editingContact?.email || ""}
                onChange={e => setEditingContact({...editingContact, email: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-black uppercase tracking-tight shadow-lg shadow-primary/20">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-500">Remove Contact?</DialogTitle>
            <DialogDescription className="font-medium">
              Are you sure you want to remove <span className="font-black text-foreground">{deletingContact?.name || deletingContact?.phone}</span> from this segment? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-6 gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="font-bold h-12 rounded-xl px-6">
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={submitting}
              className="bg-rose-500 hover:bg-rose-600 font-black uppercase tracking-tight h-12 rounded-xl px-8 shadow-lg shadow-rose-200"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, Remove Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

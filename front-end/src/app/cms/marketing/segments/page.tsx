"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchSmsSegments, 
  createSmsSegment, 
  updateSmsSegment,
  deleteSmsSegment
} from "@/lib/api";
import { 
  Users, 
  Plus, 
  FileUp, 
  Download, 
  Loader2, 
  MoreVertical,
  Trash2,
  Eye,
  Filter,
  Search,
  MessageSquare,
  Pencil,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function SegmentsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [newSegment, setNewSegment] = useState({ name: "", description: "" });
  const [editingSegment, setEditingSegment] = useState<any>(null);
  const [deletingSegment, setDeletingSegment] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSmsSegments();
      setSegments(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegment.name) return;
    setSubmitting(true);
    try {
      await createSmsSegment(newSegment);
      toast({ title: "Success", description: "Segment created successfully." });
      setIsCreateModalOpen(false);
      setNewSegment({ name: "", description: "" });
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSegment?.name) return;
    setSubmitting(true);
    try {
      await updateSmsSegment(editingSegment);
      toast({ title: "Success", description: "Segment updated successfully." });
      setIsEditModalOpen(false);
      setEditingSegment(null);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSegment) return;
    setSubmitting(true);
    try {
      await deleteSmsSegment(deletingSegment.id);
      toast({ title: "Deleted", description: "Segment removed successfully." });
      setIsDeleteModalOpen(false);
      setDeletingSegment(null);
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

  const filtered = segments.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Filter className="w-8 h-8 text-primary" />
              Audience Segments
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">Manage targeted lists for your marketing campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={downloadSample} variant="outline" className="font-bold gap-2">
              <Download className="w-4 h-4" /> Sample CSV
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)} className="font-bold gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Create Segment
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-md bg-primary text-primary-foreground">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Segments</p>
                <p className="text-3xl font-black">{segments.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-accent rounded-2xl">
                <FileUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Imported Contacts</p>
                <p className="text-3xl font-black">{segments.reduce((acc, s) => acc + parseInt(s.contact_count), 0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Campaigns</p>
                <p className="text-3xl font-black">Ready</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <Input 
              placeholder="Search segments by name or description..." 
              className="pl-11 h-12 bg-transparent border-none focus-visible:ring-0 text-base font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Segments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-10 h-10 opacity-20" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">No segments found</h3>
                <p className="text-muted-foreground font-medium">Create your first segment to start building targeted marketing lists.</p>
                <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="font-bold">
                  Create Segment Now
                </Button>
              </div>
            </div>
          ) : (
            filtered.map(segment => (
              <Card key={segment.id} className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden rounded-3xl">
                <div className="h-2 bg-primary group-hover:h-3 transition-all" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight line-clamp-1">{segment.name}</h3>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                        Created {new Date(segment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-black px-3 py-1 rounded-lg">
                      {segment.contact_count} LISTS
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[40px]">
                    {segment.description || "No description provided for this segment."}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Button asChild variant="secondary" className="flex-1 font-bold gap-2 rounded-xl h-11">
                      <Link href={`/cms/marketing/segments/${segment.id}`}>
                        <Eye className="w-4 h-4" /> Manage Contacts
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingSegment(segment);
                            setIsEditModalOpen(true);
                          }}
                          className="font-bold gap-2 p-3 rounded-lg cursor-pointer"
                        >
                          <Pencil className="w-4 h-4 text-primary" /> Edit Segment
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeletingSegment(segment);
                            setIsDeleteModalOpen(true);
                          }}
                          className="font-bold gap-2 p-3 rounded-lg cursor-pointer text-rose-500 focus:text-rose-600 focus:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete List
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Create New Segment</DialogTitle>
            <DialogDescription className="font-medium">Define a new audience for your marketing efforts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Segment Name</label>
              <Input 
                placeholder="e.g. High Value Customers"
                className="h-12 rounded-xl font-bold"
                value={newSegment.name}
                onChange={e => setNewSegment({...newSegment, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
              <Input 
                placeholder="e.g. Customers who spent more than 50,000 LKR"
                className="h-12 rounded-xl font-bold"
                value={newSegment.description}
                onChange={e => setNewSegment({...newSegment, description: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-black uppercase tracking-tight">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm & Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Segment</DialogTitle>
            <DialogDescription className="font-medium">Update the name and description of this list.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Segment Name</label>
              <Input 
                placeholder="e.g. High Value Customers"
                className="h-12 rounded-xl font-bold"
                value={editingSegment?.name || ""}
                onChange={e => setEditingSegment({...editingSegment, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
              <Input 
                placeholder="e.g. Customers who spent more than 50,000 LKR"
                className="h-12 rounded-xl font-bold"
                value={editingSegment?.description || ""}
                onChange={e => setEditingSegment({...editingSegment, description: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-black uppercase tracking-tight">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
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
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-500">Delete Segment?</DialogTitle>
            <DialogDescription className="font-medium">
              Are you sure you want to delete <span className="font-black text-foreground">"{deletingSegment?.name}"</span>? 
              This will also permanently remove all {deletingSegment?.contact_count} contacts associated with this list.
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
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

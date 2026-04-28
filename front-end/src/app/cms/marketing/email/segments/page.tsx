"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchSmsSegments,
  importSmsContacts,
  deleteSmsSegment,
  fetchCustomers,
  updateCustomer
} from "@/lib/api";
import { 
  Plus, 
  Users,
  ChevronDown,
  Trash2,
  FileUp,
  Loader2,
  Globe,
  MailWarning,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createSmsSegment } from "@/lib/api";

export default function AudienceSegmentsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ name: '', description: '' });
  
  const [viewMode, setViewMode] = useState<'segments' | 'contacts'>('segments');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const segs = await fetchSmsSegments();
      setSegments(segs);
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch(err) {
      toast({ title: "Error", description: "Failed to load global contacts." });
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => { load(); }, []);
  
  useEffect(() => {
    if (viewMode === 'contacts') {
      loadContacts();
    }
  }, [viewMode]);

  const toggleSubscription = async (customer: any) => {
    const newStatus = customer.is_unsubscribed ? 0 : 1;
    try {
      await updateCustomer(customer.id, { ...customer, is_unsubscribed: newStatus });
      setCustomers(customers.map(c => c.id === customer.id ? { ...c, is_unsubscribed: newStatus } : c));
      toast({ title: "Updated", description: `Customer ${newStatus ? 'unsubscribed' : 'subscribed'} successfully.` });
    } catch(err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Audience Segments" subtitle="Manage your target marketing lists">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Audience Segments</h2>
              <p className="text-muted-foreground text-xs">Targeted customer groups</p>
            </div>
          </div>
            <div className="flex bg-muted/30 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('segments')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'segments' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Segments
              </button>
              <button 
                onClick={() => setViewMode('contacts')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'contacts' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Global Contacts
              </button>
            </div>
            {viewMode === 'segments' && (
              <Button size="sm" className="h-9 px-4 rounded-lg font-bold text-xs gap-1.5" onClick={() => setIsSegmentModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> New Segment
              </Button>
            )}
          </div>
        
        {viewMode === 'segments' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {segments.map(seg => (
            <Card key={seg.id} className="border shadow-sm rounded-xl overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Users className="w-4 h-4" />
                  </div>
                  <Badge variant="secondary" className="rounded-md font-bold text-[10px]">{seg.contact_count} Contacts</Badge>
                </div>
                <div>
                  <h3 className="text-sm font-bold">{seg.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{seg.description || 'No description provided.'}</p>
                </div>
                <div className="pt-3 border-t flex gap-2">
                  <label className="flex-1">
                    <input type="file" className="hidden" accept=".csv" onChange={e => {
                      const file = e.target.files?.[0];
                      if(!file) return;
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const text = ev.target?.result as string;
                        const lines = text.split('\n');
                        const contacts = lines.slice(1).map(l => {
                          const [name, phone, email] = l.split(',');
                          return { name: name?.trim(), phone: phone?.trim(), email: email?.trim() };
                        }).filter(c => c.email);
                        setSubmitting(true);
                        try {
                          await importSmsContacts({ segment_id: seg.id, contacts });
                          toast({ title: "Import Successful", description: `Added ${contacts.length} contacts to ${seg.name}.` });
                          load();
                        } catch (err: any) {
                          toast({ title: "Import Failed", description: err.message, variant: "destructive" });
                        } finally {
                          setSubmitting(false);
                        }
                      };
                      reader.readAsText(file);
                    }} />
                    <div className="w-full h-9 bg-muted rounded-lg flex items-center justify-center font-bold text-[10px] cursor-pointer hover:bg-muted/80 transition-all gap-1.5">
                      <FileUp className="w-3.5 h-3.5" /> Import CSV
                    </div>
                  </label>
                  <Button variant="ghost" size="sm" className="h-9 w-9 rounded-lg p-0 hover:bg-rose-50 text-rose-500" onClick={async () => {
                    if(!confirm("Are you sure?")) return;
                    await deleteSmsSegment(seg.id);
                    load();
                  }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {segments.length === 0 && !loading && (
            <div className="col-span-full py-16 text-center bg-muted/10 rounded-xl border-2 border-dashed opacity-50 text-sm font-bold">No custom segments created.</div>
          )}
        </div>
        ) : (
          <Card className="border shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loadingContacts ? (
                <div className="p-20 flex flex-col items-center justify-center gap-4 opacity-50">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="font-bold text-xs uppercase tracking-widest">Loading global contacts...</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground">Customer</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground">Contact Info</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground text-center">Subscription Status</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground text-center">Unsubscribe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                              {c.name?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-medium">{c.email || 'No email'}</p>
                          <p className="text-[10px] text-muted-foreground">{c.phone || 'No phone'}</p>
                        </td>
                        <td className="p-4 text-center">
                          {c.is_unsubscribed ? (
                            <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[9px] font-bold gap-1">
                              <XCircle className="w-3 h-3" /> Unsubscribed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[9px] font-bold gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Subscribed
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <Switch 
                            checked={c.is_unsubscribed ? true : false} 
                            onCheckedChange={() => toggleSubscription(c)} 
                          />
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center opacity-50 text-sm">No customers found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Segment Modal */}
      <Dialog open={isSegmentModalOpen} onOpenChange={setIsSegmentModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Segment</DialogTitle>
            <DialogDescription>Define a new audience group for your campaigns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Segment Name</label>
              <Input 
                placeholder="e.g. High Value Customers" 
                value={newSegment.name}
                onChange={e => setNewSegment({ ...newSegment, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Description</label>
              <Textarea 
                placeholder="Briefly describe this audience..." 
                value={newSegment.description}
                onChange={e => setNewSegment({ ...newSegment, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSegmentModalOpen(false)}>Cancel</Button>
            <Button 
              disabled={submitting || !newSegment.name}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await createSmsSegment(newSegment);
                  toast({ title: "Success", description: "Segment created successfully." });
                  setIsSegmentModalOpen(false);
                  setNewSegment({ name: '', description: '' });
                  load();
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

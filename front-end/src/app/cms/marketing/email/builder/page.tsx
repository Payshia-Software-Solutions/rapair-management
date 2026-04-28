"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchEmailTemplates,
  fetchSmsSegments,
  sendEmailCampaign,
  fetchSegmentContacts
} from "@/lib/api";
import { 
  Send, 
  ChevronDown,
  Loader2,
  Users,
  Settings2,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { compileEmailHtml } from "../utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function CampaignBuilderPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const initialName = searchParams.get('name') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentContacts, setSegmentContacts] = useState<any[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const [advancedCampaign, setAdvancedCampaign] = useState({
    name: initialName,
    subjectA: "",
    subjectB: "",
    segment: "all",
    enableTracking: true,
    isAbTest: false,
    selectedTemplateId: templateId ? parseInt(templateId) : null as number | null,
    includeUnsubscribe: true,
    includeViewInBrowser: false,
    permissionReminderText: "You are receiving this email because you subscribed to our newsletter.",
    senderAddress: "123 Business Rd, Colombo, Sri Lanka"
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tmpls, segs] = await Promise.all([
          fetchEmailTemplates(),
          fetchSmsSegments()
        ]);
        setTemplates(tmpls);
        setSegments(segs);
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  useEffect(() => {
    if (advancedCampaign.segment) {
      loadSegmentContacts(advancedCampaign.segment);
    }
  }, [advancedCampaign.segment]);

  const loadSegmentContacts = async (segmentId: string) => {
    setIsLoadingContacts(true);
    try {
      const data = await fetchSegmentContacts(segmentId);
      setSegmentContacts(data);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load segment contacts." });
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const launchAdvancedCampaign = async () => {
    if (!advancedCampaign.name || !advancedCampaign.subjectA) {
      toast({ title: "Missing Info", description: "Campaign name and primary subject are required.", variant: "destructive" });
      return;
    }
    
    const template = templates.find(t => t.id === advancedCampaign.selectedTemplateId);
    if (!template) {
      toast({ title: "Error", description: "Template not found.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Compile JSON blocks to HTML format
      let blocks = [];
      try {
        blocks = JSON.parse(template.content);
      } catch (e) {
        toast({ title: "Template Error", description: "This template contains invalid layout data.", variant: "destructive" });
        return;
      }

      const compiledHtml = compileEmailHtml(blocks, {
        includeUnsubscribe: advancedCampaign.includeUnsubscribe,
        includeViewInBrowser: advancedCampaign.includeViewInBrowser,
        permissionReminderText: advancedCampaign.permissionReminderText
      });

      await sendEmailCampaign({
        name: advancedCampaign.name,
        subject: advancedCampaign.subjectA,
        segment: advancedCampaign.segment,
        content: compiledHtml, // Send the COMPILED HTML now
        is_ab_test: advancedCampaign.isAbTest,
        subject_b: advancedCampaign.subjectB
      });
      toast({ title: "Campaign Launched!", description: "Your advanced campaign is being sent." });
      router.push('/cms/marketing/email/campaigns');
    } catch (err: any) {
      toast({ title: "Launch Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Campaign Builder" subtitle="Advanced broadcast configuration">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email/library')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Campaign Builder</h2>
              <p className="text-muted-foreground text-xs">Building: {advancedCampaign.name || 'Untitled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-7 px-3 rounded-md font-bold text-[10px]">
              {segmentContacts.length} Recipients
            </Badge>
            <Button size="sm" className="h-9 px-5 rounded-lg font-bold text-xs" onClick={launchAdvancedCampaign} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" /> Launch</>}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-4">
            <Card className="border shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-4">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" /> Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground">Campaign Name</label>
                  <Input value={advancedCampaign.name} onChange={e => setAdvancedCampaign({...advancedCampaign, name: e.target.value})} className="h-9 rounded-lg text-sm" placeholder="e.g. Summer Blowout 2026" />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground">Subject Line</label>
                  <Input value={advancedCampaign.subjectA} onChange={e => setAdvancedCampaign({...advancedCampaign, subjectA: e.target.value})} className="h-9 rounded-lg text-sm" placeholder="Enter subject..." />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
                  <div>
                    <span className="text-[11px] font-bold">A/B Subject Test</span>
                    <p className="text-[10px] text-muted-foreground">Test subject variants</p>
                  </div>
                  <Switch checked={advancedCampaign.isAbTest} onCheckedChange={val => setAdvancedCampaign({...advancedCampaign, isAbTest: val})} />
                </div>

                {advancedCampaign.isAbTest && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[11px] font-bold text-emerald-600">Variant Subject (B)</label>
                    <Input value={advancedCampaign.subjectB} onChange={e => setAdvancedCampaign({...advancedCampaign, subjectB: e.target.value})} className="h-9 rounded-lg text-sm border-emerald-500/20" placeholder="Alternative subject..." />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground">Audience Segment</label>
                  <Select value={advancedCampaign.segment} onValueChange={val => setAdvancedCampaign({...advancedCampaign, segment: val})}>
                    <SelectTrigger className="h-9 rounded-lg text-sm">
                      <SelectValue placeholder="Select Segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global Customer Base</SelectItem>
                      {segments.map(seg => (
                        <SelectItem key={seg.id} value={seg.id.toString()}>{seg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground">Selected Template</label>
                  <Select value={advancedCampaign.selectedTemplateId?.toString()} onValueChange={val => setAdvancedCampaign({...advancedCampaign, selectedTemplateId: parseInt(val)})}>
                    <SelectTrigger className="h-9 rounded-lg text-sm">
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(tmpl => (
                        <SelectItem key={tmpl.id} value={tmpl.id.toString()}>{tmpl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-4">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" /> Compliance (Anti-Spam)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold">Unsubscribe Link</span>
                    <p className="text-[10px] text-muted-foreground">Required by CAN-SPAM</p>
                  </div>
                  <Switch 
                    checked={advancedCampaign.includeUnsubscribe} 
                    onCheckedChange={val => setAdvancedCampaign({...advancedCampaign, includeUnsubscribe: val})} 
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-dashed">
                  <div>
                    <span className="text-[11px] font-bold">View in Browser Link</span>
                    <p className="text-[10px] text-muted-foreground">Add web version link at top</p>
                  </div>
                  <Switch 
                    checked={advancedCampaign.includeViewInBrowser} 
                    onCheckedChange={val => setAdvancedCampaign({...advancedCampaign, includeViewInBrowser: val})} 
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-dashed">
                  <label className="text-[11px] font-bold text-muted-foreground">Permission Reminder</label>
                  <Input 
                    value={advancedCampaign.permissionReminderText} 
                    onChange={e => setAdvancedCampaign({...advancedCampaign, permissionReminderText: e.target.value})} 
                    className="h-8 text-[10px] bg-muted/30" 
                    placeholder="e.g. You are receiving this because..."
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-dashed">
                  <label className="text-[11px] font-bold text-muted-foreground">Physical Address</label>
                  <Input 
                    value={advancedCampaign.senderAddress} 
                    onChange={e => setAdvancedCampaign({...advancedCampaign, senderAddress: e.target.value})} 
                    className="h-8 text-[10px] bg-muted/30" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm rounded-xl overflow-hidden bg-slate-900 text-white">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs">Dynamic Tags</h4>
                </div>
                <p className="text-[10px] text-slate-400">Use these in your subject line for personalization.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['{{customer_name}}', '{{city}}'].map(tag => (
                    <Badge key={tag} variant="outline" className="bg-white/5 border-white/10 text-white text-[9px] font-mono px-2 py-0.5 rounded-md">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8">
            <Card className="border shadow-sm rounded-xl overflow-hidden h-full flex flex-col">
              <CardHeader className="border-b p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Audience Preview
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600">Live</span>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                {isLoadingContacts ? (
                  <div className="p-20 flex flex-col items-center justify-center gap-4 opacity-50">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-black uppercase tracking-widest text-[10px]">Syncing Segment Data...</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b">
                        <th className="p-3 text-xs font-bold text-muted-foreground">Name</th>
                        <th className="p-3 text-xs font-bold text-muted-foreground">Email</th>
                        <th className="p-3 text-xs font-bold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {segmentContacts.map((contact, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-[9px] group-hover:bg-primary group-hover:text-white transition-colors">
                                {contact.name?.substring(0, 2)}
                              </div>
                              <span className="font-medium text-sm">{contact.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{contact.email}</td>
                          <td className="p-3">
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none rounded-md font-bold text-[9px]">Valid</Badge>
                          </td>
                        </tr>
                      ))}
                      {segmentContacts.length === 0 && !isLoadingContacts && (
                        <tr>
                          <td colSpan={3} className="p-10 text-center opacity-30 text-sm">No contacts in this segment.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

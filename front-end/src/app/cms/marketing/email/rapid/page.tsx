"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchSmsSegments,
  sendEmailCampaign
} from "@/lib/api";
import { 
  Send, 
  ChevronDown,
  Zap,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { compileEmailHtml } from "../utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function RapidSendPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [segments, setSegments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rapidData, setRapidData] = useState({ 
    subject: '', 
    content: '', 
    segment: 'all', 
    includeUnsubscribe: true,
    includeViewInBrowser: false,
    permissionReminderText: "You are receiving this email because you opted in to notifications.",
    senderAddress: "123 Business Rd, Colombo, Sri Lanka"
  });

  useEffect(() => {
    const load = async () => {
      try {
        const segs = await fetchSmsSegments();
        setSegments(segs);
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      }
    };
    load();
  }, [toast]);

  const handleLaunch = async () => {
    if(!rapidData.subject || !rapidData.content) return;
    setSubmitting(true);
    try {
      const blocks = [
        { id: '1', type: 'text' as const, content: { text: rapidData.content, textAlign: 'left' } }
      ];
      const html = compileEmailHtml(blocks, { 
        includeUnsubscribe: rapidData.includeUnsubscribe,
        includeViewInBrowser: rapidData.includeViewInBrowser,
        permissionReminderText: rapidData.permissionReminderText
      });
      
      await sendEmailCampaign({
        name: 'Rapid Broadcast',
        subject: rapidData.subject,
        segment: rapidData.segment,
        content: html
      });
      toast({ title: "Campaign Launched!", description: "Your rapid broadcast is being sent." });
      router.push('/cms/marketing/email/campaigns');
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Rapid Send" subtitle="Quick text-based email broadcasts">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Rapid Campaign</h2>
              <p className="text-muted-foreground text-xs">Fast broadcasts without the visual editor</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="border shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground">Email Subject</label>
                <Input value={rapidData.subject} onChange={e => setRapidData({...rapidData, subject: e.target.value})} className="h-9 rounded-lg text-sm" placeholder="Enter subject line..." />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground">Target Audience</label>
                <Select value={rapidData.segment} onValueChange={val => setRapidData({...rapidData, segment: val})}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue placeholder="Select Segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {segments.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground">Message Content</label>
                <Textarea value={rapidData.content} onChange={e => setRapidData({...rapidData, content: e.target.value})} className="min-h-[180px] rounded-lg text-sm p-3" placeholder="Write your message here..." />
              </div>

              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold">Include Unsubscribe</span>
                  </div>
                  <Switch 
                    checked={rapidData.includeUnsubscribe} 
                    onCheckedChange={val => setRapidData({...rapidData, includeUnsubscribe: val})} 
                  />
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-dashed">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">View in Browser Link</span>
                  </div>
                  <Switch 
                    checked={rapidData.includeViewInBrowser} 
                    onCheckedChange={val => setRapidData({...rapidData, includeViewInBrowser: val})} 
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-dashed">
                  <label className="text-[11px] font-bold text-muted-foreground">Permission Reminder</label>
                  <Input 
                    value={rapidData.permissionReminderText} 
                    onChange={e => setRapidData({...rapidData, permissionReminderText: e.target.value})} 
                    className="h-8 text-[10px] bg-white" 
                    placeholder="e.g. You are receiving this because..."
                  />
                </div>
              </div>

              <Button className="w-full h-10 rounded-lg font-bold text-sm" onClick={handleLaunch} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Launch Campaign</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-sm rounded-xl overflow-hidden bg-slate-900 text-white">
            <CardHeader className="p-5 border-b border-white/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Quick Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-400 text-xs">Why use Rapid Send?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">For urgent updates, announcements, or reminders where a visual design isn't needed. Mirrors the speed of SMS marketing.</p>
              </div>
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center font-bold text-[10px]">1</div>
                  <p className="text-xs">Write your message in plain text</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center font-bold text-[10px]">2</div>
                  <p className="text-xs">Select your target segment</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center font-bold text-[10px]">3</div>
                  <p className="text-xs">One-click broadcast to thousands</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

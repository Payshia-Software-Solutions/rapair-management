"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  createSmsCampaign, 
  fetchSmsCampaigns, 
  fetchSmsLogs,
  fetchCustomers,
  fetchSmsSegments,
  createSmsSegment,
  importSmsContacts,
  rerunSmsCampaign
} from "@/lib/api";
import { 
  MessageSquare, 
  Send, 
  Users, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Calendar,
  Smartphone,
  Sparkles,
  BarChart3,
  FileUp,
  Filter,
  Plus,
  Table as TableIcon,
  Search,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function SmsMarketingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_sent: 0, success_rate: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  const [campaignData, setCampaignData] = useState({
    name: "",
    message: "",
    segment: "all"
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Segment Form
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ name: "", description: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [camps, history, custs, segs] = await Promise.all([
        fetchSmsCampaigns(),
        fetchSmsLogs(),
        fetchCustomers(),
        fetchSmsSegments()
      ]);
      setCampaigns(camps);
      setLogs(history);
      setCustomerCount(custs.length);
      setSegments(segs);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generateAiMessage = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    
    // Simulating AI logic with templates based on prompt keywords
    setTimeout(() => {
      const p = aiPrompt.toLowerCase();
      let templates = [
        "Special Offer: Get 20% OFF on all services this week! Visit us now.",
        "Flash Sale! Only 24 hours left to claim your discount. Don't miss out!",
        "Hello! We have new arrivals just for you. Come check them out today."
      ];

      if (p.includes("promo") || p.includes("discount") || p.includes("off")) {
        templates = [
          "🎉 PROMO ALERT: Enjoy a flat 25% OFF on your next visit! Show this SMS to redeem. Valid until Sunday.",
          "EXCLUSIVE: Use code SAVE10 for 10% off your entire order. Shop online or in-store now!",
          "We miss you! Here is a special 15% discount just for you. Book your service today."
        ];
      } else if (p.includes("update") || p.includes("system") || p.includes("news")) {
        templates = [
          "SYSTEM UPDATE: We have upgraded our portal for a smoother experience. Login now to see what's new!",
          "Important News: Our store hours have changed. We are now open from 8 AM to 10 PM daily.",
          "Service Update: Your vehicle maintenance report is now ready. View it on our mobile app."
        ];
      } else if (p.includes("alert") || p.includes("urgent") || p.includes("reminder")) {
        templates = [
          "URGENT: Only 2 slots left for tomorrow's booking! Secure yours now to avoid waiting.",
          "REMINDER: Your appointment is scheduled for tomorrow at 10 AM. See you there!",
          "PAYMENT ALERT: Your outstanding balance of 2,500 LKR is due today. Please settle soon."
        ];
      } else if (p.includes("new year") || p.includes("holiday") || p.includes("festive")) {
        templates = [
          "Happy New Year! 🎆 Celebrate with a complimentary dessert on every meal. Valid all January!",
          "SEASON'S GREETINGS! Enjoy our festive bundle offers starting from just 1,999 LKR. Limited time!",
          "Holiday Special: Book a full service and get a free car wash. Merry Christmas from the team!"
        ];
      }

      setAiSuggestions(templates);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignData.message) return;

    setSubmitting(true);
    try {
      await createSmsCampaign(campaignData);
      toast({ title: "Campaign Launched", description: "Your messages are being sent." });
      setCampaignData({ name: "", message: "", segment: "all" });
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRerun = async (id: number) => {
    setSubmitting(true);
    try {
      toast({ title: "Re-running", description: "Campaign is being re-launched..." });
      await rerunSmsCampaign(id);
      toast({ title: "Success", description: "Re-run completed successfully." });
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegment.name) return;
    setSubmitting(true);
    try {
      await createSmsSegment(newSegment);
      toast({ title: "Segment Created", description: "You can now import contacts to this list." });
      setNewSegment({ name: "", description: "" });
      setIsSegmentModalOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, segmentId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const contacts = lines.slice(1).map(line => {
        const [name, phone, email] = line.split(',');
        return { name: name?.trim(), phone: phone?.trim(), email: email?.trim() };
      }).filter(c => c.phone);

      try {
        setSubmitting(true);
        await importSmsContacts({ segment_id: segmentId, contacts });
        toast({ title: "Success", description: `Imported ${contacts.length} contacts.` });
        load();
      } catch (err: any) {
        toast({ title: "Import Failed", description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              SMS Marketing
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">Broadcast promotions and updates to your guests</p>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" className="font-bold gap-2">
              <Link href="/cms/marketing/segments">
                <Users className="w-4 h-4" /> Manage Segments
              </Link>
            </Button>
            <Card className="px-4 py-2 border-none bg-primary/5 flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Audience</p>
                <p className="text-lg font-black">{customerCount.toLocaleString()}</p>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Composer */}
          <Card className="lg:col-span-1 border-none shadow-xl h-fit">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                New Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campaign Name</label>
                  <Input 
                    placeholder="e.g. Ramadan Offer 2026" 
                    className="h-12 rounded-xl font-bold"
                    value={campaignData.name}
                    onChange={e => setCampaignData({...campaignData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Segment</label>
                  <select 
                    className="w-full h-12 rounded-xl border-2 border-input bg-background px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    value={campaignData.segment}
                    onChange={e => setCampaignData({...campaignData, segment: e.target.value})}
                  >
                    <option value="all">All Customers ({customerCount})</option>
                    <option value="active">Active Guests Only</option>
                    <optgroup label="Custom Segments">
                      {segments.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.contact_count})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message Content</label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsAiModalOpen(true)}
                      className="h-7 text-[10px] font-black uppercase tracking-widest text-primary gap-1 hover:bg-primary/5 rounded-lg"
                    >
                      <Sparkles className="w-3 h-3" /> AI Magic Write
                    </Button>
                  </div>
                  <textarea 
                    className="w-full min-h-[160px] rounded-xl border-2 border-input bg-background px-3 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Type your message here... e.g. Special 20% off for your next stay!"
                    value={campaignData.message}
                    onChange={e => setCampaignData({...campaignData, message: e.target.value})}
                  />
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    <span className={`font-bold ${campaignData.message.length > 160 ? 'text-rose-500' : ''}`}>
                      {campaignData.message.length}/160 characters
                    </span>
                    <span>1 credit</span>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting || !campaignData.message}
                  className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-tight shadow-lg shadow-primary/20 gap-2"
                >
                  {submitting ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Sending (Anti-Spam active)...</>
                  ) : (
                    <><Send className="w-5 h-5" /> Launch Broadcast</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History & Logs */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="campaigns" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl bg-muted/50 p-1.5">
                <TabsTrigger value="campaigns" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                  <BarChart3 className="w-4 h-4" /> Past Campaigns
                </TabsTrigger>
                <TabsTrigger value="logs" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
                  <History className="w-4 h-4" /> Message Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns" className="mt-4">
                <div className="grid gap-4">
                  {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-20 opacity-50">No campaigns launched yet.</div>
                  ) : (
                    campaigns.map(camp => (
                      <Card key={camp.id} className="border-none shadow-md overflow-hidden group">
                        <div className="flex items-center">
                          <div className="w-2 bg-primary h-full self-stretch" />
                          <div className="p-5 flex-1 flex items-center justify-between">
                            <div>
                              <h4 className="font-black uppercase tracking-tight text-lg">{camp.name}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{camp.message}</p>
                              <div className="flex items-center gap-3 mt-3">
                                <Badge variant="outline" className="text-[10px] font-mono">{camp.target_segment}</Badge>
                                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {new Date(camp.sent_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button 
                                onClick={() => handleRerun(camp.id)}
                                disabled={submitting}
                                variant="outline" 
                                size="sm" 
                                className="font-bold gap-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                              >
                                <RefreshCw className={`w-3 h-3 ${submitting ? 'animate-spin' : ''}`} /> Re-run
                              </Button>
                              <Badge className="bg-emerald-500 hover:bg-emerald-600">COMPLETED</Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="segments" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest opacity-50">Custom Target Lists</h3>
                  <Button onClick={() => setIsSegmentModalOpen(true)} size="sm" className="font-bold gap-2">
                    <Plus className="w-4 h-4" /> New Segment
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {segments.map(seg => (
                    <Card key={seg.id} className="border-none shadow-md">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <h4 className="font-black uppercase tracking-tight">{seg.name}</h4>
                          <p className="text-xs text-muted-foreground">{seg.contact_count} Contacts</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".csv"
                              onChange={(e) => handleFileUpload(e, seg.id)}
                            />
                            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors">
                              <FileUp className="w-4 h-4" /> Import CSV
                            </div>
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <Card className="border-none shadow-md">
                  <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left p-4 font-black uppercase tracking-widest opacity-50">Recipient</th>
                          <th className="text-left p-4 font-black uppercase tracking-widest opacity-50">Message</th>
                          <th className="text-left p-4 font-black uppercase tracking-widest opacity-50">Status</th>
                          <th className="text-right p-4 font-black uppercase tracking-widest opacity-50">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logs.map(log => (
                          <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-3 h-3 text-muted-foreground" />
                                <div>
                                  <p className="font-black">{log.customer_name || "Walk-in"}</p>
                                  <p className="text-[10px] font-mono opacity-60">{log.recipient}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="line-clamp-2 italic text-muted-foreground">{log.message}</p>
                            </td>
                            <td className="p-4">
                              {log.status === 'Success' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" /> Sent
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-none flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3" /> Error
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 text-right opacity-60 font-medium">
                              {new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isSegmentModalOpen} onOpenChange={setIsSegmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Segment</DialogTitle>
            <DialogDescription>Create a named list to import your external contacts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSegment} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">List Name</label>
              <Input 
                placeholder="e.g. Corporate Clients 2026"
                value={newSegment.name}
                onChange={e => setNewSegment({...newSegment, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description (Optional)</label>
              <Input 
                placeholder="Brief notes about this list"
                value={newSegment.description}
                onChange={e => setNewSegment({...newSegment, description: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Segment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Helper Modal */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> AI Campaign Assistant
            </DialogTitle>
            <DialogDescription className="font-medium">
              Tell me what you want to say, and I'll generate some high-converting SMS variations for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">What's the campaign about?</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. 20% discount for New Year"
                  className="h-12 rounded-xl font-bold"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateAiMessage()}
                />
                <Button onClick={generateAiMessage} disabled={isGenerating} className="h-12 w-12 rounded-xl p-0">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {aiSuggestions.length > 0 && (
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Generated Suggestions</label>
                <div className="space-y-3 max-h-[300px] overflow-auto pr-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <Card key={idx} className="border-none bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group rounded-2xl" onClick={() => {
                      setCampaignData({...campaignData, message: suggestion});
                      setIsAiModalOpen(false);
                      setAiSuggestions([]);
                      setAiPrompt("");
                    }}>
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm font-medium leading-relaxed">{suggestion}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-primary uppercase opacity-0 group-hover:opacity-100 transition-opacity">Click to use this</span>
                          <span className="text-[10px] font-black text-muted-foreground opacity-40 uppercase">{suggestion.length} chars</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

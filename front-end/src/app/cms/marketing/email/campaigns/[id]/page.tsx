"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchEmailCampaigns,
  fetchEmailLogs
} from "@/lib/api";
import { 
  ChevronDown,
  BarChart3,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function CampaignReportPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [camps, allLogs] = await Promise.all([
          fetchEmailCampaigns(),
          fetchEmailLogs()
        ]);
        
        const currentCamp = camps.find((c: any) => c.id.toString() === id);
        if (currentCamp) {
          setCampaign(currentCamp);
          
          // Improved filtering: Check for campaign_id (best) or campaign_name (fallback)
          const campLogs = allLogs.filter((l: any) => {
            const matchesId = l.campaign_id && l.campaign_id.toString() === id;
            const matchesName = l.campaign_name && l.campaign_name.toLowerCase() === currentCamp.name.toLowerCase();
            // Some APIs might use different keys, try to find ANY match
            return matchesId || matchesName;
          });
          
          setLogs(campLogs);
        } else {
          toast({ title: "Not Found", description: "Campaign data could not be located.", variant: "destructive" });
        }
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, toast]);

  if (loading) {
    return (
      <DashboardLayout title="Loading Report..." subtitle="Gathering analytics">
        <div className="flex items-center justify-center h-64 opacity-20">
          <BarChart3 className="w-12 h-12 animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout title="Report Not Found" subtitle="Campaign ID mismatch">
        <Button variant="outline" onClick={() => router.push('/cms/marketing/email/campaigns')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to History
        </Button>
      </DashboardLayout>
    );
  }

  const stats = {
    sent: logs.length,
    delivered: logs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
    failed: logs.filter(l => l.status === 'failed').length,
  };

  return (
    <DashboardLayout title="Campaign Report" subtitle={campaign.name}>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/cms/marketing/email/campaigns')} className="text-xs font-bold gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to History
          </Button>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black uppercase tracking-widest text-[9px]">Live Audit</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border shadow-sm rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Users className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-black">{stats.sent}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audience</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
              <div className="text-2xl font-black">{stats.delivered}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Delivered</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <AlertCircle className="w-5 h-5 text-rose-500 mb-2" />
              <div className="text-2xl font-black">{stats.failed}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Clock className="w-5 h-5 text-amber-500 mb-2" />
              <div className="text-2xl font-black">{stats.sent > 0 ? '100%' : '0%'}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Completion</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Recipient Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recipient</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="text-sm font-bold">{log.recipient}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[9px] font-bold rounded-md ${log.status === 'failed' ? 'border-rose-200 text-rose-600 bg-rose-50' : 'border-emerald-200 text-emerald-600 bg-emerald-50'}`}>
                        {log.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-xs opacity-50 font-bold">No logs found for this specific campaign yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

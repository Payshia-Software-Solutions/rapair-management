"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchEmailCampaigns,
  processEmailQueue
} from "@/lib/api";
import { 
  BarChart3,
  ChevronDown,
  ArrowRight,
  RefreshCcw,
  Loader2,
  Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function CampaignsHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const camps = await fetchEmailCampaigns();
        setCampaigns(camps);
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <DashboardLayout title="Broadcast History" subtitle="Track sent broadcast performance">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Campaign Reports</h2>
              <p className="text-muted-foreground text-xs">History of all sent emails</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 px-4 rounded-lg font-bold text-xs gap-2 border-primary/20 hover:bg-primary/5 text-primary"
            disabled={processing}
            onClick={async () => {
              setProcessing(true);
              try {
                const res = await processEmailQueue();
                toast({ title: "Queue Processed", description: res.message });
                // Reload campaigns to see status changes
                const camps = await fetchEmailCampaigns();
                setCampaigns(camps);
              } catch (err: any) {
                toast({ title: "Process Failed", description: err.message, variant: "destructive" });
              } finally {
                setProcessing(false);
              }
            }}
          >
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Process Pending Queue
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.length === 0 && !loading ? (
            <div className="col-span-full text-center py-16 opacity-50 bg-muted/10 rounded-xl border-2 border-dashed text-sm font-bold">No campaigns launched yet.</div>
          ) : (
            campaigns.map(camp => (
              <Card key={camp.id} className="border shadow-sm rounded-xl overflow-hidden group hover:shadow-md transition-all">
                <div className="p-5">
                  <h4 className="font-bold text-sm mb-1">{camp.name}</h4>
                  <p className="text-xs text-muted-foreground truncate italic">{camp.subject}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Badge className={`rounded-md h-6 font-bold text-[10px] px-2 ${
                        camp.status === 'Sent' ? 'bg-emerald-500' : 
                        camp.status === 'Queued' ? 'bg-amber-500' :
                        camp.status === 'Processing' ? 'bg-blue-500 animate-pulse' :
                        'bg-slate-500'
                      }`}>
                        {camp.status}
                      </Badge>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {camp.sent_at ? new Date(camp.sent_at).toLocaleDateString() : 'Queued'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-2"
                      onClick={() => router.push(`/cms/marketing/email/campaigns/${camp.id}`)}
                    >
                      Report <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

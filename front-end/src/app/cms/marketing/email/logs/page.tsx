"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchEmailLogs
} from "@/lib/api";
import { 
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function LogsAuditPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const mLogs = await fetchEmailLogs();
        setLogs(mLogs);
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <DashboardLayout title="System Logs" subtitle="Delivery audit and success tracking">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">System Logs</h2>
              <p className="text-muted-foreground text-xs">Real-time delivery tracking</p>
            </div>
          </div>
        </div>

        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-4 text-xs font-bold text-muted-foreground">Recipient</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground">Status</th>
                  <th className="p-4 text-xs font-bold text-muted-foreground">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-sm">{log.recipient}</td>
                    <td className="p-4">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-none rounded-md font-bold text-[10px]">{log.status}</Badge>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center opacity-30 text-sm">No logs found.</td>
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

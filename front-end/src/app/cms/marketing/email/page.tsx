"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchSmsSegments,
  fetchCustomers
} from "@/lib/api";
import { 
  Mail, 
  Send, 
  Sparkles, 
  Users,
  FileCode,
  Zap,
  Filter,
  Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function EmailMarketingMenu() {
  const { toast } = useToast();
  const router = useRouter();
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const custs = await fetchCustomers();
        setCustomerCount(custs.length);
      } catch (err: any) {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <DashboardLayout title="Email Marketing Center" subtitle="Enterprise-grade communication management">
      <div className="space-y-5 animate-in fade-in duration-500">
        {/* Compact Header */}
        <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-black tracking-tight">Email Marketing</h1>
              <p className="text-muted-foreground text-[11px] font-medium">Broadcast & Audience Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 px-4 rounded-lg font-bold text-[11px] gap-2" onClick={() => router.push('/cms/marketing/email/segments')}>
              <Users className="w-3.5 h-3.5" /> Segments
            </Button>
            <div className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg shadow-sm">
              <Users className="w-3.5 h-3.5" />
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Audience</p>
                <p className="text-sm font-black leading-none">{customerCount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Action Grid - Compact */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-gradient-to-br from-primary to-indigo-600 text-white" onClick={() => router.push('/cms/marketing/email/design')}>
            <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Create Design</h3>
                <p className="text-[10px] font-medium opacity-70 mt-0.5">Visual Editor & AI</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md hover:border-emerald-500/30 transition-all cursor-pointer bg-slate-900 text-white" onClick={() => router.push('/cms/marketing/email/rapid')}>
            <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:-rotate-6 transition-transform">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Rapid Send</h3>
                <p className="text-[10px] font-medium opacity-70 mt-0.5">Quick Text-to-Email</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-white" onClick={() => router.push('/cms/marketing/email/library')}>
            <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">My Library</h3>
                <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Saved Newsletters</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-white" onClick={() => router.push('/cms/marketing/email/campaigns')}>
            <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Broadcasts</h3>
                <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Campaign History</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Row - Compact */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer bg-white" onClick={() => router.push('/cms/marketing/email/logs')}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Terminal className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">System Logs</h3>
                <p className="text-[10px] font-medium text-muted-foreground">Delivery Audit</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer bg-white" onClick={() => router.push('/cms/marketing/email/segments')}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Filter className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Audience Segments</h3>
                <p className="text-[10px] font-medium text-muted-foreground">Manage Lists & CSV</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

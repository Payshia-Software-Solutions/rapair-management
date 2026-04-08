"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchReportOverview } from "@/lib/api";
import { BarChart3, Calendar, Download, FileText, Clock, Wrench, Layers, Tags, ListChecks } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#2952A3", "#13C9EC", "#4AD991", "#FF9F43", "#FF4D4D", "#6C5CE7"];

type Overview = {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  ordersLast7Days: Array<{ date: string; count: number }>;
  counts: {
    vehicles: number;
    technicians: number;
    service_bays: number;
    repair_categories: number;
    checklist_templates: number;
  };
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchReportOverview();
      setData(d);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statusData = useMemo(() => {
    const by = data?.ordersByStatus ?? {};
    return Object.keys(by).map((k) => ({ name: k, value: by[k] }));
  }, [data]);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Reporting & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Live operational stats from your database</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            <Download className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="bg-primary gap-2" disabled>
            <Calendar className="w-4 h-4" />
            Last 7 Days
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-md"><CardContent className="p-6">Loading...</CardContent></Card>
          <Card className="border-none shadow-md"><CardContent className="p-6">Loading...</CardContent></Card>
          <Card className="border-none shadow-md"><CardContent className="p-6">Loading...</CardContent></Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <Card className="border-none shadow-md md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-blue-50 rounded-full mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">{data.totalOrders}</h3>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-green-50 rounded-full mb-4">
                  <Wrench className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold">{data.counts.technicians}</h3>
                <p className="text-sm text-muted-foreground">Technicians</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-cyan-50 rounded-full mb-4">
                  <Clock className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="text-2xl font-bold">{data.counts.service_bays}</h3>
                <p className="text-sm text-muted-foreground">Service Bays</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-purple-50 rounded-full mb-4">
                  <Tags className="w-6 h-6 text-purple-700" />
                </div>
                <h3 className="text-2xl font-bold">{data.counts.repair_categories}</h3>
                <p className="text-sm text-muted-foreground">Categories</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-rose-50 rounded-full mb-4">
                  <ListChecks className="w-6 h-6 text-rose-700" />
                </div>
                <h3 className="text-2xl font-bold">{data.counts.checklist_templates}</h3>
                <p className="text-sm text-muted-foreground">Checklist Templates</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Orders by Status</CardTitle>
                <CardDescription>Current distribution of repair orders</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Orders (Last 7 Days)</CardTitle>
                <CardDescription>Daily creation volume</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ordersLast7Days}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2952A3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}


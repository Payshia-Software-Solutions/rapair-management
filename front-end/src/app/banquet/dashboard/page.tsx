"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { LayoutDashboard, Calendar, ClipboardList, LayoutGrid, TrendingUp, Users } from "lucide-react";

export default function BanquetDashboard() {
  const [stats, setStats] = useState({
    totalHalls: 0,
    activeBookings: 0,
    upcomingEvents: 0,
    monthlyRevenue: 0
  });

  useEffect(() => {
    // In a real app, you'd have a specific stats endpoint
    void (async () => {
       const [hRes, bRes] = await Promise.all([
         api("/api/banquet/halls"),
         api("/api/banquet/bookings")
       ]);
       const hData = await hRes.json();
       const bData = await bRes.json();
       
       const bookings = bData.data || [];
       setStats({
         totalHalls: (hData.data || []).length,
         activeBookings: bookings.filter((b: any) => b.status === 'Confirmed').length,
         upcomingEvents: bookings.filter((b: any) => new Date(b.booking_date) >= new Date()).length,
         monthlyRevenue: bookings.reduce((acc: number, b: any) => acc + Number(b.total_amount), 0)
       });
    })();
  }, []);

  return (
    <DashboardLayout title="Banquet Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banquet Overview</h1>
          <p className="text-muted-foreground">Key performance metrics for events and venues</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Halls</CardTitle>
              <LayoutGrid className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHalls}</div>
              <p className="text-xs text-muted-foreground">Configured venues</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
              <ClipboardList className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeBookings}</div>
              <p className="text-xs text-muted-foreground">Pending execution</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
              <Calendar className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
              <p className="text-xs text-muted-foreground">Next 30 days</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-purple-50 dark:bg-purple-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">LKR {stats.monthlyRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Projected revenue</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
           <Card className="border-none shadow-sm min-h-[300px] flex items-center justify-center">
              <div className="text-center space-y-2">
                 <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                 <p className="text-muted-foreground">Event occupancy chart placeholder</p>
              </div>
           </Card>
           <Card className="border-none shadow-sm min-h-[300px] flex items-center justify-center">
              <div className="text-center space-y-2">
                 <TrendingUp className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                 <p className="text-muted-foreground">Revenue breakdown placeholder</p>
              </div>
           </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

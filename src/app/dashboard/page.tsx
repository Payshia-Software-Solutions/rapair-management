"use client"

import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { 
  ClipboardList, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const stats = [
  { label: 'Pending Orders', value: '12', icon: ClipboardList, color: 'text-orange-500', bg: 'bg-orange-50' },
  { label: 'In Progress', value: '8', icon: Wrench, color: 'text-primary', bg: 'bg-blue-50' },
  { label: 'Completed Today', value: '15', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
  { label: 'Avg. Repair Time', value: '4.2h', icon: Clock, color: 'text-cyan-500', bg: 'bg-cyan-50' },
];

const chartData = [
  { name: 'Mon', completed: 12, received: 14 },
  { name: 'Tue', completed: 18, received: 15 },
  { name: 'Wed', completed: 15, received: 22 },
  { name: 'Thu', completed: 21, received: 18 },
  { name: 'Fri', completed: 25, received: 24 },
  { name: 'Sat', completed: 10, received: 8 },
  { name: 'Sun', completed: 5, received: 4 },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                <h3 className="text-3xl font-bold">{stat.value}</h3>
              </div>
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md border-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Workshop Throughput</CardTitle>
                <CardDescription>Order volume and completion rate for this week</CardDescription>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
                <TrendingUp className="w-3 h-3" />
                +12% vs last week
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2952A3" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2952A3" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#13C9EC" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#13C9EC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="received" 
                  stroke="#2952A3" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorReceived)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#13C9EC" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCompleted)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Bay Status</CardTitle>
            <CardDescription>Current utilization of workshop bays</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((bay) => (
                <div key={bay} className="flex items-center justify-between py-2 border-b last:border-0 border-muted/30">
                  <span className="font-medium text-sm">Bay {bay}</span>
                  {bay <= 5 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">RO-124{bay}</span>
                      <Badge className="bg-blue-100 text-primary hover:bg-blue-100 border-none">Active</Badge>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Empty</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Urgent Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-orange-50/50 border border-orange-100 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm">Engine Malfunction - CAR-998{i}</h4>
                  <p className="text-xs text-muted-foreground mt-1">Expected completion: Today 4:00 PM</p>
                </div>
                <Badge variant="destructive" className="bg-orange-500">Urgent</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-lg">Recent Completions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Service Complete - TRK-00{i}</h4>
                    <p className="text-xs text-muted-foreground">Technician: Sarah Johnson</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">20m ago</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { cn } from '@/lib/utils';
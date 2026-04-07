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
  ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="order-2 sm:order-1">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className="text-xl sm:text-3xl font-bold">{stat.value}</h3>
              </div>
              <div className={cn("p-2 sm:p-3 rounded-xl order-1 sm:order-2", stat.bg)}>
                <stat.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-none">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold">Workshop Throughput</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Weekly order volume analysis</CardDescription>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1 text-[10px] sm:text-xs">
                <TrendingUp className="w-3 h-3" />
                +12% vs last week
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] sm:h-[350px] p-2 sm:pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
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

        <Card className="shadow-sm border-none hidden sm:block">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-bold">Bay Status</CardTitle>
            <CardDescription>Real-time shop utilization</CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bay) => (
                <div key={bay} className="flex items-center justify-between py-2 border-b last:border-0 border-muted/30">
                  <span className="font-medium text-sm">Bay {bay}</span>
                  {bay <= 5 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">RO-124{bay}</span>
                      <Badge className="bg-blue-100 text-primary hover:bg-blue-100 border-none text-[10px]">Active</Badge>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">Empty</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 sm:pb-0">
        <Card className="shadow-sm border-none">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Urgent Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6">
            {[1, 2].map((i) => (
              <div key={i} className="p-3 sm:p-4 rounded-lg bg-orange-50/50 border border-orange-100 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">Engine Malfunction - CAR-998{i}</h4>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Due: Today 4:00 PM</p>
                </div>
                <Badge variant="destructive" className="bg-orange-500 text-[10px] h-5 px-2">Urgent</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Completions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs sm:text-sm font-semibold truncate">Service Complete - TRK-00{i}</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Sarah Johnson</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground shrink-0 ml-2">20m ago</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Filter,
  FileText,
  Clock,
  Wrench,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const categoryData = [
  { name: 'Engine System', value: 35 },
  { name: 'Brake System', value: 25 },
  { name: 'Suspension', value: 15 },
  { name: 'Electrical', value: 10 },
  { name: 'Oil Service', value: 15 },
];

const techPerformanceData = [
  { name: 'John Smith', completed: 42, avgTime: 3.5 },
  { name: 'Sarah Johnson', completed: 38, avgTime: 4.2 },
  { name: 'Mike Ross', completed: 35, avgTime: 3.8 },
  { name: 'Emily Davis', completed: 45, avgTime: 3.2 },
  { name: 'David Wilson', completed: 30, avgTime: 5.0 },
];

const COLORS = ['#2952A3', '#13C9EC', '#4AD991', '#FF9F43', '#FF4D4D'];

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reporting & Analytics</h1>
          <p className="text-muted-foreground mt-1">Insights into workshop performance and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button className="bg-primary gap-2">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technicians">Technician Performance</TabsTrigger>
          <TabsTrigger value="categories">Repair Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-md">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-blue-50 rounded-full mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">185</h3>
                <p className="text-sm text-muted-foreground">Total Repairs This Month</p>
                <span className="text-xs text-green-500 font-medium mt-2">↑ 12.5% from last month</span>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-cyan-50 rounded-full mb-4">
                  <Clock className="w-6 h-6 text-cyan-500" />
                </div>
                <h3 className="text-2xl font-bold">3.8h</h3>
                <p className="text-sm text-muted-foreground">Average Completion Time</p>
                <span className="text-xs text-green-500 font-medium mt-2">↓ 0.5h improvement</span>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 bg-green-50 rounded-full mb-4">
                  <Wrench className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold">94%</h3>
                <p className="text-sm text-muted-foreground">First Time Fix Rate</p>
                <span className="text-xs text-green-500 font-medium mt-2">↑ 2.1% improvement</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Repair Categories Distribution</CardTitle>
                <CardDescription>Most common repair types by volume</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                <CardTitle>Technician Efficiency</CardTitle>
                <CardDescription>Average repair time per technician (hours)</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techPerformanceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="avgTime" fill="#13C9EC" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="technicians">
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Technician Output</CardTitle>
                  <CardDescription>Total jobs completed this month</CardDescription>
                </div>
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#2952A3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>Deep Dive: Repair Categories</CardTitle>
              <CardDescription>Profitability and frequency analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{cat.name}</span>
                      <span>{cat.value}% of total volume</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${cat.value}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
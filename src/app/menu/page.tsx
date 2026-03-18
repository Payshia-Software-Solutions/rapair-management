"use client"

import React from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  BarChart3, 
  Settings,
  LogOut,
  Wrench,
  PlayCircle,
  User,
  Shield,
  Bell,
  HelpCircle,
  Info,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MOCK_USER } from '@/lib/mock-data';

const menuSections = [
  {
    title: 'Core Features',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', color: 'bg-blue-500' },
      { icon: ClipboardList, label: 'Order Queue', href: '/orders', color: 'bg-orange-500' },
      { icon: PlayCircle, label: 'Active Jobs', href: '/orders/active', color: 'bg-green-500' },
      { icon: PlusCircle, label: 'Create Order', href: '/orders/new', color: 'bg-primary' },
    ]
  },
  {
    title: 'Analytics & Management',
    items: [
      { icon: BarChart3, label: 'Reports', href: '/reports', color: 'bg-cyan-500' },
      { icon: User, label: 'My Profile', href: '/profile', color: 'bg-purple-500' },
      { icon: Settings, label: 'Settings', href: '/profile', color: 'bg-slate-500' },
    ]
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help Center', href: '#', color: 'bg-pink-500' },
      { icon: Info, label: 'About ServiceBay', href: '#', color: 'bg-indigo-500' },
    ]
  }
];

export default function MenuPage() {
  const handleLogout = () => {
    window.location.href = '/login';
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-8">
        {/* Profile Header */}
        <Link href="/profile">
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-primary text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-white/20">
                    <AvatarImage src="https://picsum.photos/seed/user/64/64" />
                    <AvatarFallback>FO</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{MOCK_USER.name}</h2>
                    <p className="text-white/70 text-sm">{MOCK_USER.role} • West Bay</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Menu Grid */}
        <div className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                {section.title}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {section.items.map((item) => (
                  <Link key={item.label} href={item.href}>
                    <Card className="border-none shadow-sm hover:bg-muted/50 transition-colors h-full">
                      <CardContent className="p-4 flex flex-col items-start gap-3">
                        <div className={`p-2 rounded-lg text-white ${item.color}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* System Actions */}
        <div className="space-y-3 pt-4">
          <Button 
            variant="destructive" 
            className="w-full h-12 rounded-xl font-bold gap-2 shadow-lg shadow-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
          <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            ServiceBay v1.2.4
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

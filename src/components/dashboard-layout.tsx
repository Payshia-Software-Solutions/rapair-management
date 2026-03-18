"use client"

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  BarChart3, 
  Settings,
  LogOut,
  Wrench,
  Search,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset
} from '@/components/ui/sidebar';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ClipboardList, label: 'Order Queue', href: '/orders' },
  { icon: PlusCircle, label: 'Create Order', href: '/orders/new' },
  { icon: BarChart3, label: 'Reports', href: '/reports' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="h-16 flex items-center px-6">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="p-1.5 bg-accent rounded-lg">
                <Wrench className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden">
                ServiceBay
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className={cn(
                      "transition-all duration-200",
                      pathname === item.href ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Logout" className="text-white/70 hover:text-white">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col bg-background">
          <header className="h-16 border-b bg-card px-8 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="relative w-64 md:w-96 hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search orders, vehicles..." 
                  className="pl-9 bg-muted/30 border-none ring-offset-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-background" />
              </Button>
              <Avatar className="h-9 w-9 border-2 border-primary/10">
                <AvatarImage src="https://picsum.photos/seed/user/32/32" />
                <AvatarFallback>FO</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  BarChart3, 
  Settings,
  LogOut,
  Wrench,
  Search,
  Bell,
  PlayCircle,
  User,
  Users,
  Grid,
  Tags,
  CheckSquare,
  ChevronRight,
  Database
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
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { DockMenu } from './dock-menu';
import { Preloader } from "@/components/ui/preloader";

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ClipboardList, label: 'Order Queue', href: '/orders' },
  { icon: PlayCircle, label: 'Active Jobs', href: '/orders/active' },
  { icon: PlusCircle, label: 'Create Order', href: '/orders/new' },
  { icon: BarChart3, label: 'Reports', href: '/reports' },
];

const masterDataItems = [
  { icon: Users, label: 'Technicians', href: '/master-data/technicians' },
  { icon: Grid, label: 'Service Bays', href: '/master-data/bays' },
  { icon: Tags, label: 'Repair Categories', href: '/master-data/categories' },
  { icon: CheckSquare, label: 'Checklist Items', href: '/master-data/checklists' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <SidebarProvider>
      {isNavigating && <Preloader />}
      <div className="flex min-h-screen w-full bg-background relative">
        <Sidebar variant="sidebar" collapsible="icon" className="border-r-0 hidden lg:flex">
          <SidebarHeader className="h-16 flex items-center px-4 sm:px-6">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="p-1.5 bg-accent rounded-lg">
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden">
                ServiceBay
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-white/50 px-4 mb-2 group-data-[collapsible=icon]:hidden">Core Features</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className={cn(
                          "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                          pathname === item.href ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="w-5 h-5" />
                          <span className="text-base sm:text-sm font-medium">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-white/50 px-4 mb-2 group-data-[collapsible=icon]:hidden uppercase tracking-widest text-[10px] font-bold">Master Data</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {masterDataItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className={cn(
                          "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                          pathname === item.href ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="w-5 h-5" />
                          <span className="text-base sm:text-sm font-medium">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === '/profile'}
                    tooltip="Profile"
                    className={cn(
                      "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                      pathname === '/profile' ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Link href="/profile">
                      <User className="w-5 h-5" />
                      <span className="text-base sm:text-sm font-medium">Profile</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Logout" 
                  className="text-white/70 hover:text-white py-6 sm:py-2"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-base sm:text-sm font-medium">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b bg-card px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="lg:hidden p-1.5 bg-accent rounded-lg mr-2">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <SidebarTrigger className="h-10 w-10 hidden lg:flex" />
              <div className="relative w-48 md:w-96 hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search orders..." 
                  className="pl-9 bg-muted/30 border-none ring-offset-background"
                />
              </div>
              <h1 className="lg:hidden font-bold text-lg">ServiceBay</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="relative h-10 w-10">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent rounded-full border-2 border-background" />
              </Button>
              <Link href="/profile">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/10 cursor-pointer hover:border-accent transition-colors">
                  <AvatarImage src="https://picsum.photos/seed/user/32/32" />
                  <AvatarFallback>FO</AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-8 overflow-y-auto pb-24 lg:pb-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
              {children}
            </div>
          </main>
        </SidebarInset>

        <DockMenu />
      </div>
    </SidebarProvider>
  );
}

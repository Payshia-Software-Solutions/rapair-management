"use client"

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  BarChart3, 
  PlayCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const dockItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/dashboard' },
  { icon: ClipboardList, label: 'Queue', href: '/orders' },
  { icon: PlusCircle, label: 'New', href: '/orders/new', primary: true },
  { icon: PlayCircle, label: 'Active', href: '/orders/active' },
  { icon: BarChart3, label: 'Stats', href: '/reports' },
];

export function DockMenu() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md md:max-w-lg lg:hidden">
      <TooltipProvider delayDuration={0}>
        <nav className="flex items-center justify-around p-2 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
          {dockItems.map((item) => {
            const isActive = pathname === item.href;
            
            if (item.primary) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 transition-all hover:scale-110 active:scale-95",
                        isActive && "ring-2 ring-accent ring-offset-2"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all hover:bg-muted active:scale-95",
                      isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>
    </div>
  );
}

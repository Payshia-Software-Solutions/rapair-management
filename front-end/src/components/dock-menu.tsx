"use client"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  Menu, 
  PlayCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSavedDockItems } from '@/lib/dock-utils';
import * as NavItems from '@/lib/nav-items';

const DEFAULT_ITEMS = [
  { icon: LayoutDashboard, label: 'Home', href: '/dashboard' },
  { icon: ClipboardList, label: 'Queue', href: '/orders' },
  { icon: PlusCircle, label: 'New', href: '/orders/new', primary: true },
  { icon: PlayCircle, label: 'Active', href: '/orders/active' },
  { icon: Menu, label: 'All', href: '/menu' },
];

export function DockMenu() {
  const pathname = usePathname();
  const [items, setItems] = useState<any[]>([]);

  const loadItems = () => {
    const savedHrefs = getSavedDockItems();
    if (!savedHrefs) {
      setItems(DEFAULT_ITEMS);
      return;
    }

    // Map hrefs back to NavItems
    const allAvailableItems: NavItems.NavItem[] = [
      ...NavItems.mainNavItems,
      ...NavItems.serviceCenterItems,
      ...NavItems.inventoryItems,
      ...NavItems.vendorItems,
      ...NavItems.crmItems,
      ...NavItems.marketingItems,
      ...NavItems.salesItems,
      ...NavItems.accountingItems,
      ...NavItems.productionItems,
      ...NavItems.hrmItems,
      ...NavItems.frontOfficeItems,
      ...NavItems.banquetItems,
      ...NavItems.masterDataItems,
      ...NavItems.adminNavItems,
    ];

    const mapped = savedHrefs.map((href, index) => {
      // Hardcode /menu since it's special (not in sidebar typically but in dock)
      if (href === '/menu') return { icon: Menu, label: 'All', href: '/menu' };
      
      const found = allAvailableItems.find(it => it.href === href);
      return found ? { ...found, primary: index === 2 && savedHrefs.length === 5 } : null;
    }).filter(Boolean);

    setItems(mapped);
  };

  useEffect(() => {
    loadItems();
    window.addEventListener("dock_config_updated", loadItems);
    return () => window.removeEventListener("dock_config_updated", loadItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md md:max-w-lg lg:hidden">
      <TooltipProvider delayDuration={0}>
        <nav className="flex items-center justify-around p-2 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
          {items.map((item) => {
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

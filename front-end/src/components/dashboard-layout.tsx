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
  Database,
  Car,
  Layers,
  Tag,
  Shield,
  Sun,
  Moon,
  MapPin,
  Boxes,
  ArrowLeftRight,
  Truck,
  FileText,
  PackageCheck,
  History,
  ChevronDown,
  Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api, fetchLocations } from '@/lib/api';
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { DockMenu } from './dock-menu';
import { mainNavItems, masterDataItems, inventoryItems, adminNavItems } from "@/lib/nav-items";

export function DashboardLayout({ children, fullWidth = true }: { children: React.ReactNode; fullWidth?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('');
  const [permissionKeys, setPermissionKeys] = useState<string[] | null>(null);
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
	  const [isAdminOpen, setIsAdminOpen] = useState(false);
	  const [theme, setTheme] = useState<'light' | 'dark'>('light');
	  const [availableLocations, setAvailableLocations] = useState<Array<{ id: number; name: string }>>([]);
	  const [currentLocationId, setCurrentLocationId] = useState<number | null>(() => {
      // Initialize immediately to avoid a re-mount "flash" when location loads after first paint.
      try {
        if (typeof window === 'undefined') return null;
        const lsId = window.localStorage.getItem('location_id');
        if (lsId) {
          const n = Number(lsId);
          return Number.isFinite(n) ? n : null;
        }
        const token = window.localStorage.getItem('auth_token');
        if (!token) return 1;
        const part = token.split('.')[1];
        const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        const tokenLocId = json.location_id ? Number(json.location_id) : 1;
        return Number.isFinite(tokenLocId) ? tokenLocId : 1;
      } catch {
        return 1;
      }
    });
	  const [currentLocationName, setCurrentLocationName] = useState<string>(() => {
      try {
        if (typeof window === 'undefined') return '';
        const lsId = window.localStorage.getItem('location_id');
        const lsName = window.localStorage.getItem('location_name');
        if (lsId && lsName) return String(lsName);
        const token = window.localStorage.getItem('auth_token');
        if (!token) return 'Main';
        const part = token.split('.')[1];
        const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        return String(json.location_name || 'Main');
      } catch {
        return 'Main';
      }
    });
	  const [docTitle, setDocTitle] = useState<string>('');
	  // Location switching uses the /select-location page (card UI) for a consistent UX.

	  useEffect(() => {
    // Basic client-side guard. Server APIs also enforce auth via JWT.
    const token = window.localStorage.getItem('auth_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const part = token.split('.')[1];
      const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      setUserRole(String(json.role || ''));

      // Initialize current location from localStorage if present; fallback to JWT.
      const lsId = window.localStorage.getItem('location_id');
      const lsName = window.localStorage.getItem('location_name');
      const tokenLocId = json.location_id ? Number(json.location_id) : 1;
      const tokenLocName = String(json.location_name || 'Main');
      const initId = lsId ? Number(lsId) : tokenLocId;
      // Only trust the stored name if we also have a stored id (prevents mismatched/stale name after login).
      const initName = lsId ? (lsName || tokenLocName) : tokenLocName;
      setCurrentLocationId(Number.isFinite(initId) ? initId : tokenLocId);
      setCurrentLocationName(initName);

      // Available locations: Admin can load all. Non-admin uses allowed_locations from JWT.
      const allowed = Array.isArray(json.allowed_locations) ? json.allowed_locations : [];
      const allowedClean = allowed
        .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? '') }))
        .filter((x: any) => x.id > 0 && x.name);
      if (String(json.role || '') !== 'Admin') {
        setAvailableLocations(allowedClean.length > 0 ? allowedClean : [{ id: tokenLocId, name: tokenLocName }]);
      }
    } catch {
      setUserRole('');
    }

    const loadPerms = async () => {
      try {
        const res = await api('/api/auth/permissions');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
          setPermissionKeys(data.data);
        } else {
          setPermissionKeys([]);
        }
      } catch {
        setPermissionKeys([]);
      }
    };
    void loadPerms();
	  }, []);

	  useEffect(() => {
	    // Keep a lightweight "document title" label in the header.
	    // Next.js updates document.title after navigation; read it on pathname changes.
	    try {
	      const t = window.setTimeout(() => {
	        const raw = (document.title || "").trim();
	        const pretty = raw.includes("|") ? raw.split("|").slice(-1)[0].trim() : raw;
	        setDocTitle(pretty);
	      }, 0);
	      return () => window.clearTimeout(t);
	    } catch {
	      // ignore
	    }
	  }, [pathname]);

  useEffect(() => {
    if (userRole !== 'Admin') return;

    // Admin can switch context to any location.
    void (async () => {
      try {
        const locs = await fetchLocations();
        const cleaned = Array.isArray(locs)
          ? locs.map((l: any) => ({ id: Number(l.id), name: String(l.name ?? '') })).filter((l: any) => l.id > 0 && l.name)
          : [];
        setAvailableLocations(cleaned);

        // If we have no selection yet, pick #1.
        if (!currentLocationId && cleaned.length > 0) {
          setCurrentLocationId(cleaned[0].id);
          setCurrentLocationName(cleaned[0].name);
          window.localStorage.setItem('location_id', String(cleaned[0].id));
          window.localStorage.setItem('location_name', String(cleaned[0].name));
        }
      } catch {
        // ignore
      }
    })();
  }, [userRole]);

  useEffect(() => {
    // Keep current location name synced when locations list arrives/changes.
    if (!currentLocationId) return;
    const match = availableLocations.find((l) => l.id === currentLocationId);
    if (match?.name && match.name !== currentLocationName) {
      setCurrentLocationName(match.name);
      window.localStorage.setItem('location_name', match.name);
    }
  }, [availableLocations, currentLocationId, currentLocationName]);

  useEffect(() => {
    // Reflect the current theme (class on <html>) so both toggles stay in sync.
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(current);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'theme') return;
      const next = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      setTheme(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onPermsUpdated = () => {
      // Re-fetch permissions so nav updates immediately after RBAC changes.
      void (async () => {
        try {
          const res = await api('/api/auth/permissions');
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.data)) {
            setPermissionKeys(data.data);
          } else {
            setPermissionKeys([]);
          }
        } catch {
          setPermissionKeys([]);
        }
      })();
    };

    window.addEventListener('rbac:updated', onPermsUpdated);
    return () => window.removeEventListener('rbac:updated', onPermsUpdated);
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem('auth_token');
    window.localStorage.removeItem('location_id');
    window.localStorage.removeItem('location_name');
    router.push('/login');
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      window.localStorage.setItem('theme', 'light');
      setTheme('light');
    } else {
      document.documentElement.classList.add('dark');
      window.localStorage.setItem('theme', 'dark');
      setTheme('dark');
    }
  };

  const setLocationContext = (id: number) => {
    const loc = availableLocations.find((l) => l.id === id);
    setCurrentLocationId(id);
    setCurrentLocationName(loc?.name ?? '');
    window.localStorage.setItem('location_id', String(id));
    if (loc?.name) window.localStorage.setItem('location_name', String(loc.name));
    else window.localStorage.removeItem('location_name');
  };

  const openLocationSwitcher = () => {
    const ret = encodeURIComponent(pathname || "/dashboard");
    router.push(`/select-location?return=${ret}`);
  };

  const hasPerm = (perm?: string) => {
    if (!perm) return true;
    if (!permissionKeys) return true; // render immediately; will filter once loaded
    if (permissionKeys.includes('*')) return true;
    return permissionKeys.includes(perm);
  };

  const visibleMasterDataItems = masterDataItems.filter((it) => hasPerm((it as any).perm));
  const canSeeMasterData = visibleMasterDataItems.length > 0;

  const visibleInventoryItems = inventoryItems.filter((it) => hasPerm((it as any).perm));
  const canSeeInventory = visibleInventoryItems.length > 0;

  const adminItems = userRole === 'Admin' ? adminNavItems : [];
  const canSeeAdmin = adminItems.length > 0;

  const isActiveRoute = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // If a child route is active, force its dropdown open (users can still close when not on that section).
  const inventoryOpen = isInventoryOpen || pathname.startsWith('/inventory');
  const masterDataOpen = isMasterDataOpen || pathname.startsWith('/master-data');
  const adminOpen = isAdminOpen || pathname.startsWith('/admin');

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background relative">
        <Sidebar variant="sidebar" collapsible="icon" className="border-r-0 hidden lg:flex">
          <SidebarHeader className="h-16 flex items-center px-4 sm:px-6">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="p-1.5 bg-accent rounded-lg">
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  ServiceBay
                </div>
                <div className="text-[10px] text-white/70 uppercase tracking-widest font-bold truncate max-w-[160px]">
                  {currentLocationName ? `Location: ${currentLocationName}` : "Location: -"}
                </div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4 gap-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-white/50 px-4 mb-2 group-data-[collapsible=icon]:hidden">Core Features</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      {!hasPerm((item as any).perm) ? null : (
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
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {!canSeeInventory ? null : (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsInventoryOpen((v) => !v)}
                        isActive={pathname.startsWith('/inventory')}
                        tooltip="Inventory"
                        className={cn(
                          "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                          pathname.startsWith('/inventory') ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Boxes className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Inventory</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            inventoryOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {inventoryOpen ? (
                        <SidebarMenuSub>
                          {visibleInventoryItems.map((item) => (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton asChild isActive={isActiveRoute(item.href)}>
                                <Link href={item.href}>
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {!canSeeMasterData ? null : (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsMasterDataOpen((v) => !v)}
                        isActive={pathname.startsWith('/master-data')}
                        tooltip="Master Data"
                        className={cn(
                          "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                          pathname.startsWith('/master-data') ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Grid className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Master Data</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            masterDataOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {masterDataOpen ? (
                        <SidebarMenuSub>
                          {visibleMasterDataItems.map((item) => (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActiveRoute(item.href)}
                              >
                                <Link href={item.href}>
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarMenu>
                {!canSeeAdmin ? null : (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => setIsAdminOpen((v) => !v)}
                      isActive={pathname.startsWith('/admin')}
                      tooltip="Administration"
                      className={cn(
                        "transition-all duration-200 py-6 sm:py-2 text-white/80 hover:text-white",
                        pathname.startsWith('/admin') ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50"
                      )}
                    >
                      <Shield className="w-5 h-5" />
                      <span className="text-base sm:text-sm font-medium">Administration</span>
                      <ChevronRight
                        className={cn(
                          "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                          adminOpen ? "rotate-90" : "rotate-0"
                        )}
                      />
                    </SidebarMenuButton>

                    {adminOpen ? (
                      <SidebarMenuSub>
                        {adminItems.map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActiveRoute(item.href)}>
                              <Link href={item.href}>
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                )}
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
                  tooltip={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="text-white/70 hover:text-white py-6 sm:py-2"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="text-base sm:text-sm font-medium">
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
	              {availableLocations.length > 0 ? (
	                <div className="hidden md:flex items-center gap-2">
	                  <MapPin className="w-4 h-4 text-muted-foreground" />
	                  <Button
	                    type="button"
	                    variant="outline"
	                    className="h-9 w-[240px] justify-between bg-muted/20 border-none"
	                    onClick={openLocationSwitcher}
	                  >
	                    <span className="truncate">{currentLocationName || "Select location"}</span>
	                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
	                  </Button>
	                </div>
	              ) : null}
	              <h1 className="lg:hidden font-bold text-lg">ServiceBay</h1>
	            </div>
	            <div className="flex items-center gap-2 sm:gap-4">
	              {docTitle ? (
	                <div className="hidden md:block max-w-[260px] truncate text-sm font-semibold text-foreground/90">
	                  {docTitle}
	                </div>
	              ) : null}
	              <Button
	                variant="ghost"
	                size="icon"
                className="relative h-10 w-10"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
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
            <div
              className={cn(
                fullWidth ? "w-full" : "max-w-7xl mx-auto",
                "min-h-full flex flex-col"
              )}
            >
              <div className="flex-1 space-y-6 sm:space-y-8">
                {children}
              </div>

              <div className="pt-6 border-t text-[11px] text-muted-foreground flex flex-row flex-wrap items-center justify-between gap-2">
                <span>Powered by Payshia Software Solutions Pvt Ltd</span>
                <a
                  className="text-foreground/80 hover:text-foreground underline underline-offset-2"
                  href="https://www.payshia.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  www.payshia.com
                </a>
              </div>
            </div>
          </main>
        </SidebarInset>

        <DockMenu />
      </div>
    </SidebarProvider>
  );
}

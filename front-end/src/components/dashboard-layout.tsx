"use client"

import { clearUserSession, readPermsCache, writePermsCache } from "@/lib/session";
import { applyTheme, getTheme, nextTheme, THEME_EVENT, type AppTheme } from "@/lib/theme";
import React, { useState, useEffect, useRef } from 'react';
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
  Percent,
  Landmark,
  CheckCircle2,
  Receipt,
  LayoutGrid,
  Factory,
  TrendingUp,
  Gift,
  Award,
  Building2,
  ShoppingCart,
  Ticket,
  Sparkles,
  MonitorSmartphone,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Whole days from now until an ISO date, or null when the date is missing or unreadable. */
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DockMenu } from './dock-menu';
import { PromotionsDialog } from './promotions-dialog';
import { SaasInfoDialog } from './saas-info-dialog';
import { AppLauncher } from './odoo-app-launcher';
import { REPORT_GROUPS } from '@/lib/reports-catalog';
import { fetchApprovalCount } from '@/lib/api/approvals';
import { 
  mainNavItems, 
  masterDataItems, 
  inventoryItems, 
  crmItems,
  salesItems,
  accountingItems, 
  adminNavItems,
  developerNavItems,
  serviceCenterItems,
  vendorItems,
  productionItems,
  hrmItems,
  frontOfficeItems,
  banquetItems,
  marketingItems,
  loyaltyItems,
  ecommerceItems,
  kioskItems,
  approvalItems
} from "@/lib/nav-items";
import { useDevMode } from "@/lib/dev-mode";

export function DashboardLayout({ children, fullWidth = true, title }: { children: React.ReactNode; fullWidth?: boolean; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('');
  const [permissionKeys, setPermissionKeys] = useState<string[] | null>(() => {
    if (typeof window !== 'undefined') {
      // only if cached for THIS user (never another user's admin rights)
      const p = readPermsCache();
      if (p) return p;
    }
    return null;
  });
  
  const useSidebarState = (key: string, defaultVal: boolean) => {
    const [state, setState] = useState(() => {
      if (typeof window !== 'undefined') {
        const v = window.sessionStorage.getItem(`sb_${key}`);
        if (v !== null) return v === 'true';
      }
      return defaultVal;
    });
    const setSidebarState = (val: boolean | ((v: boolean) => boolean)) => {
      setState((prev: boolean) => {
        const next = typeof val === 'function' ? val(prev) : val;
        if (typeof window !== 'undefined') window.sessionStorage.setItem(`sb_${key}`, String(next));
        return next;
      });
    };
    return [state, setSidebarState] as const;
  };

  const [isCoreFeaturesOpen, setIsCoreFeaturesOpen] = useSidebarState('Core', true);
  const [isServiceCenterOpen, setIsServiceCenterOpen] = useSidebarState('Service', false);
  const [isVendorsOpen, setIsVendorsOpen] = useSidebarState('Vendors', false);
  const [isMasterDataOpen, setIsMasterDataOpen] = useSidebarState('Master', false);
  const [isInventoryOpen, setIsInventoryOpen] = useSidebarState('Inventory', false);
  const [isCrmOpen, setIsCrmOpen] = useSidebarState('CRM', false);
  const [isSalesOpen, setIsSalesOpen] = useSidebarState('Sales', false);
  const [isAccountingOpen, setIsAccountingOpen] = useSidebarState('Accounting', false);
  const [isReportsOpen, setIsReportsOpen] = useSidebarState('Reports', false);

  // Header bell: approvals waiting for this user. Refreshes every minute and when an approvals screen changes something.
  const [approvalCount, setApprovalCount] = useState(0);
  useEffect(() => {
    let live = true;
    const refresh = () => { void fetchApprovalCount().then((n) => { if (live) setApprovalCount(n); }).catch(() => {}); };
    refresh();
    const t = window.setInterval(refresh, 60000);
    window.addEventListener('approvals:changed', refresh);
    return () => { live = false; window.clearInterval(t); window.removeEventListener('approvals:changed', refresh); };
  }, []);
  const [isProductionOpen, setIsProductionOpen] = useSidebarState('Production', false);
  const [isMarketingOpen, setIsMarketingOpen] = useSidebarState('Marketing', false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useSidebarState('Loyalty', false);
  const [isHrmOpen, setIsHrmOpen] = useSidebarState('HRM', false);
  const [isApprovalsOpen, setIsApprovalsOpen] = useSidebarState('Approvals', false);
  const [isFrontOfficeOpen, setIsFrontOfficeOpen] = useSidebarState('FrontOffice', false);
  const [isBanquetOpen, setIsBanquetOpen] = useSidebarState('Banquet', false);
  const [isEcommerceOpen, setIsEcommerceOpen] = useSidebarState('Ecommerce', false);
  const [isKioskOpen, setIsKioskOpen] = useSidebarState('Kiosk', false);
  const [isAdminOpen, setIsAdminOpen] = useSidebarState('Admin', false);
  const [isDevOpen, setIsDevOpen] = useSidebarState('Developer', false);
  
  const [theme, setTheme] = useState<AppTheme>('light');
  const [availableLocations, setAvailableLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('');
  const [isPromotionsOpen, setIsPromotionsOpen] = useState(false);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  // Module pages ask for the launcher with this event ("All modules" link)
  useEffect(() => {
    const open = () => setIsAppLauncherOpen(true);
    window.addEventListener('open-app-launcher', open);
    return () => window.removeEventListener('open-app-launcher', open);
  }, []);
  
  const [saasModules, setSaasModules] = useState<string[] | null>(() => {
    if (typeof window !== 'undefined') {
      const s = window.localStorage.getItem('saas_config_cache');
      if (s) { try { return JSON.parse(s).modules; } catch {} }
    }
    return null;
  });
  const [saasPackageName, setSaasPackageName] = useState<string>('');
  const [saasLicenseKey, setSaasLicenseKey] = useState<string>('');
  const [saasTenantName, setSaasTenantName] = useState<string>('');
  const [saasRenewalDate, setSaasRenewalDate] = useState<string>('');
  const [saasStatus, setSaasStatus] = useState<string>('');
  const [saasTrialExpiry, setSaasTrialExpiry] = useState<string>('');
  const [saasInvoices, setSaasInvoices] = useState<any[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  // Set when the server refuses a write because the trial has ended (HTTP 402 from api()).
  const [trialLocked, setTrialLocked] = useState(false);
  useEffect(() => {
    const onEnded = () => setTrialLocked(true);
    window.addEventListener('trial:ended', onEnded);
    return () => window.removeEventListener('trial:ended', onEnded);
  }, []);

  // Trial over: send the user to the package page instead of the app. They can still read, sign out or upgrade there.
  useEffect(() => {
    if (pathname === '/trial-ended') return;
    const days = daysUntil(saasTrialExpiry || saasRenewalDate);
    const expired = saasStatus.toLowerCase() === 'trial' && (trialLocked || (days !== null && days < 0));
    if (expired) router.replace('/trial-ended');
  }, [saasStatus, saasTrialExpiry, saasRenewalDate, trialLocked, pathname, router]);
  const [isMacPlatform, setIsMacPlatform] = useState(false);

  // Ctrl+K / Cmd+K jumps to the top bar search from anywhere in the app.
  useEffect(() => {
    setIsMacPlatform(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [isSaasDialogOpen, setIsSaasDialogOpen] = useState(false);
  // Location switching uses the /select-location page (card UI) for a consistent UX.

  const loadPerms = async () => {
    try {
      const cached = readPermsCache();
      if (cached) {
        setPermissionKeys(cached);
        return;
      }
      const res = await api('/api/auth/permissions');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        writePermsCache(data.data);
        setPermissionKeys(data.data);
      } else {
        setPermissionKeys([]);
      }
    } catch {
      setPermissionKeys([]);
    }
  };

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
      const tokenLocName = json.location_name ? String(json.location_name) : '-';
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
      if (String(json.role || '').toLowerCase() !== 'admin') {
        setAvailableLocations(allowedClean.length > 0 ? allowedClean : (tokenLocId ? [{ id: tokenLocId, name: tokenLocName }] : []));
      }
    } catch {
      setUserRole('');
    }

    void loadPerms();
    void loadSaas();
	  }, []);

  const loadSaas = async (force: boolean = false) => {
    try {
      const CACHE_KEY = 'saas_config_cache';
      const CACHE_TIME_KEY = 'saas_config_cache_time';
      const ONE_DAY = 24 * 60 * 60 * 1000;

      if (!force) {
        const cachedStr = window.localStorage.getItem(CACHE_KEY);
        const cachedTime = window.localStorage.getItem(CACHE_TIME_KEY);
        
        if (cachedStr && cachedTime) {
          const isExpired = Date.now() - parseInt(cachedTime, 10) > ONE_DAY;
          if (!isExpired) {
            try {
              const data = JSON.parse(cachedStr);
              setSaasModules(data.modules);
              setSaasPackageName(data.name || data.package_name);
              setSaasLicenseKey(data.license_key || '');
              setSaasTenantName(data.tenant_name || '');
              setSaasRenewalDate(data.renewal_date || '');
              setSaasStatus(data.status || '');
              setSaasTrialExpiry(data.trial_expiry || '');
              setSaasInvoices(data.invoices || []);
              return;
            } catch (e) {
              // ignore parse errors and fetch fresh
            }
          }
        }
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/saas/config`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(data.data));
        window.localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        setSaasModules(data.data.modules);
        setSaasPackageName(data.data.name || data.data.package_name);
        setSaasLicenseKey(data.data.license_key || '');
        setSaasTenantName(data.data.tenant_name || '');
        setSaasRenewalDate(data.data.renewal_date || '');
        setSaasStatus(data.data.status || '');
        setSaasTrialExpiry(data.data.trial_expiry || '');
        setSaasInvoices(data.data.invoices || []);
      }
    } catch (err) {
      console.error("SaaS Check Failed", err);
    }
  };

  const handleSaasSync = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/saas/sync`);
      const data = await res.json();
      if (data.status === 'success') {
        await loadSaas(true);
      }
    } catch (err) {
      console.error("SaaS Sync Failed", err);
    }
  };

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
    if (userRole.toLowerCase() !== 'admin') return;

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
    setTheme(getTheme());
    const sync = () => setTheme(getTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'theme') return;
      const t = e.newValue;
      applyTheme(t === 'dark' || t === 'dim' ? t : 'light');
      sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_EVENT, sync);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(THEME_EVENT, sync); };
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

  // Subscription page's "Sync now" fires this; reload modules so the sidebar hides/shows sections live
  useEffect(() => {
    const onSaasUpdated = () => void loadSaas(true);
    window.addEventListener('saas:updated', onSaasUpdated);
    return () => window.removeEventListener('saas:updated', onSaasUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearUserSession();
    router.push('/login');
  };

  // Light -> Dark -> Dim -> Light
  const toggleTheme = () => {
    const next = nextTheme(getTheme());
    applyTheme(next);
    setTheme(next);
  };
  const themeLabel = theme === 'light' ? 'Dark mode' : theme === 'dark' ? 'Dim mode' : 'Light mode';

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
    if (!permissionKeys) return false; // wait until loaded to prevent flash of full menu
    if (permissionKeys.includes('*')) return true;
    return permissionKeys.includes(perm);
  };

  const MODULE_ALIASES: Record<string, string[]> = {
    fleet: ['serviceCenter', 'fleet'],
    serviceCenter: ['fleet', 'serviceCenter'],
    marketing: ['promotions', 'marketing'],
    promotions: ['marketing', 'promotions'],
    crm: ['cms', 'crm'],
    cms: ['crm', 'cms'],
    ecommerce: ['storefront', 'ecommerce'],
    frontOffice: ['hotel', 'frontOffice'],
    accounting: ['finance', 'accounting'],
  };

  const isModuleAllowed = (module: string) => {
    if (!saasModules) return false; // wait until loaded to prevent flash
    if (saasModules.includes('*')) return true;
    if (saasModules.includes(module)) return true;
    
    // Check aliases
    const aliases = MODULE_ALIASES[module] || [];
    for (const alias of aliases) {
      if (saasModules.includes(alias)) return true;
    }
    return false;
  };

  const visibleMainNavItems = mainNavItems.filter((it) => hasPerm((it as any).perm));
  const canSeeCoreFeatures = isModuleAllowed('coreFeatures') && visibleMainNavItems.length > 0;

  const visibleServiceCenterItems = serviceCenterItems.filter((it) => hasPerm((it as any).perm));
  const canSeeServiceCenter = isModuleAllowed('fleet') && visibleServiceCenterItems.length > 0;

  const visibleVendorItems = vendorItems.filter((it) => hasPerm((it as any).perm));
  const canSeeVendors = isModuleAllowed('vendors') && visibleVendorItems.length > 0;

  const visibleInventoryItems = inventoryItems.filter((it) => {
    const permOk = hasPerm((it as any).perm);
    if (!permOk) return false;
    // Promotions are now handled separately in the Marketing section
    if (it.label === 'Promotions') return false;
    return isModuleAllowed('inventory');
  });
  const canSeeInventory = visibleInventoryItems.length > 0;

  const visibleMarketingItems = marketingItems.filter((it) => hasPerm(it.perm));
  const canSeeMarketing = isModuleAllowed('marketing') && visibleMarketingItems.length > 0;
  const visibleLoyaltyItems = loyaltyItems.filter((it) => hasPerm(it.perm));
  const canSeeLoyalty = isModuleAllowed('loyalty') && visibleLoyaltyItems.length > 0;

  const visibleCrmItems = crmItems.filter((it) => hasPerm((it as any).perm));
  const canSeeCrm = isModuleAllowed('crm') && visibleCrmItems.length > 0;

  const visibleSalesItems = salesItems.filter((it) => hasPerm((it as any).perm));
  const canSeeSales = isModuleAllowed('sales') && visibleSalesItems.length > 0;

  const visibleMasterDataItems = masterDataItems.filter((it) => hasPerm((it as any).perm));
  const canSeeMasterData = isModuleAllowed('masterData') && visibleMasterDataItems.length > 0;

  const visibleAccountingItems = accountingItems.filter((it) => hasPerm((it as any).perm));
  const canSeeAccounting = isModuleAllowed('accounting') && visibleAccountingItems.length > 0;
  // Reports: its own section; one entry per report group the company is licensed for.
  const visibleReportGroups = hasPerm('reports.read') ? REPORT_GROUPS.filter((g) => !g.module || isModuleAllowed(g.module)) : [];
  const canSeeReports = visibleReportGroups.length > 0;

  const visibleProductionItems = productionItems.filter((it) => hasPerm((it as any).perm));
  const canSeeProduction = isModuleAllowed('production') && visibleProductionItems.length > 0;

  const visibleHrmItems = hrmItems.filter((it) => hasPerm((it as any).perm));
  const canSeeHrm = isModuleAllowed('hrm') && visibleHrmItems.length > 0;

  const visibleFrontOfficeItems = frontOfficeItems.filter((it) => hasPerm((it as any).perm));
  const canSeeFrontOffice = isModuleAllowed('frontOffice') && visibleFrontOfficeItems.length > 0;

  const visibleBanquetItems = banquetItems.filter((it) => hasPerm((it as any).perm));
  const canSeeBanquet = isModuleAllowed('banquet') && visibleBanquetItems.length > 0;

  const visibleEcommerceItems = ecommerceItems.filter((it) => hasPerm((it as any).perm));
  const canSeeEcommerce = isModuleAllowed('ecommerce') && visibleEcommerceItems.length > 0;

  const visibleKioskItems = kioskItems.filter((it) => hasPerm((it as any).perm));
  const canSeeKiosk = isModuleAllowed('kiosk') && visibleKioskItems.length > 0;

  const visibleApprovalItems = approvalItems.filter((it) => hasPerm((it as any).perm));
  const canSeeApprovals = permissionKeys != null && visibleApprovalItems.length > 0;

  const adminItems = userRole.toLowerCase() === 'admin' ? adminNavItems : [];
  const canSeeAdmin = adminItems.length > 0;
  const devMode = useDevMode(userRole.toLowerCase() === 'admin');
  const devItems = devMode ? developerNavItems : [];
  const devActive = devItems.some((it) => pathname.startsWith(it.href));

  const allHrefs = React.useMemo(() => {
    return [
      ...mainNavItems, ...serviceCenterItems, ...vendorItems, ...inventoryItems,
      ...crmItems, ...salesItems, ...masterDataItems, ...accountingItems,
      ...productionItems, ...hrmItems, ...frontOfficeItems, ...banquetItems, ...ecommerceItems, ...kioskItems, ...approvalItems, ...adminItems, ...devItems
    ].map(i => i.href);
  }, [adminItems]);

  const isActiveRoute = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    
    // If it's a sub-path, ensure there isn't a longer, more specific match available.
    const longerMatch = allHrefs.find(otherHref => 
       otherHref !== href && 
       otherHref.length > href.length && 
       (pathname === otherHref || pathname.startsWith(`${otherHref}/`))
    );
    
    return !longerMatch;
  };

  // Auto-open active dropdown on navigation, but allow users to close it manually
  useEffect(() => {
    if (visibleMainNavItems.some(i => isActiveRoute(i.href))) setIsCoreFeaturesOpen(true);
    // Fleet opens only on its own pages (not the shared /dashboard landing) and closes again elsewhere
    setIsServiceCenterOpen(visibleServiceCenterItems.some(i => i.href !== '/dashboard' && isActiveRoute(i.href)));
    if (visibleVendorItems.some(i => pathname.startsWith(i.href)) || pathname.startsWith('/vendors')) setIsVendorsOpen(true);
    if (pathname.startsWith('/inventory')) setIsInventoryOpen(true);
    if (pathname.startsWith('/master-data')) setIsMasterDataOpen(true);
    if (visibleCrmItems.some(i => isActiveRoute(i.href))) setIsCrmOpen(true);
    if (visibleSalesItems.some(i => isActiveRoute(i.href))) setIsSalesOpen(true);
    if (visibleMarketingItems.some(i => isActiveRoute(i.href))) setIsMarketingOpen(true);
    if (visibleLoyaltyItems.some(i => isActiveRoute(i.href))) setIsLoyaltyOpen(true);
    if (pathname.startsWith('/accounting')) setIsAccountingOpen(true);
    if (pathname.startsWith('/production')) setIsProductionOpen(true);
    if (pathname.startsWith('/hrm')) setIsHrmOpen(true);
    if (pathname.startsWith('/approvals')) setIsApprovalsOpen(true);
    if (pathname.startsWith('/front-office')) setIsFrontOfficeOpen(true);
    if (pathname.startsWith('/banquet')) setIsBanquetOpen(true);
    if (pathname.startsWith('/ecommerce')) setIsEcommerceOpen(true);
    if (pathname.startsWith('/kiosk')) setIsKioskOpen(true);
    if (pathname.startsWith('/admin') || pathname === '/settings') setIsAdminOpen(true);
  }, [pathname, permissionKeys, userRole]);

  const coreFeaturesOpen = isCoreFeaturesOpen;
  const serviceCenterOpen = isServiceCenterOpen;
  const vendorsOpen = isVendorsOpen;
  const inventoryOpen = isInventoryOpen;
  const masterDataOpen = isMasterDataOpen;
  const crmOpen = isCrmOpen;
  const salesOpen = isSalesOpen;
  const accountingOpen = isAccountingOpen;
  const productionOpen = isProductionOpen;
  const marketingOpen = isMarketingOpen;
  const hrmOpen = isHrmOpen;
  const frontOfficeOpen = isFrontOfficeOpen;
  const banquetOpen = isBanquetOpen;
  const ecommerceOpen = isEcommerceOpen;
  const adminOpen = isAdminOpen;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background relative" suppressHydrationWarning>
        <Sidebar variant="sidebar" collapsible="icon" className="border-r-0 hidden lg:flex">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 shrink-0 relative flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 shadow-xs">
                <img 
                  src="/icon-bizzflow-logo-optimized.webp" 
                  alt="BizzFlow Icon" 
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  BizzFlow
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">ERP</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold truncate max-w-[120px]">
                  {currentLocationName || "Main Branch"}
                </div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4 gap-1">
                        {!canSeeCoreFeatures ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsCoreFeaturesOpen((v) => !v)}
                        isActive={coreFeaturesOpen}
                        tooltip="Core Features"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          coreFeaturesOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Core Features</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            coreFeaturesOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {coreFeaturesOpen ? (
                        <SidebarMenuSub>
                          {visibleMainNavItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeServiceCenter ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsServiceCenterOpen((v) => !v)}
                        isActive={serviceCenterOpen}
                        tooltip="Fleet Management"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          serviceCenterOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Wrench className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Fleet Management</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            serviceCenterOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {serviceCenterOpen ? (
                        <SidebarMenuSub>
                          {visibleServiceCenterItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeVendors ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsVendorsOpen((v) => !v)}
                        isActive={vendorsOpen}
                        tooltip="Vendors"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          vendorsOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Truck className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Vendors</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            vendorsOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {vendorsOpen ? (
                        <SidebarMenuSub>
                          {visibleVendorItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeInventory ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsInventoryOpen((v) => !v)}
                        isActive={pathname.startsWith('/inventory')}
                        tooltip="Inventory"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/inventory') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeCrm ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsCrmOpen((v) => !v)}
                        isActive={crmOpen}
                        tooltip="CRM"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          crmOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Users className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">CRM</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            crmOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {crmOpen ? (
                        <SidebarMenuSub>
                          {visibleCrmItems.map((item) => (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton asChild isActive={isActiveRoute(item.href)}>
                                <Link href={item.href} target={item.newTab ? "_blank" : undefined}>
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeSales ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsSalesOpen((v) => !v)}
                        isActive={salesOpen}
                        tooltip="Sales"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          salesOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Sales</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            salesOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {salesOpen ? (
                        <SidebarMenuSub>
                          {visibleSalesItems.map((item) => (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton asChild isActive={isActiveRoute(item.href)}>
                                <Link href={item.href} target={item.newTab ? "_blank" : undefined}>
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeMarketing ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsMarketingOpen((v) => !v)}
                        isActive={marketingOpen}
                        tooltip="Marketing"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          marketingOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Gift className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Marketing</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            marketingOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {marketingOpen ? (
                        <SidebarMenuSub>
                          {visibleMarketingItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeLoyalty ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsLoyaltyOpen((v) => !v)}
                        isActive={isLoyaltyOpen}
                        tooltip="Loyalty"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          isLoyaltyOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Award className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Loyalty</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            isLoyaltyOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {isLoyaltyOpen ? (
                        <SidebarMenuSub>
                          {visibleLoyaltyItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeEcommerce ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsEcommerceOpen((v) => !v)}
                        isActive={ecommerceOpen}
                        tooltip="E-commerce"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          ecommerceOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">E-commerce</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            ecommerceOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {ecommerceOpen ? (
                        <SidebarMenuSub>
                          {visibleEcommerceItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeKiosk ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsKioskOpen((v) => !v)}
                        isActive={isKioskOpen}
                        tooltip="Kiosk Module"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          isKioskOpen ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Ticket className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Kiosk</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            isKioskOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {isKioskOpen ? (
                        <SidebarMenuSub>
                          {visibleKioskItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeReports ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsReportsOpen((v) => !v)}
                        isActive={pathname.startsWith('/reports')}
                        tooltip="Reports"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/reports') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Reports</span>
                        <ChevronRight className={cn("ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden", isReportsOpen ? "rotate-90" : "rotate-0")} />
                      </SidebarMenuButton>

                      {isReportsOpen ? (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/reports'}>
                              <Link href="/reports"><BarChart3 className="w-4 h-4" /><span>All reports</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          {visibleReportGroups.map((g) => (
                            <SidebarMenuSubItem key={g.id}>
                              <SidebarMenuSubButton asChild isActive={g.items.some((r) => pathname === r.href)}>
                                <Link href={`/reports?group=${g.id}`}><g.icon className="w-4 h-4" /><span>{g.label}</span></Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeAccounting ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsAccountingOpen((v) => !v)}
                        isActive={pathname.startsWith('/accounting')}
                        tooltip="Accounting"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/accounting') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Landmark className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Accounting</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            accountingOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {accountingOpen ? (
                        <SidebarMenuSub>
                          {visibleAccountingItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeProduction ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsProductionOpen((v) => !v)}
                        isActive={pathname.startsWith('/production')}
                        tooltip="Production"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/production') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Factory className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Production</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            productionOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {productionOpen ? (
                        <SidebarMenuSub>
                          {visibleProductionItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeHrm ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsHrmOpen((v) => !v)}
                        isActive={pathname.startsWith('/hrm')}
                        tooltip="Human Resources"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/hrm') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Users className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Human Resources</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            hrmOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {hrmOpen ? (
                        <SidebarMenuSub>
                          {visibleHrmItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeFrontOffice ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsFrontOfficeOpen((v) => !v)}
                        isActive={pathname.startsWith('/front-office')}
                        tooltip="Front Office"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/front-office') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <Building2 className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Front Office</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            frontOfficeOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {frontOfficeOpen ? (
                        <SidebarMenuSub>
                          {visibleFrontOfficeItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeBanquet ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsBanquetOpen((v) => !v)}
                        isActive={pathname.startsWith('/banquet')}
                        tooltip="Banquet"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/banquet') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <LayoutGrid className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Banquet</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            banquetOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {banquetOpen ? (
                        <SidebarMenuSub>
                          {visibleBanquetItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeMasterData ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
<SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsMasterDataOpen((v) => !v)}
                        isActive={pathname.startsWith('/master-data')}
                        tooltip="Master Data"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/master-data') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            {!canSeeApprovals ? null : (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => setIsApprovalsOpen((v) => !v)}
                        isActive={pathname.startsWith('/approvals')}
                        tooltip="Approvals & Control"
                        className={cn(
                          "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                          pathname.startsWith('/approvals') ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-base sm:text-sm font-medium">Approvals &amp; Control</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                            isApprovalsOpen ? "rotate-90" : "rotate-0"
                          )}
                        />
                      </SidebarMenuButton>

                      {isApprovalsOpen ? (
                        <SidebarMenuSub>
                          {visibleApprovalItems.map((item) => (
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            <SidebarGroup className="mt-auto p-0">
              <SidebarMenu>
                {!canSeeAdmin ? null : (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => setIsAdminOpen((v) => !v)}
                      isActive={pathname.startsWith('/admin') && !devActive}
                      tooltip="Administration"
                      className={cn(
                        "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium",
                        pathname.startsWith('/admin') && !devActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
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
                {devItems.length === 0 ? null : (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => setIsDevOpen((v) => !v)}
                      isActive={devActive}
                      tooltip="Developer Options"
                      className={cn(
                        "transition-all duration-150 py-2.5 px-3 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium",
                        devActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <Settings className="w-5 h-5" />
                      <span className="text-base sm:text-sm font-medium">Developer Options</span>
                      <ChevronRight
                        className={cn(
                          "ml-auto w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden",
                          isDevOpen ? "rotate-90" : "rotate-0"
                        )}
                      />
                    </SidebarMenuButton>
                    {isDevOpen ? (
                      <SidebarMenuSub>
                        {devItems.map((item) => (
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
                      "transition-all duration-200 py-6 sm:py-2 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                      pathname === '/profile' ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold shadow-xs" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
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
          <SidebarFooter className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`Switch to ${themeLabel}`}
                  className="py-2 px-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  onClick={toggleTheme}
                >
                  {theme === 'light' ? <Moon className="w-4 h-4 text-slate-600" /> : theme === 'dark' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  <span className="text-xs font-semibold">
                    {themeLabel}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Logout" 
                  className="py-2 px-3 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs font-semibold">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0">
          {/* Global trial banner: on every page while the workspace is on a trial. Locks once the trial has ended. */}
          {(saasStatus.toLowerCase() === 'trial' || trialLocked) && (() => {
            const days = daysUntil(saasTrialExpiry || saasRenewalDate);
            const ended = trialLocked || (days !== null && days < 0);
            const when = ended
              ? 'your trial has ended, so changes are disabled'
              : days === null
                ? 'your trial is active'
                : days === 0
                  ? 'your trial ends today'
                  : `${days} day${days === 1 ? '' : 's'} left in your trial`;
            return (
              <div
                role="status"
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm sm:px-6',
                  ended
                    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
                    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
                )}
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong className="font-semibold">{ended ? 'Trial ended' : 'Trial'}</strong> · {when}
                    {ended && <span className="hidden sm:inline"> · Upgrade your package or contact your administrator to continue.</span>}
                  </span>
                </span>
                <Link
                  href="/admin/subscription"
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {ended ? 'Upgrade package' : 'Choose a plan'}
                </Link>
              </div>
            );
          })()}
          <header className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
            {/* Left: 9-Dot App Matrix Switcher & Breadcrumbs / Title */}
            <div className="flex items-center gap-3">
              {/* 9-Dot App Launcher Button */}
              <button
                type="button"
                onClick={() => setIsAppLauncherOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 transition-all shadow-xs group"
                title="Open App Launcher (Alt + A)"
              >
                <LayoutGrid className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>

              <SidebarTrigger className="h-9 w-9 hidden lg:flex rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" />

              {/* Breadcrumbs / Page Title */}
              <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  BizzFlow
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-900 dark:text-white font-bold">
                  {docTitle || (pathname.split('/')[1] ? pathname.split('/')[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Dashboard')}
                </span>
              </div>
            </div>

            {/* Center: Global Search Bar */}
            <form
              role="search"
              onSubmit={(e) => e.preventDefault()}
              className="group relative hidden w-48 sm:block md:w-80 lg:w-96"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <Input
                ref={searchRef}
                type="search"
                aria-label="Search"
                placeholder="Search orders, invoices, items…"
                className="h-9 rounded-xl border-slate-200 bg-slate-100/70 pl-10 pr-16 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:bg-slate-900"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 shadow-xs md:inline-flex dark:border-slate-700 dark:bg-slate-800">
                {isMacPlatform ? '⌘' : 'Ctrl'} K
              </kbd>
            </form>

            {/* Right: Actions, Branch, Plan, Notifications & Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Active Branch Selector Pill */}
              {availableLocations.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openLocationSwitcher}
                  className="hidden md:flex items-center gap-1.5 h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="truncate max-w-[120px]">{currentLocationName || "Select Branch"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              )}

              {/* SaaS Active Plan Pill */}
              {saasPackageName && (
                <button 
                  onClick={() => setIsSaasDialogOpen(true)}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 transition-all"
                  title="View License & Subscription"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{saasPackageName}</span>
                </button>
              )}

              {/* Promotions Button */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-1.5 h-9 rounded-xl border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 dark:border-pink-800/40 dark:bg-pink-950/30 dark:text-pink-300 text-xs font-bold transition-all shadow-xs"
                onClick={() => setIsPromotionsOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                <span>Promos</span>
              </Button>

              {/* Straight into the POS (only for users who can use it) */}
              {hasPerm('pos.read') && (
                <Button asChild size="sm" className="h-9 rounded-xl gap-1.5 text-xs font-semibold">
                  <Link href="/cms/pos" title="Open POS">
                    <MonitorSmartphone className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Open POS</span>
                    <span className="sm:hidden sr-only">Open POS</span>
                  </Link>
                </Button>
              )}

              {/* Theme Switcher Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={toggleTheme}
                title={`Switch to ${themeLabel}`}
              >
                {theme === 'light' ? <Moon className="w-4 h-4 text-slate-600" /> : theme === 'dark' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </Button>

              {/* Notification Bell */}
              <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Link href="/approvals/inbox" aria-label={approvalCount ? `${approvalCount} approvals waiting for you` : "My approvals"} title={approvalCount ? `${approvalCount} waiting for your approval` : "No approvals waiting"}>
                  <Bell className="w-4 h-4" />
                  {approvalCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background tabular-nums">
                      {approvalCount > 99 ? "99+" : approvalCount}
                    </span>
                  )}
                </Link>
              </Button>

              {/* User Profile Avatar Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 pl-1 cursor-pointer select-none">
                    <Avatar className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                      <AvatarImage src="https://picsum.photos/seed/user/32/32" />
                      <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold rounded-xl">
                        {(userRole || 'U').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 p-1.5">
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Logged in as</p>
                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 capitalize">{userRole || 'Staff User'}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem asChild className="rounded-xl">
                    <Link href="/profile" className="cursor-pointer flex items-center px-3 py-2 text-xs font-semibold">
                      <User className="mr-2 h-4 w-4 text-slate-400" />
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {availableLocations.length > 0 && (
                    <DropdownMenuItem onClick={openLocationSwitcher} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold">
                      <MapPin className="mr-2 h-4 w-4 text-slate-400" />
                      <span>Switch Branch</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 rounded-xl px-3 py-2 text-xs font-bold">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-24 lg:pb-8 bg-slate-50/50 dark:bg-transparent" suppressHydrationWarning>
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
                <span>Powered by Nebulync</span>
                <a
                  className="text-foreground/80 hover:text-foreground underline underline-offset-2"
                  href="https://www.nebulync.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  www.nebulync.com
                </a>
              </div>
            </div>
          </main>
        </SidebarInset>

        <DockMenu />
        <PromotionsDialog 
          open={isPromotionsOpen} 
          onOpenChange={setIsPromotionsOpen} 
          locationId={currentLocationId}
          locationName={currentLocationName}
        />
        <SaasInfoDialog 
          isOpen={isSaasDialogOpen} 
          onClose={() => setIsSaasDialogOpen(false)} 
          tenantName={saasTenantName}
          packageName={saasPackageName}
          licenseKey={saasLicenseKey}
          modules={saasModules}
          renewalDate={saasRenewalDate}
          invoices={saasInvoices}
          onSync={handleSaasSync}
        />
        <AppLauncher
          isOpen={isAppLauncherOpen}
          onClose={() => setIsAppLauncherOpen(false)}
          isModuleAllowed={isModuleAllowed}
        />
      </div>
    </SidebarProvider>
  );
}

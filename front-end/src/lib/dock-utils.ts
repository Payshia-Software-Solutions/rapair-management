import { 
  mainNavItems, 
  serviceCenterItems, 
  vendorItems, 
  inventoryItems, 
  crmItems, 
  marketingItems, 
  salesItems, 
  masterDataItems, 
  accountingItems, 
  productionItems, 
  hrmItems, 
  frontOfficeItems, 
  banquetItems,
  adminNavItems,
  type NavItem
} from "./nav-items";

export const DOCK_CONFIG_KEY = "bizflow_dock_config";

export function getPermittedDockPool(
  permissionKeys: string[] | null, 
  saasModules: string[] | null,
  userRole: string
): { category: string; items: NavItem[] }[] {
  
  const hasPerm = (perm?: string) => {
    if (!perm) return true;
    if (!permissionKeys) return true;
    if (permissionKeys.includes("*")) return true;
    return permissionKeys.includes(perm);
  };

  const isModuleAllowed = (module: string) => {
    if (!saasModules) return true; 
    if (saasModules.includes("*")) return true;
    return saasModules.includes(module);
  };

  const pool = [
    { category: "Core", items: mainNavItems.filter(it => hasPerm(it.perm)) },
    { category: "Fleet Management", items: isModuleAllowed('serviceCenter') ? serviceCenterItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Inventory", items: isModuleAllowed('inventory') ? inventoryItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Vendors", items: isModuleAllowed('vendors') ? vendorItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "CRM", items: isModuleAllowed('crm') ? crmItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Marketing", items: isModuleAllowed('promotions') ? marketingItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Sales", items: isModuleAllowed('sales') ? salesItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Accounting", items: isModuleAllowed('accounting') ? accountingItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Production", items: isModuleAllowed('production') ? productionItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "HRM", items: isModuleAllowed('hrm') ? hrmItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Front Office", items: isModuleAllowed('frontOffice') ? frontOfficeItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Banquet", items: isModuleAllowed('banquet') ? banquetItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Master Data", items: isModuleAllowed('masterData') ? masterDataItems.filter(it => hasPerm(it.perm)) : [] },
    { category: "Administration", items: userRole.toLowerCase() === "admin" ? adminNavItems : [] },
  ];

  return pool.filter(p => p.items.length > 0);
}

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "guest";
  const token = localStorage.getItem("auth_token");
  if (!token) return "guest";
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload?.sub || payload?.id || payload?.email || "guest");
  } catch {
    return "guest";
  }
}

export function getSavedDockItems(): string[] | null {
  if (typeof window === "undefined") return null;
  const userId = getCurrentUserId();
  const saved = localStorage.getItem(`${DOCK_CONFIG_KEY}_${userId}`);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function saveDockItems(hrefs: string[]) {
  const userId = getCurrentUserId();
  localStorage.setItem(`${DOCK_CONFIG_KEY}_${userId}`, JSON.stringify(hrefs));
  window.dispatchEvent(new Event("dock_config_updated"));
}

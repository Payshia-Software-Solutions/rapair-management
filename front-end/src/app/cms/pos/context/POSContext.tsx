"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchParts,
  fetchTaxes,
  fetchLocations,
  fetchCustomers,
  createCustomer,
  fetchCompany,
  createInvoice,
  createPaymentReceipt,
  fetchBanks,
  fetchBankBranches,
  fetchBrands,
  fetchCollections,
  fetchPosDayLedger,
  fetchTables,
  fetchStewards,
  holdPOSOrder,
  loadHeldOrder,
  fetchHeldOrders,
  fetchSystemSettings,
  fetchKOTDetails,
  voidHeldItem,
  approveComp,
  markKOTPrinted,
  api as apiHelper
} from "@/lib/api";
import { applyTheme, getTheme, nextTheme, THEME_EVENT, type AppTheme } from "@/lib/theme";
import { enqueueKot, fetchJobStatus, getKotRoute } from "@/lib/api/printqueue";
import { computePosTotals, resolveLocationTaxes, type PosTotals } from "@/lib/pricing/pos-totals";
import { posProfileOf, billFieldsText, lineNotesWithSerials, serialCount, type PosProfile } from "@/lib/pos-profiles";
import { unmergeTables } from "@/lib/api/floor";
import { lookupLoyalty, type LoyaltyLookup } from "@/lib/api/loyalty";
import { fetchPromotions, checkPromoCode } from "@/lib/api/promotions";

export type PosLayout = 'mobile' | 'compact' | 'full';
export type PosLayoutPref = 'auto' | 'compact' | 'full';

/**
 * Phones (narrow) get the tabbed view. Typical POS terminals (1024x768,
 * 800x600, 1280x1024, 1366x768) get the compact side-by-side view: no
 * filter sidebar, narrower cart, denser item grid. Wide screens get full.
 */
export function resolvePosLayout(w: number, h: number, pref: PosLayoutPref): PosLayout {
  if (w < 700) return 'mobile';
  // Portrait tablets: a side cart leaves too little room for items, so use Menu / Order tabs
  if (h > w && w < 1024 && pref !== 'compact' && pref !== 'full') return 'mobile';
  if (pref === 'compact') return 'compact';
  if (pref === 'full') return w >= 1100 ? 'full' : 'compact';
  return (w < 1440 || h < 820) ? 'compact' : 'full';
}

interface POSContextType {
  // Data State
  inventory: any[];
  systemTaxes: any[];
  locations: any[];
  customers: any[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  banks: any[];
  bankBranches: any[];
  collections: any[];
  selectedCollectionId: number | null;
  setSelectedCollectionId: (val: number | null) => void;
  selectedBankId: string | null;
  setSelectedBankId: (val: string | null) => void;
  selectedCardCategory: string; // Any, Credit, Debit
  setSelectedCardCategory: (val: string) => void;
  company: any;
  loading: boolean;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;

  // POS State
  cart: any[];
  selectedLocation: string;
  setSelectedLocation: (val: string) => void;
  selectedCustomer: string;
  setSelectedCustomer: (val: string) => void;
  billDiscountValue: number;
  setBillDiscountValue: (val: number) => void;
  billDiscountType: 'flat' | 'percentage';
  setBillDiscountType: (val: 'flat' | 'percentage') => void;
  billDiscountDialogOpen: boolean;
  setBillDiscountDialogOpen: (val: boolean) => void;
  orderType: 'dine_in' | 'take_away' | 'retail' | null;
  setOrderType: (val: 'dine_in' | 'take_away' | 'retail' | null) => void;
  orderTypeDialogOpen: boolean;
  setOrderTypeDialogOpen: (val: boolean) => void;
  /** Startup loading steps finished so far (for the loading screen) */
  loadProgress: { done: string[]; total: number };
  posProfile: PosProfile;
  loyaltyInfo: LoyaltyLookup | null;
  loyaltyRedeemPoints: number;
  setLoyaltyRedeemPoints: (n: number) => void;
  loyalty: { tierPct: number; tierDiscount: number; points: number; value: number; maxPoints: number; minPoints: number; base: number; pointValue: number };
  refreshLoyalty: () => void;
  billInfo: Record<string, string>;
  setBillInfo: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedTable: string | null;
  setSelectedTable: (val: string | null) => void;
  selectedSteward: string | null;
  setSelectedSteward: (val: string | null) => void;
  tables: any[];
  stewards: any[];
  heldOrderId: number | null;
  setHeldOrderId: (val: number | null) => void;
  heldOrders: any[];
  refreshHeldOrders: () => Promise<void>;

  // Actions
  addToCartWithQty: (product: any, qty: number, discountAmt?: number) => void;
  updateCartLine: (index: number, field: string, value: any) => void;
  removeCartLine: (index: number) => void;
  voidRequest: { index: number; newQty: number } | null;
  setVoidRequest: (v: { index: number; newQty: number } | null) => void;
  approveVoid: (approverId: number, pin: string, reason: string) => Promise<void>;
  /** Complimentary request: one line (index) or the whole bill (index null) */
  compRequest: { index: number | null } | null;
  setCompRequest: (v: { index: number | null } | null) => void;
  /** Manager approved: comp `qty` of the line (or every line for a whole-bill comp) */
  approveCompItems: (approverId: number, pin: string, reason: string, qty?: number) => Promise<void>;
  /** Undo a comp line: it goes back to a paid line (merged into its twin when there is one) */
  removeComp: (index: number) => void;
  handleCheckoutProcess: (paymentData: any) => Promise<void>;
  holdPOSBill: () => Promise<void>;
  /** Print a kitchen ticket (silent to the KOT printer when available). full = reprint every item. */
  printKOT: (orderId: number, full?: boolean) => Promise<void>;
  /** false for order-taking roles (stewards): they hold & send KOTs but can't take payment */
  canCheckout: boolean;
  /** permissions loaded (steward vs cashier known) */
  permsReady: boolean;
  loadPOSBill: (id: number) => Promise<void>;
  reloadData: () => Promise<void>;
  
  // Totals
  totals: PosTotals;
  /** true when the location sells at menu prices (taxes included, breakdown hidden). */
  isMenuPricing: boolean;

  // Screen layout: "mobile" = tabbed, "compact" = small/square POS screens, "full" = wide screens
  posLayout: PosLayout;
  layoutPref: PosLayoutPref;
  setLayoutPref: (val: PosLayoutPref) => void;
  /** Cart panel width in px for side-by-side layouts. */
  cartWidth: number;

  // UI States (Shared)
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  appTheme: AppTheme;
  setAppTheme: (t: AppTheme) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  
  // Management States
  returnDialogOpen: boolean;
  setReturnDialogOpen: (val: boolean) => void;
  refundDialogOpen: boolean;
  setRefundDialogOpen: (val: boolean) => void;
  ledgerDialogOpen: boolean;
  setLedgerDialogOpen: (val: boolean) => void;
  pendingInvoicesDialogOpen: boolean;
  setPendingInvoicesDialogOpen: (val: boolean) => void;
  activeMobileTab: 'shelf' | 'bill';
  setActiveMobileTab: (tab: 'shelf' | 'bill') => void;

  // Product Selection Modal
  productModalOpen: boolean;
  setProductModalOpen: (val: boolean) => void;
  selectedProduct: any;
  setSelectedProduct: (val: any) => void;

  // Quick Customer Add
  addCustomerOpen: boolean;
  setAddCustomerOpen: (val: boolean) => void;
  addingCustomer: boolean;
  setAddingCustomer: (val: boolean) => void;
  newCustomer: { name: string; phone: string };
  setNewCustomer: (val: { name: string; phone: string }) => void;
  handleQuickAddCustomer: (e: React.FormEvent) => Promise<void>;

  // Checkout Dialog State
  checkoutOpen: boolean;
  setCheckoutOpen: (val: boolean) => void;
  openCheckoutDialog: () => void;
  
  // Day Ledger State
  dayLedger: any;
  setDayLedger: (val: any) => void;
  loadingLedger: boolean;
  setLoadingLedger: (val: boolean) => void;

  // Guide State
  guideModalOpen: boolean;
  setGuideModalOpen: (val: boolean) => void;
  
  // Helper for refreshing data
  refreshInventory: (locId?: string | number) => Promise<void>;
  refreshCustomers: () => Promise<void>;

  // Virtual Keyboard State
  vKeyboardEnabled: boolean;
  setVKeyboardEnabled: (val: boolean) => void;
  vKeyboardActiveInput: {
    key: string;
    value: string;
    setter: (val: string) => void;
    type?: 'default' | 'numeric';
  } | null;
  setVKeyboardActiveInput: (input: any) => void;
  
  // Scanner State
  autoAddOnScan: boolean;
  setAutoAddOnScan: (val: boolean) => void;
  
  // Promotion State
  eligiblePromotions: any[];
  setEligiblePromotions: (val: any[]) => void;
  isPromotionPromptOpen: boolean;
  setIsPromotionPromptOpen: (val: boolean) => void;
  promotionsPromptDismissed: boolean;
  setPromotionsPromptDismissed: (val: boolean) => void;
  checkoutIntentActive: boolean;
  setCheckoutIntentActive: (val: boolean) => void;
  claimPromotionRewards: (promo: any) => void;
  appliedPromotion: any | null;
  setAppliedPromotion: (val: any | null) => void;
  /** Offers that need a specific bank card (shown in checkout: "pay with X card to save"). */
  bankOffers: any[];
  /** Offers running right now (for OFFER badges on the item grid). */
  livePromotions: any[];
  promoItemIds: Set<number>;
  promoCategoryIds: Set<number>;
  promoCode: string;
  applyPromoCode: (code: string) => Promise<boolean>;
  clearPromoCode: () => void;
  setTableManagementOpen: (val: boolean) => void;
  setBankBranches: (val: any[]) => void;

  // Print Selection
  printSelectionOpen: boolean;
  setPrintSelectionOpen: (val: boolean) => void;
  lastInvoiceId: number | null;
  setLastInvoiceId: (val: number | null) => void;

  guestPrintSelectionOpen: boolean;
  setGuestPrintSelectionOpen: (val: boolean) => void;
  guestPrintOrderId: number | null;
  setGuestPrintOrderId: (val: number | null) => void;

  // Reservation Link
  reservationDialogOpen: boolean;
  setReservationDialogOpen: (val: boolean) => void;
  handleAddToReservation: (resId: number, items: any[]) => Promise<void>;

  // Filters State
  posActiveFilters: string[];
  selectedBrandName: string | null;
  setSelectedBrandName: (val: string | null) => void;
  selectedItemType: string | null;
  setSelectedItemType: (val: string | null) => void;
  selectedSectionName: string | null;
  setSelectedSectionName: (val: string | null) => void;
  selectedDepartmentName: string | null;
  setSelectedDepartmentName: (val: string | null) => void;
  selectedCategoryName: string | null;
  setSelectedCategoryName: (val: string | null) => void;
  selectedSupplierName: string | null;
  setSelectedSupplierName: (val: string | null) => void;
}


const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedCardCategory, setSelectedCardCategory] = useState<string>("Credit");

  // ---- Screen layout (auto-detects small square POS screens) ----
  const [layoutPref, setLayoutPrefState] = useState<PosLayoutPref>('auto');
  const [viewport, setViewport] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('pos_layout_pref');
      if (saved === 'auto' || saved === 'compact' || saved === 'full') setLayoutPrefState(saved);
    } catch {}
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const setLayoutPref = (val: PosLayoutPref) => {
    setLayoutPrefState(val);
    try { window.localStorage.setItem('pos_layout_pref', val); } catch {}
  };

  // Data Context
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [allTaxes, setAllTaxes] = useState<any[]>([]);
  const [systemTaxes, setSystemTaxes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankBranches, setBankBranches] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  // Filters State
  const [posActiveFilters, setPosActiveFilters] = useState<string[]>(['collections', 'recipe_types']);
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);

  // POS State
  const [cart, setCart] = useState<any[]>([]);
  const [selectedLocation, _setSelectedLocation] = useState<string>("");
  // POS profile of the active location (lib/pos-profiles.ts)
  const posProfile = posProfileOf(locations.find((l: any) => String(l.id) === String(selectedLocation)));
  const posLayout = resolvePosLayout(viewport.w, viewport.h, posProfile.forceCompact && layoutPref === 'auto' ? 'compact' : layoutPref);
  const cartWidth = posLayout === 'full' ? 450 : viewport.w < 900 ? 300 : 340;
  // Bill details the profile asks for (vehicle no, patient, site...): saved in the invoice notes
  const [billInfo, setBillInfo] = useState<Record<string, string>>({});
  // Loyalty card of the selected customer, and the points the cashier chose to redeem
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyLookup | null>(null);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0);
  const [loyaltyRefresh, setLoyaltyRefresh] = useState(0);
  const refreshLoyalty = () => setLoyaltyRefresh((n) => n + 1);
  const setSelectedLocation = (val: string) => {
    _setSelectedLocation(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('location_id', val);
    }
    // Refresh inventory and tables when location changes
    refreshInventory(val);
    refreshTablesAndStewards(val);
    
    // Auto-select default customer for new location
    const currentLoc = locations.find((l: any) => String(l.id) === String(val));
    if (currentLoc?.default_customer_id) {
      setSelectedCustomer(String(currentLoc.default_customer_id));
    }
  };
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [billDiscountDialogOpen, setBillDiscountDialogOpen] = useState(false);
  const [orderType, setOrderType] = useState<'dine_in' | 'take_away' | 'retail' | null>(null);
  const [orderTypeDialogOpen, setOrderTypeDialogOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: string[]; total: number }>({ done: [], total: 10 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSteward, setSelectedSteward] = useState<string | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [stewards, setStewards] = useState<any[]>([]);
  const [dataRefreshing, setDataRefreshing] = useState(false);

  // Management UI States
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [pendingInvoicesDialogOpen, setPendingInvoicesDialogOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'shelf' | 'bill'>('shelf');

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Quick Customer State
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

  // Checkout State
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Day Ledger State
  const [dayLedger, setDayLedger] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Guide State
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Held Orders State
  const [heldOrderId, setHeldOrderId] = useState<number | null>(null);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  // Virtual Keyboard
  const [vKeyboardEnabled, setVKeyboardEnabledState] = useState(false);
  const [vKeyboardActiveInput, setVKeyboardActiveInput] = useState<any>(null);

  const setVKeyboardEnabled = (val: boolean) => {
    setVKeyboardEnabledState(val);
    window?.localStorage?.setItem('v_keyboard_enabled', val ? '1' : '0');
  };

  // Scanner State
  const [autoAddOnScanState, setAutoAddOnScanState] = useState(false);
  const setAutoAddOnScan = (val: boolean) => {
    setAutoAddOnScanState(val);
    window?.localStorage?.setItem('auto_add_on_scan', val ? '1' : '0');
  };

  const [eligiblePromotions, setEligiblePromotions] = useState<any[]>([]);
  const [appliedPromotion, setAppliedPromotion] = useState<any | null>(null);
  const [isPromotionPromptOpen, setIsPromotionPromptOpen] = useState(false);
  const [promotionsPromptDismissed, setPromotionsPromptDismissed] = useState(false);
  const [checkoutIntentActive, setCheckoutIntentActive] = useState(false);
  const [tableManagementOpen, setTableManagementOpen] = useState(false);
  const lastFootprint = React.useRef("");
  const [bankOffers, setBankOffers] = useState<any[]>([]);
  const [livePromotions, setLivePromotions] = useState<any[]>([]);
  const [promoCode, setPromoCode] = useState("");
  // The cashier picked or removed an offer by hand: stop auto-applying the best one on this bill
  const promoManualRef = React.useRef(false);

  // Print Selection State
  const [printSelectionOpen, setPrintSelectionOpen] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null);

  // Guest Print Selection State
  const [guestPrintSelectionOpen, setGuestPrintSelectionOpen] = useState(false);
  const [guestPrintOrderId, setGuestPrintOrderId] = useState<number | null>(null);

  // Reservation State
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);

  // Global Barcode Scanner Listener
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Increased to 2000ms (2 seconds) so you can simulate it by typing manually.
      if (now - lastKeyTime > 2000) {
        buffer = "";
      }
      
      if (e.key === 'Enter') {
        let barcodeToSearch = "";

        if (buffer.length >= 2) {
          barcodeToSearch = buffer.toLowerCase().trim();
        } else if (document.activeElement?.tagName === 'INPUT') {
          // Fallback: If user manually typed it in an input (like search bar) and pressed Enter
          const inputVal = (document.activeElement as HTMLInputElement).value;
          if (inputVal && inputVal.length >= 2) {
            barcodeToSearch = inputVal.toLowerCase().trim();
          }
        }

        if (barcodeToSearch.length >= 2) {
          const product = inventory.find(p => 
            p.barcode_number?.toString().toLowerCase().trim() === barcodeToSearch ||
            p.sku?.toString().toLowerCase().trim() === barcodeToSearch ||
            `item-${p.id}` === barcodeToSearch
          );

          if (product) {
            e.preventDefault(); // Prevent form submits
            const outOfStock = product.stock_quantity <= 0 && product.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(product.recipe_type);
            
            if (autoAddOnScanState) {
              if (outOfStock) {
                toast({ title: "Out of Stock", description: `${product.part_name} is out of stock.`, variant: "destructive" });
              } else {
                addToCartWithQty(product, 1, 0);
                toast({ title: "Scanned & Added", description: `${product.part_name} added to cart.`, duration: 2000 });
                // Optional: clear search query if we are in it
                if (document.activeElement?.tagName === 'INPUT') {
                  setSearchQuery("");
                  (document.activeElement as HTMLInputElement).value = "";
                }
              }
            } else {
              if (outOfStock) {
                toast({ title: "Out of Stock", description: `${product.part_name} is out of stock.`, variant: "destructive" });
              } else {
                setSelectedProduct(product);
                setProductModalOpen(true);
              }
            }
          }
        }
        buffer = ""; // Reset after enter
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inventory, autoAddOnScanState, orderType, setSearchQuery]); // dependencies

  const updateAppliedPromotion = (promo: any | null) => {
    // Cleanup old reward items if we are clearing or changing promo
    setCart(prev => prev.filter(i => !i.is_reward));
    promoManualRef.current = true;
    setAppliedPromotion(promo);
  };


    const refreshTablesAndStewards = async (locId?: string | number) => {
        const id = locId || selectedLocation;
        if (!id) return;
        
        setDataRefreshing(true);
        try {
            const [tbls, stds] = await Promise.all([
                fetchTables(id as any).catch(e => { console.error("fetchTables error:", e); return []; }),
                fetchStewards(id as any).catch(e => { console.error("fetchStewards error:", e); return []; })
            ]);
            setTables(tbls);
            setStewards(stds);
        } catch (err) {
            console.error("POS Data Refresh Failed:", err);
        } finally {
            setDataRefreshing(false);
        }
    };

    const refreshInventory = async (locId?: string | number) => {
    const id = locId || selectedLocation || (typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : undefined);
    try {
      const partsRes = await fetchParts('', id);
      setInventory(partsRes);
    } catch (err) {}
  };

  const refreshCustomers = async () => {
    try {
      const custs = await fetchCustomers();
      setCustomers(custs || []);
    } catch (err) {}
  };

  const refreshHeldOrders = async () => {
    const lid = selectedLocation || window?.localStorage?.getItem('location_id');
    if (!lid) return;
    try {
      const res = await fetchHeldOrders(Number(lid));
      setHeldOrders(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error("Failed to refresh held orders:", err);
      toast({ 
        title: "Sync Error", 
        description: "Could not retrieve held bills. Check your connection.",
        variant: "destructive" 
      });
    }
  };

  const reloadData = async () => {
    setLoading(true);
    try {
      // 1. Refresh background data
      await Promise.all([
        refreshInventory(),
        refreshCustomers(),
        refreshTablesAndStewards(),
        refreshHeldOrders(),
        fetchTaxes('', { all: true }).then(t => setAllTaxes(t || [])).catch(() => {}),
        fetchCollections(true).then(c => setCollections(c || [])).catch(() => {}),
        fetchCompany().then(c => setCompany(c)).catch(() => {})
      ]);

      // 2. Clear current transaction (New Bill)
      setCart([]);
      setSelectedCustomer("");
      setSelectedTable(null);
      setSelectedSteward(null);
      setOrderType(null);
      setBillDiscountValue(0);
      setHeldOrderId(null);
      setBillInfo({});
      
      // 3. Trigger Order Type Selection
      setOrderTypeDialogOpen(true);

      toast({
        title: "POS Reset & Reloaded",
        description: "Inventory updated. Please select an order type for the new bill.",
      });
    } catch (err) {
      toast({
        title: "Reload Failed",
        description: "Could not sync latest data from server.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadContext = async () => {
      try {
        setLoading(true);
        const initLocId = typeof window !== 'undefined' ? window.localStorage.getItem('location_id') : undefined;
        // Loading screen progress: each step ticks when its data arrives
        setLoadProgress({ done: [], total: 10 });
        const track = <T,>(label: string, p: Promise<T>): Promise<T> =>
          p.finally(() => setLoadProgress((s) => ({ ...s, done: [...s.done, label] })));
        const [partsRes, taxesRes, locsRes, custsRes, compRes, banksRes, collRes, sysSettingsRes] = await Promise.all([
          track('Items & stock', fetchParts('', initLocId).catch(() => [])),
          track('Taxes', fetchTaxes('', { all: true }).catch(() => [])),
          track('Locations', fetchLocations().catch(() => [])),
          track('Customers', fetchCustomers().catch(() => [])),
          track('Company', fetchCompany().catch(() => null)),
          track('Banks', fetchBanks().catch(() => [])),
          track('Collections', fetchCollections(true).catch(() => [])),
          track('Settings', fetchSystemSettings().catch(() => ({})))
        ]);

        setInventory(partsRes);
        setBanks(banksRes);
        setCollections(collRes);
        
        setAllTaxes(taxesRes || []);
        setLocations(locsRes || []);
        setCustomers(custsRes || []);
        setCompany(compRes);

        // Apply filters setting
        const filtersStr = sysSettingsRes?.pos_active_filters || "collections,recipe_types";
        setPosActiveFilters(filtersStr.split(',').filter(Boolean));

        // Hydrate Location (Only consider locations with is_pos_active enabled)
        const lsLocId = window?.localStorage?.getItem('location_id');
        let activeLocId = "";
        
        const posActiveLocations = (locsRes || []).filter((l: any) => Boolean(l.is_pos_active));

        if (lsLocId && posActiveLocations.some((l: any) => String(l.id) === lsLocId)) {
          activeLocId = lsLocId;
        } else if (posActiveLocations.length === 1) {
          activeLocId = String(posActiveLocations[0].id);
        }

        if (activeLocId) {
          _setSelectedLocation(activeLocId);
          // Fetch location-dependent data BEFORE clearing the loading state
          await Promise.all([
            track('Tables & stewards', refreshTablesAndStewards(activeLocId)),
            track('Held bills', fetchHeldOrders(Number(activeLocId))
              .then(res => setHeldOrders(Array.isArray(res) ? res : []))
              .catch(() => {}))
          ]);

          // Auto-select location's default customer, or first customer as fallback
          const currentLoc = (locsRes || []).find((l: any) => String(l.id) === activeLocId);
          if (currentLoc?.default_customer_id) {
            setSelectedCustomer(String(currentLoc.default_customer_id));
          } else if (custsRes?.length > 0) {
            setSelectedCustomer(String(custsRes[0].id));
          }

          // Open Order Type Dialog on load only if a valid POS location is active
          setOrderTypeDialogOpen(true);
        } else {
          _setSelectedLocation("");
          setOrderTypeDialogOpen(false);
        }

        // Keyboard preference
        const lsKeyboard = window?.localStorage?.getItem('v_keyboard_enabled');
        if (lsKeyboard === '1') setVKeyboardEnabledState(true);

        // Auto Add preference
        const lsAutoAdd = window?.localStorage?.getItem('auto_add_on_scan');
        if (lsAutoAdd === '1') setAutoAddOnScanState(true);

      } catch (err) {
        console.error("POS Initialization Failed:", err);
        toast({ title: "Initialization Error", description: "Failed to load POS context.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadContext();
  }, [toast]);

  useEffect(() => {
    if (!selectedLocation || locations.length === 0 || allTaxes.length === 0) return;

    const loc = locations.find(l => String(l.id) === String(selectedLocation));
    if (!loc) return;

    // Location's allowed taxes (falls back to company taxes when not configured)
    setSystemTaxes(resolveLocationTaxes(loc, allTaxes, company));
  }, [selectedLocation, locations, allTaxes, company]);

  // Theme is app-wide (lib/theme): Light / Dark / Dim. `theme` stays light|dark for components
  // that only need "is it dark?"; `appTheme` is the exact palette.
  const [appTheme, setAppThemeState] = useState<AppTheme>('light');
  useEffect(() => {
    const sync = () => {
      const t = getTheme();
      setAppThemeState(t);
      setTheme(t === 'light' ? 'light' : 'dark');
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const setAppTheme = (t: AppTheme) => applyTheme(t);
  // Light -> Dark -> Dim -> Light
  const toggleTheme = () => applyTheme(nextTheme(getTheme()));

  // Automatically enforce the Order Type Selector if no order type is selected 
  // and no other management/action modals are currently blocking the view.
  useEffect(() => {
    if (
        !loading && 
        selectedLocation && 
        !orderType && 
        !orderTypeDialogOpen &&
        !returnDialogOpen && 
        !refundDialogOpen && 
        !ledgerDialogOpen && 
        !pendingInvoicesDialogOpen &&
        !guideModalOpen &&
        !checkoutOpen &&
        !posProfile.floorPlan
    ) {
        setOrderTypeDialogOpen(true);
    }
  }, [
    loading, 
    selectedLocation,
    orderType, 
    orderTypeDialogOpen, 
    returnDialogOpen, 
    refundDialogOpen, 
    ledgerDialogOpen, 
    guideModalOpen,
    checkoutOpen
  ]);

  // Retail-first profiles (supermarket, pharmacy, phone...): a new bill starts as Retail straight
  // away instead of showing the order-type popup. The popup still opens from the menu button.
  useEffect(() => {
    if (orderTypeDialogOpen && !orderType && posProfile.defaultOrderType) {
      setOrderType(posProfile.defaultOrderType);
      setOrderTypeDialogOpen(false);
    }
    // Restaurant: the floor in the left panel replaces the popup (RestaurantHome)
    if (orderTypeDialogOpen && !orderType && posProfile.floorPlan) setOrderTypeDialogOpen(false);
  }, [orderTypeDialogOpen, orderType, posProfile.defaultOrderType, posProfile.floorPlan]);

  // Loyalty: look up the selected customer's membership; a new customer starts with no points used
  useEffect(() => {
    setLoyaltyRedeemPoints(0);
    setLoyaltyInfo(null);
    if (!selectedCustomer) return;
    let alive = true;
    lookupLoyalty(Number(selectedCustomer)).then((d) => { if (alive) setLoyaltyInfo(d); }).catch(() => {});
    return () => { alive = false; };
  }, [selectedCustomer, loyaltyRefresh]);

  // Scan-first profiles add scanned items to the cart, unless the cashier set this themselves
  useEffect(() => {
    try {
      if (window.localStorage.getItem('auto_add_on_scan') === null) setAutoAddOnScanState(Boolean(posProfile.scanFirst));
    } catch {}
  }, [posProfile.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // What the promotion engine sees: customer-facing prices, no comp lines (they are free already)
  const promoCartPayload = (code: string = promoCode) => ({
    items: cart.map(i => ({
      id: i.id, item_id: i.id, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
      discount: Number(i.discount || 0), is_reward: !!i.is_reward, is_comp: !!i.is_comp,
    })),
    bank_id: selectedBankId || null,
    card_category: selectedCardCategory || null,
    location_id: selectedLocation || null,
    order_type: orderType || null,
    promo_code: code || null,
  });

  // Keeps the applied offer's amount in step with the cart (the server is the source of truth)
  const appliedRef = React.useRef<any>(null);
  appliedRef.current = appliedPromotion;

  const validatePromotions = async (force: boolean = false) => {
    if (cart.length === 0) {
      setEligiblePromotions([]);
      setAppliedPromotion(null);
      setBankOffers([]);
      return [];
    }

    try {
      const res = await apiHelper('/api/promotion/validate', {
        method: 'POST',
        body: JSON.stringify({ ...promoCartPayload(), include_potential: true }),
      });
      const resData = await res.json();
      const matches: any[] = Array.isArray(resData.data?.matches) ? resData.data.matches : (Array.isArray(resData.data) ? resData.data : []);
      const potential: any[] = Array.isArray(resData.data?.potential) ? resData.data.potential : [];

      setEligiblePromotions(matches);
      setBankOffers(potential);

      const current = appliedRef.current;
      const instant = matches.filter(m => Number(m.discount_value) > 0);
      if (current) {
        const fresh = matches.find(m => m.promotion_id === current.promotion_id);
        if (!fresh) {
          setAppliedPromotion(null);
          setCart(prev => prev.filter(i => !i.is_reward));
          toast({ title: "Offer removed", description: `${current.name} no longer applies to this bill.` });
        } else if (!promoManualRef.current && instant[0] && Number(instant[0].discount_value) > Number(fresh.discount_value) + 0.009) {
          setAppliedPromotion(instant[0]); // a better offer now applies (e.g. bank card picked)
          toast({ title: "Better offer applied", description: `${instant[0].name}: -LKR ${Number(instant[0].discount_value).toLocaleString()}` });
        } else if (Number(fresh.discount_value) !== Number(current.discount_value)) {
          setAppliedPromotion({ ...fresh, promo_code: current.promo_code });
        }
      } else if (!promoManualRef.current && instant[0]) {
        setAppliedPromotion(instant[0]);
        toast({ title: "Offer applied", description: `${instant[0].name}: -LKR ${Number(instant[0].discount_value).toLocaleString()}` });
      }
      return matches;
    } catch (error) {
      console.error("Promotion validation failed", error);
      setEligiblePromotions([]);
      return [];
    }
  };

  const applyPromoCode = async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return false;
    try {
      const res = await checkPromoCode(c, promoCartPayload(c));
      setPromoCode(c);
      setCart(prev => prev.filter(i => !i.is_reward));
      promoManualRef.current = true;
      setAppliedPromotion({ ...res, promo_code: c });
      toast({ title: "Promo code applied", description: `${res.name}: -LKR ${Number(res.discount_value).toLocaleString()}` });
      return true;
    } catch (e: any) {
      toast({ title: "Promo code not applied", description: e.message, variant: "destructive" });
      return false;
    }
  };

  const clearPromoCode = () => {
    setPromoCode("");
    if (appliedRef.current?.requires_code) {
      setAppliedPromotion(null);
      promoManualRef.current = false;
    }
  };

  // Offers running now at this location: OFFER badges on the grid (refreshed every 5 minutes,
  // so time-window offers like happy hour switch on and off by themselves)
  useEffect(() => {
    if (!selectedLocation) return;
    let alive = true;
    const load = () => fetchPromotions(selectedLocation).then((rows: any) => { if (alive) setLivePromotions(Array.isArray(rows) ? rows : []); }).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [selectedLocation]);

  const promoItemIds = useMemo(() => new Set<number>(livePromotions.filter(p => !p.requires_code).flatMap((p: any) => (p.item_ids || []).map(Number))), [livePromotions]);
  const promoCategoryIds = useMemo(() => new Set<number>(livePromotions.filter(p => !p.requires_code).flatMap((p: any) => (p.category_ids || []).map(Number))), [livePromotions]);

  // Automatic Promotion Recognition Engine
  useEffect(() => {
    if (cart.length === 0) {
      setEligiblePromotions([]);
      setAppliedPromotion(null);
      setBankOffers([]);
      setPromotionsPromptDismissed(false);
      setPromoCode("");
      promoManualRef.current = false;
      lastFootprint.current = "";
      return;
    }

    // Check if the cart "footprint" (items/quantities) has changed - EXCLUDING rewards
    const currentFootprint = JSON.stringify(cart.filter(i => !i.is_reward).map(i => ({ id: i.id, q: i.quantity })));
    if (currentFootprint !== lastFootprint.current) {
        setPromotionsPromptDismissed(false);
        lastFootprint.current = currentFootprint;
    }

    const timer = setTimeout(() => {
      validatePromotions();
    }, 500);

    return () => clearTimeout(timer);
  }, [cart, selectedLocation, selectedBankId, selectedCardCategory, orderType, promoCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCartWithQty = (product: any, qty: number, discountAmt: number = 0, batches?: any[]) => {
    if (!orderType) {
      setOrderTypeDialogOpen(true);
      toast({ 
        title: "Service Mode Required", 
        description: "Please select Dine-In, Take Away, or Retail to start.",
        variant: "destructive"
      });
      return;
    }
    setCart(prev => {
      // For batch-selected items, we always add a new line to ensure specific lot tracking
      if (batches && batches.length > 0) {
        return [...prev, {
          id: product.id,
          description: product.part_name,
          item_type: product.item_type === "Service" ? "Service" : "Part",
          quantity: qty,
          unit_price: product.price || product.cost_price || 0,
          discount: discountAmt,
          selected_batches: batches
        }];
      }

      const existingLine = posProfile.serials && product.item_type !== "Service" ? undefined : prev.find(item => item.id === product.id && item.unit_price === (product.price || product.cost_price || 0) && item.discount === discountAmt && !item.is_comp && !item.is_reward && !item.selected_batches && !item.item_notes && !(item.modifiers && item.modifiers.length));
      if (existingLine) {
        return prev.map(item => item === existingLine ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, {
        id: product.id,
        description: product.part_name,
        item_type: product.item_type === "Service" ? "Service" : "Part",
        quantity: qty,
        unit_price: product.price || product.cost_price || 0,
        discount: discountAmt
      }];
    });
  };

  // ---- Items already sent to the kitchen (held bill, KOT printed) ----
  // Reducing or removing them needs an approver's PIN; the removal is recorded and
  // a KOT prints it as CANCELLED with the approver's name.
  const [voidRequest, setVoidRequest] = useState<{ index: number; newQty: number } | null>(null);
  const sentQty = (line: any) => (heldOrderId && line?.held_item_id ? Number(line.kot_qty || 0) : 0);

  const updateCartLine = (index: number, field: string, value: any) => {
    if (field === 'quantity') {
      const line = cart[index];
      const sent = sentQty(line);
      if (sent > 0 && Number(value) < sent) {
        setVoidRequest({ index, newQty: Math.max(0, Number(value)) });
        return;
      }
    }
    setCart(prev => {
      const newCart = [...prev];
      if (field === 'quantity' && value <= 0) return prev;
      newCart[index] = { ...newCart[index], [field]: value };
      return newCart;
    });
  };

  const removeCartLine = (index: number) => {
    // A comp line goes back to being paid first; removing the item is then the normal flow
    if (cart[index]?.is_comp) { removeComp(index); return; }
    if (sentQty(cart[index]) > 0) {
      setVoidRequest({ index, newQty: 0 });
      return;
    }
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  /** Approver confirmed: record the removal on the server, update the cart, send the cancel slip. */
  const approveVoid = async (approverId: number, pin: string, reason: string) => {
    if (!voidRequest || !heldOrderId) return;
    const line = cart[voidRequest.index];
    const removeQty = Math.round((sentQty(line) - voidRequest.newQty) * 1000) / 1000;
    if (!line || removeQty <= 0) { setVoidRequest(null); return; }

    await voidHeldItem({ held_item_id: line.held_item_id, quantity: removeQty, reason, approver_id: approverId, approver_pin: pin });

    const keep = voidRequest.newQty;
    setCart(prev => keep <= 0
      ? prev.filter((_, i) => i !== voidRequest.index)
      : prev.map((l, i) => i === voidRequest.index ? { ...l, quantity: keep, kot_qty: keep } : l));
    setVoidRequest(null);
    toast({ title: "Item removed", description: `${removeQty} × ${line.description} cancelled. Sending to the kitchen…` });
    void printKOT(heldOrderId);
  };

  // ---- Complimentary (comp) items ----
  // The line keeps its full price with 100% off. A manager approves with their PIN; the server
  // returns a one-time token that the invoice presents, and checks it when the bill is settled.
  const [compRequest, setCompRequest] = useState<{ index: number | null } | null>(null);
  const sameDish = (a: any, b: any) =>
    a.id === b.id && Number(a.unit_price) === Number(b.unit_price) &&
    (a.item_notes || '') === (b.item_notes || '') &&
    JSON.stringify(a.modifiers || []) === JSON.stringify(b.modifiers || []);

  const approveCompItems = async (approverId: number, pin: string, reason: string, qty?: number) => {
    if (!compRequest) return;
    const wholeBill = compRequest.index === null;
    const targets = wholeBill
      ? cart.map((l, i) => i).filter(i => !cart[i].is_comp && !cart[i].is_reward && Number(cart[i].unit_price) > 0)
      : [compRequest.index as number];
    if (targets.length === 0) { setCompRequest(null); return; }

    const compQty = (i: number) => wholeBill
      ? Number(cart[i].quantity)
      : Math.min(Number(cart[i].quantity), Math.max(0, Number(qty ?? cart[i].quantity)));
    const amount = Math.round(targets.reduce((s, i) => s + compQty(i) * Number(cart[i].unit_price), 0) * 100) / 100;
    if (amount <= 0) { setCompRequest(null); return; }

    const ok = await approveComp({ approver_id: approverId, approver_pin: pin, reason, amount, held_order_id: heldOrderId });
    const compFields = { is_comp: true, comp_token: ok.token, comp_reason: ok.reason, comp_approver_name: ok.approver_name };

    setCart(prev => {
      const next: any[] = [];
      prev.forEach((l, i) => {
        if (!targets.includes(i)) { next.push(l); return; }
        const q = compQty(i);
        const rest = Math.round((Number(l.quantity) - q) * 1000) / 1000;
        const sent = Number(l.kot_qty || 0);
        if (rest > 0) {
          // Split: the paid part keeps its kitchen record; the comp part takes what's left of it
          const restSent = Math.min(rest, sent);
          next.push({ ...l, quantity: rest, kot_qty: restSent });
          next.push({ ...l, ...compFields, quantity: q, discount: Number(l.unit_price), held_item_id: undefined, kot_qty: Math.max(0, sent - restSent) });
        } else {
          next.push({ ...l, ...compFields, discount: Number(l.unit_price) });
        }
      });
      return next;
    });
    setCompRequest(null);
    toast({ title: "Complimentary approved", description: `LKR ${amount.toFixed(2)} by ${ok.approver_name}: ${ok.reason}` });
  };

  const removeComp = (index: number) => {
    setCart(prev => {
      const line = prev[index];
      if (!line?.is_comp) return prev;
      const twin = prev.findIndex((l, i) => i !== index && !l.is_comp && !l.is_reward && sameDish(l, line));
      const { is_comp, comp_token, comp_reason, comp_approver_name, ...plain } = line;
      if (twin >= 0) {
        return prev
          .map((l, i) => i === twin ? {
            ...l,
            quantity: Math.round((Number(l.quantity) + Number(line.quantity)) * 1000) / 1000,
            kot_qty: Number(l.kot_qty || 0) + Number(line.kot_qty || 0),
          } : l)
          .filter((_, i) => i !== index);
      }
      return prev.map((l, i) => i === index ? { ...plain, discount: 0 } : l);
    });
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCustomer(true);
    try {
      const c = await createCustomer({ name: newCustomer.name, phone: newCustomer.phone });
      setCustomers(prev => [...prev, c]);
      setSelectedCustomer(String(c.id));
      setAddCustomerOpen(false);
      setNewCustomer({ name: "", phone: "" });
      toast({ title: "Customer Created", description: "Selected automatically." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingCustomer(false);
    }
  };

  const openCheckoutDialog = async () => {
    if (cart.length === 0) return;
    if (!canCheckout) {
      toast({ title: "Payments are taken by the cashier", description: "Use Send to kitchen. The bill will appear in the cashier's Held list." });
      return;
    }
    if (!selectedLocation) { toast({ title: "Missing Data", description: "Select a location.", variant: "destructive" }); return; }
    
    // Last check with the server: refreshes the offer amount, drops one that stopped applying,
    // and applies the best one. Never blocks checkout; the cashier can switch offers in the cart.
    await validatePromotions(true);
    setCheckoutIntentActive(false);
    setCheckoutOpen(true);
  };

  // Steward (order-taking) or cashier? Decided before the POS renders, so stewards never
  // see cashier tools flash on screen.
  const [canCheckout, setCanCheckout] = useState(true);
  const [permsReady, setPermsReady] = useState(false);
  useEffect(() => {
    apiHelper('/api/auth/permissions')
      .then(r => r.json())
      .then(d => {
        if (d.status !== 'success' || !Array.isArray(d.data)) return;
        const can = d.data.includes('*') || d.data.includes('pos.checkout');
        setCanCheckout(can);
        // Steward device: send kitchen tickets to the kitchen PC unless this terminal chose otherwise
        try { if (!can && window.localStorage.getItem('pos_kot_route') === null) window.localStorage.setItem('pos_kot_route', 'queue'); } catch {}
      })
      .catch(() => {})
      .finally(() => setPermsReady(true));
  }, []);

  // New orders from steward tablets appear in the Held list without a manual refresh
  useEffect(() => {
    if (!selectedLocation) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refreshHeldOrders(); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  const currentLocationRow = useMemo(
    () => locations.find(l => String(l.id) === String(selectedLocation)),
    [locations, selectedLocation]
  );
  const isMenuPricing = currentLocationRow?.tax_mode === 'inclusive';

  const baseTotals = useMemo(() => {
    // Service charge from location settings: dine-in only
    const scRate = (orderType === 'dine_in' && currentLocationRow?.allow_service_charge)
      ? Number(currentLocationRow.service_charge_rate || 0)
      : 0;

    return computePosTotals({
      mode: isMenuPricing ? 'inclusive' : 'exclusive',
      cart: cart.map(i => ({ quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount: Number(i.discount || 0) })),
      taxes: systemTaxes,
      billDiscountType,
      billDiscountValue,
      // Promotions are exclusive (Best Offer Rule)
      promoDiscount: appliedPromotion ? Number(appliedPromotion.discount_value) : 0,
      serviceChargeRate: scRate,
    });
  }, [cart, billDiscountValue, billDiscountType, systemTaxes, orderType, appliedPromotion, currentLocationRow, isMenuPricing]);

  // ---- Loyalty: member tier discount + points redeemed (taken off before tax, like a promotion) ----
  const loyalty = useMemo(() => {
    const none = { tierPct: 0, tierDiscount: 0, points: 0, value: 0, maxPoints: 0, minPoints: 0, base: 0, pointValue: 0 };
    const m = loyaltyInfo?.enabled && loyaltyInfo.member?.active ? loyaltyInfo.member : null;
    if (!m || cart.length === 0) return none;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const base = Math.max(0, baseTotals.taxableAmount);
    const tierPct = Number(m.discount_pct || 0);
    const tierDiscount = r2(base * tierPct / 100);
    const after = Math.max(0, base - tierDiscount);
    const pv = Number(loyaltyInfo?.rules?.point_value || 0);
    const minPoints = Number(loyaltyInfo?.rules?.min_redeem || 0);
    const maxByPct = after * Number(loyaltyInfo?.rules?.max_redeem_pct || 0) / 100;
    let maxPoints = pv > 0 ? Math.floor(Math.min(m.points * pv, maxByPct) / pv) : 0;
    if (maxPoints < minPoints) maxPoints = 0;
    const points = Math.max(0, Math.min(loyaltyRedeemPoints, maxPoints));
    return { tierPct, tierDiscount, points, value: r2(points * pv), maxPoints, minPoints, base, pointValue: pv };
  }, [loyaltyInfo, loyaltyRedeemPoints, baseTotals.taxableAmount, cart.length]);

  const totals = useMemo(() => {
    const extra = loyalty.tierDiscount + loyalty.value;
    if (extra <= 0) return baseTotals;
    const scRate = (orderType === 'dine_in' && currentLocationRow?.allow_service_charge)
      ? Number(currentLocationRow.service_charge_rate || 0)
      : 0;
    return computePosTotals({
      mode: isMenuPricing ? 'inclusive' : 'exclusive',
      cart: cart.map(i => ({ quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount: Number(i.discount || 0) })),
      taxes: systemTaxes,
      billDiscountType,
      billDiscountValue,
      promoDiscount: (appliedPromotion ? Number(appliedPromotion.discount_value) : 0) + extra,
      serviceChargeRate: scRate,
    });
  }, [baseTotals, loyalty, cart, billDiscountValue, billDiscountType, systemTaxes, orderType, appliedPromotion, currentLocationRow, isMenuPricing]);

  const claimPromotionRewards = (promo: any) => {
    if (!promo || !promo.missing_rewards) return;
    
    const reward = promo.missing_rewards;
    const product = inventory.find(p => String(p.id) === String(reward.item_id));
    
    if (product) {
      const newLine = {
        id: product.id,
        description: (product.part_name || product.description) + " (Reward)",
        item_type: product.item_type === "Service" ? "Service" : "Part",
        quantity: reward.qty,
        unit_price: 0, // Explicitly zero for easier tracking of free items
        discount: 0,
        is_reward: true,
        promotion_id: promo.promotion_id
      };
      
      setCart(prev => [...prev.filter(i => !i.is_reward), newLine]);
    }
  };

  const handleCheckoutProcess = async (paymentData: any) => {
    if (!orderType) {
      setOrderTypeDialogOpen(true);
      toast({ title: "Service Mode Required", description: "Select Dine-In, Take Away, or Retail to continue.", variant: "destructive" });
      return;
    }

    if (!selectedCustomer) {
      toast({ title: "Choose a customer", description: "Pick a customer for this bill. To skip this every time, set a default customer for this location in Admin → Locations (for example \"Walk-in Customer\").", variant: "destructive" });
      return;
    }

    // Profile checks: required bill details, and one IMEI/serial per unit in phone shops
    const missingField = posProfile.billFields.find(f => f.required && !billInfo[f.key]?.trim());
    if (missingField) {
      toast({ title: `${missingField.label} is required`, description: "Fill it in under Bill details in the cart.", variant: "destructive" });
      return;
    }
    if (posProfile.serials) {
      const bad = cart.find(l => l.item_type !== 'Service' && !l.is_reward && serialCount(l.serials) !== Number(l.quantity));
      if (bad) {
        toast({ title: "IMEI / serial needed", description: `${bad.description}: enter ${bad.quantity} serial number${Number(bad.quantity) > 1 ? "s" : ""} (one per unit).`, variant: "destructive" });
        return;
      }
    }
    const profileNotes = billFieldsText(posProfile, billInfo);

    // This will be called by the CheckoutDialog with the detailed payment info
    setSubmitting(true);
    try {
      const currentCust = customers.find(c => String(c.id) === String(selectedCustomer));
      const payload = {
        held_order_id: heldOrderId,
        location_id: Number(selectedLocation),
        customer_id: Number(selectedCustomer),
        billing_address: currentCust?.address || "",
        shipping_address: currentCust?.address || "",
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        // Booked (internal) values. In menu-pricing mode these are the
        // back-calculated base + full tax breakdown; the display_* fields
        // carry what the customer sees on the bill.
        subtotal: totals.internalSubtotal,
        tax_total: totals.taxSum,
        discount_total: totals.internalDiscountTotal,
        grand_total: totals.grandTotal,
        price_display_mode: totals.mode === 'inclusive' ? 'menu' : 'standard',
        display_subtotal: totals.subtotal,
        display_discount_total: totals.lineDiscountTotal + totals.billDiscountAmt + totals.promoDiscountAmt,
        display_service_charge: totals.serviceChargeAmt,
        order_type: orderType || 'retail',
        table_id: selectedTable ? Number(selectedTable) : null,
        steward_id: selectedSteward ? Number(selectedSteward) : null,
        applied_taxes: totals.appliedTaxes,
        notes: [profileNotes, paymentData.notes].filter(Boolean).join(" · ") || "POS Retail Sale",
        source: 'pos',
        loyalty_redeem_points: loyalty.points,
        loyalty_redeem_value: loyalty.value,
        loyalty_tier_discount: loyalty.tierDiscount,
        loyalty_base: loyalty.base,
        applied_promotion_id: appliedPromotion ? appliedPromotion.promotion_id : null,
        applied_promotion_name: appliedPromotion ? appliedPromotion.name : null,
        // The server recomputes the offer and refuses a bigger discount than it gives
        promo_discount: appliedPromotion ? Number(appliedPromotion.discount_value) : 0,
        promo_code: appliedPromotion?.promo_code || promoCode || null,
        bank_id: selectedBankId,
        card_category: selectedCardCategory,
        items: cart.map((item, idx) => ({
          description: item.description,
          item_type: item.item_type,
          item_id: item.id,
          quantity: item.quantity,
          unit_price: totals.internalLines[idx].unit_price,
          discount: totals.internalLines[idx].discount,
          tax_amount: 0,
          line_total: totals.internalLines[idx].line_total,
          display_unit_price: item.unit_price,
          display_discount: item.discount,
          display_line_total: (item.quantity * item.unit_price) - (item.quantity * item.discount),
          item_notes: lineNotesWithSerials(item),
          modifiers: item.modifiers || [],
          is_complimentary: item.is_comp ? 1 : 0,
          comp_token: item.is_comp ? item.comp_token : null,
          is_reward: item.is_reward ? 1 : 0
        })),
        payments: [
          // Gift vouchers first (they pay part of the bill), then the rest of the payment
          ...((paymentData.vouchers || []) as { code: string; amount: number }[]).map(v => ({ method: "Gift Voucher", amount: v.amount, voucherCode: v.code })),
          ...(paymentData.isSplit ? paymentData.splitPayments.map((p: any) => ({
          method: p.method,
          amount: p.amount,
          cardLast4: p.cardLast4,
          cardType: p.cardType,
          cardAuthCode: p.cardAuthCode,
          bankId: p.bankId,
          cardCategory: p.cardCategory,
          chequeNo: p.chequeNo,
          chequeBankName: p.chequeBankName,
          chequeBranchName: p.chequeBranchName,
          chequeDate: p.chequeDate,
          chequePayee: p.chequePayee
        })) : [{
          method: paymentData.method,
          amount: paymentData.amount,
          cardLast4: paymentData.cardLast4,
          cardType: paymentData.cardType,
          cardAuthCode: paymentData.cardAuthCode,
          bankId: paymentData.bankId || selectedBankId,
          cardCategory: paymentData.cardCategory || selectedCardCategory,
          chequeNo: paymentData.chequeNo,
          chequeBankName: paymentData.chequeBankName,
          chequeBranchName: paymentData.chequeBranchName,
          chequeDate: paymentData.chequeDate,
          chequePayee: paymentData.chequePayee
        }])
        ].filter((p: any) => p.method === "Credit" || Number(p.amount) > 0)
      };

      const invoiceRes = await createInvoice(payload);
      const invoiceId = invoiceRes.data.id;
      const lp = invoiceRes.data?.loyalty;
      toast({
        title: "Sale Complete",
        description: lp
          ? `${lp.program || "Rewards"}: +${Number(lp.points).toLocaleString()} points · balance ${Number(lp.balance).toLocaleString()}${lp.tier_up ? ` · moved up to ${lp.tier_up}!` : ""}`
          : "Invoice and payments processed atomically.",
      });
      
      // Update local stock quantities
      await refreshInventory();

      // A merged group is paid: its tables are free again
      if (posProfile.floorPlan && orderType === 'dine_in' && selectedTable && selectedTable !== 'none') {
        unmergeTables(Number(selectedTable)).catch(() => {});
      }
      setCart([]);
      setBillDiscountValue(0);
      setBillDiscountType('flat');
      setHeldOrderId(null);
      setOrderType(null);
      setBillInfo({});
      setLoyaltyRedeemPoints(0);
      refreshLoyalty();
      setOrderTypeDialogOpen(true);
      refreshHeldOrders();
      // Next bill starts with the location's default customer (Walk-in), not just the first one
      const locDefault = locations.find((l: any) => String(l.id) === String(selectedLocation))?.default_customer_id;
      if (locDefault) setSelectedCustomer(String(locDefault));
      else if (customers.length > 0) setSelectedCustomer(String(customers[0].id));
      
      // Instead of opening print immediately, open selection dialog
      setLastInvoiceId(invoiceId);
      setPrintSelectionOpen(true);

    } catch (err: any) {
      toast({ title: "Checkout Failed", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const holdPOSBill = async () => {
    if (cart.length === 0) {
      toast({ title: "Empty Cart", description: "Add items before holding.", variant: "destructive" });
      return;
    }
    // Stewards resuming a held bill: nothing new to send means no KOT (and no re-hold)
    if (!canCheckout && heldOrderId && !cart.some(l => Number(l.quantity) > Number(l.kot_qty || 0))) {
      toast({ title: "Nothing new to send", description: "Add items to send a new KOT." });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        held_order_id: heldOrderId,
        location_id: Number(selectedLocation),
        customer_id: Number(selectedCustomer),
        order_type: orderType || 'retail',
        table_id: selectedTable ? Number(selectedTable) : null,
        steward_id: selectedSteward ? Number(selectedSteward) : null,
        // Held bills keep the prices the cashier sees (menu prices in menu-pricing mode).
        subtotal: totals.subtotal,
        tax_total: totals.grandTotal - totals.taxableAmount,
        discount_total: totals.lineDiscountTotal + totals.billDiscountAmt,
        grand_total: totals.grandTotal,
        notes: billFieldsText(posProfile, billInfo),
        items: cart.map(item => ({
          item_id: item.id,
          description: item.description,
          item_type: item.item_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: (item.quantity * item.unit_price) - (item.quantity * item.discount),
          item_notes: lineNotesWithSerials(item),
          modifiers: item.modifiers || [],
          is_complimentary: item.is_comp ? 1 : 0,
          comp_token: item.is_comp ? item.comp_token : null,
          comp_reason: item.is_comp ? item.comp_reason : null
        }))
      };

      const res = await holdPOSOrder(payload);
      if (res.status === 'success') {
        const newId = res.data.id;
        setHeldOrderId(newId);
        toast({ title: "Order Held", description: "Bill saved and KOT sent if new items added." });
        
        // Clear screen for next bill
        setCart([]);
        setHeldOrderId(null);
        setSelectedTable(null);
        setSelectedSteward(null);
        setOrderType(null);
        setBillDiscountValue(0);
        setBillInfo({});
        setOrderTypeDialogOpen(true);
        refreshHeldOrders();

        // Print KOT Automatically
        void printKOT(newId);
      }
    } catch (err: any) {
      toast({ title: "Hold Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const loadPOSBill = async (id: number) => {
    setLoading(true);
    try {
      const data = await loadHeldOrder(id);
      if (data) {
        setHeldOrderId(id);
        setOrderType(data.order_type);
        setSelectedTable(data.table_id ? String(data.table_id) : null);
        setSelectedSteward(data.steward_id ? String(data.steward_id) : null);
        setSelectedCustomer(String(data.customer_id));
        
        const restoredCart = data.items.map((it: any) => ({
          id: it.item_id,
          description: it.description,
          item_type: it.item_type,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount: Number(it.discount),
          item_notes: it.item_notes || undefined,
          modifiers: (() => { try { return it.modifiers_json ? JSON.parse(it.modifiers_json) : []; } catch { return []; } })(),
          held_item_id: it.id,
          ...(Number(it.is_complimentary) === 1 && it.comp_token
            ? { is_comp: true, comp_token: it.comp_token, comp_reason: it.comp_reason || '', discount: Number(it.unit_price) }
            : {}),
          // qty the kitchen already has (needs approval to reduce)
          kot_qty: it.kot_printed_qty != null ? Math.min(Number(it.quantity), Number(it.kot_printed_qty)) : (Number(it.is_kot_printed) === 1 ? Number(it.quantity) : 0)
        }));
        setCart(restoredCart);
        
        // Re-calculate bill discount if any
        // (For now we assume no bill discount was saved or we handle it via totals)
        setBillDiscountValue(0); 

        toast({ title: "Order Loaded", description: `Recallled Bill #${id}` });
      }
    } catch (err: any) {
      toast({ title: "Load Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const printKOT = async (orderId: number, full = false) => {
    if (getKotRoute() === 'queue') {
      try {
        const res = await enqueueKot(orderId, full);
        if (!res.queued) {
          toast({ title: "No new items for the kitchen", description: "Everything on this bill was already sent." });
          return;
        }
        const tickets = Number((res as any).tickets || 1);
        toast({ title: "Sent to kitchen", description: tickets > 1 ? `KOT #${orderId} split into ${tickets} tickets (kitchen, bar…).` : `KOT #${orderId} is on its way to the kitchen printer.` });
        // Confirm it actually printed; warn if the kitchen PC isn't collecting
        const jobIds: number[] = (res as any).job_ids || (res.job_id ? [res.job_id] : []);
        if (jobIds.length) {
          setTimeout(async () => {
            try {
              const sts = await fetchJobStatus(jobIds);
              const st = sts.find(x => x.status === 'failed') || sts.find(x => x.status !== 'done');
              if (st && st.status === 'failed') {
                toast({ title: "Kitchen printer error", description: st.error || `KOT #${orderId} could not be printed.`, variant: "destructive" });
              } else if (st && st.status !== 'done') {
                toast({ title: "Queued – kitchen printer offline?", description: `KOT #${orderId} hasn't printed yet. It will print when the kitchen PC is back.`, variant: "destructive" });
              }
            } catch {}
          }, 10000);
        }
      } catch (e: any) {
        toast({ title: "Couldn't send to kitchen", description: e?.message || "Check the connection and try again.", variant: "destructive" });
      }
      return;
    }
    try {
      // Nothing new for the kitchen? Don't waste paper (or open an empty print window)
      const kot = await fetchKOTDetails(orderId, full);
      if (!kot || ((Array.isArray(kot.items) ? kot.items.length : 0) + (Array.isArray(kot.voids) ? kot.voids.length : 0)) === 0) {
        toast({ title: "No new items for the kitchen", description: "Everything on this bill was already sent." });
        return;
      }
      const { printPage } = await import("@/lib/api/silent-print");
      const parts: any[] = (Array.isArray(kot.stations) ? kot.stations : []).filter((p: any) => p.id && (Number(p.items) + Number(p.voids)) > 0);
      if (parts.length === 0) {
        // No print stations: one KOT on the KOT printer, like before
        const url = `/cms/pos/kot/${orderId}${full ? '?full=1' : ''}`;
        const result = await printPage(url, 'KOT', `KOT #${orderId}`, '.kot');
        // Browser fallback marks items itself after window.print(); silent path marks here
        if (result.mode === 'silent' && !full) {
          await markKOTPrinted(orderId).catch(e => console.error("Failed to mark KOT as printed", e));
        }
        if (result.error) toast({ title: "KOT opened in browser", description: result.error, variant: "destructive" });
        return;
      }
      // Print stations: one ticket per station (KOT -> kitchen printer, BOT -> bar printer ...)
      const errors: string[] = [];
      for (const p of parts) {
        const url = `/cms/pos/kot/${orderId}?station=${p.id}${full ? '&full=1' : ''}`;
        const label = `${p.ticket_label || 'KOT'} #${orderId}`;
        const result = await printPage(url, 'KOT', label, '.kot', { printer: p.printer_name, width: p.paper_width });
        if (result.error) errors.push(`${p.name}: ${result.error}`);
      }
      // Ticket parts don't mark themselves; the bill counts as sent once every part went out
      if (!full) await markKOTPrinted(orderId).catch(e => console.error("Failed to mark KOT as printed", e));
      if (errors.length) toast({ title: "Some tickets opened in browser", description: errors.join(' · '), variant: "destructive" });
      else if (parts.length > 1) toast({ title: "Sent to kitchen", description: `${parts.map(p => p.ticket_label).join(' + ')} printed for #${orderId}.` });
    } catch (e: any) {
      toast({ title: "KOT print failed", description: e?.message || "Could not print the kitchen ticket.", variant: "destructive" });
    }
  };

  const handleAddToReservation = async (resId: number, items: any[]) => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
        const response = await apiHelper(`/api/hotel/items-bulk/${resId}`, {
            method: "POST",
            body: JSON.stringify({ items: items })
        });
        if (response.ok) {
            toast({ title: "Success", description: "Items added to guest reservation bill." });
            setReservationDialogOpen(false);
        } else {
            const data = await response.json();
            throw new Error(data.message || "Transfer failed");
        }
    } catch (err: any) {
        toast({ title: "Transfer Error", description: err.message, variant: "destructive" });
    } finally {
        setSubmitting(false);
    }
  };

  const value = {
      inventory, systemTaxes, locations, customers, setCustomers, banks, bankBranches, company, loading, submitting, setSubmitting,
      cart, selectedLocation, setSelectedLocation, selectedCustomer, setSelectedCustomer, 
      billDiscountValue, setBillDiscountValue, billDiscountType, setBillDiscountType,
      billDiscountDialogOpen, setBillDiscountDialogOpen,
      orderType, setOrderType, orderTypeDialogOpen, setOrderTypeDialogOpen,
      loadProgress, posProfile, billInfo, setBillInfo,
      loyaltyInfo, loyaltyRedeemPoints, setLoyaltyRedeemPoints, loyalty, refreshLoyalty,
      selectedTable, setSelectedTable, selectedSteward, setSelectedSteward,
      tables, setTables, stewards, setStewards,
      heldOrderId, setHeldOrderId, heldOrders, refreshHeldOrders,
      addToCartWithQty, updateCartLine, removeCartLine, voidRequest, setVoidRequest, approveVoid,
      compRequest, setCompRequest, approveCompItems, removeComp, handleCheckoutProcess, holdPOSBill, printKOT, canCheckout, permsReady, loadPOSBill, reloadData,
      totals, isMenuPricing, posLayout, layoutPref, setLayoutPref, cartWidth,
      theme, toggleTheme, appTheme, setAppTheme, searchQuery, setSearchQuery,
      returnDialogOpen, setReturnDialogOpen, refundDialogOpen, setRefundDialogOpen, ledgerDialogOpen, setLedgerDialogOpen,
      pendingInvoicesDialogOpen, setPendingInvoicesDialogOpen,
      activeMobileTab, setActiveMobileTab,
      productModalOpen, setProductModalOpen, selectedProduct, setSelectedProduct,
      addCustomerOpen, setAddCustomerOpen, addingCustomer, setAddingCustomer, newCustomer, setNewCustomer, handleQuickAddCustomer,
      checkoutOpen, setCheckoutOpen, openCheckoutDialog,
      dayLedger, setDayLedger, loadingLedger, setLoadingLedger,
      guideModalOpen, setGuideModalOpen,
      refreshInventory, refreshCustomers,
      vKeyboardEnabled, setVKeyboardEnabled, vKeyboardActiveInput, setVKeyboardActiveInput,
      autoAddOnScan: autoAddOnScanState, setAutoAddOnScan,
      collections, selectedCollectionId, setSelectedCollectionId,
      selectedBankId, setSelectedBankId, selectedCardCategory, setSelectedCardCategory,
      // Promotion State
      eligiblePromotions, setEligiblePromotions, appliedPromotion, setAppliedPromotion: updateAppliedPromotion, validatePromotions,
      bankOffers, livePromotions, promoItemIds, promoCategoryIds, promoCode, applyPromoCode, clearPromoCode,
      isPromotionPromptOpen, setIsPromotionPromptOpen,
      promotionsPromptDismissed, setPromotionsPromptDismissed,
      checkoutIntentActive, setCheckoutIntentActive,
      claimPromotionRewards,
      setTableManagementOpen,
      setBankBranches,
      printSelectionOpen,
      setPrintSelectionOpen,
      lastInvoiceId,
      setLastInvoiceId,
      guestPrintSelectionOpen,
      setGuestPrintSelectionOpen,
      guestPrintOrderId,
      setGuestPrintOrderId,
      reservationDialogOpen,
      setReservationDialogOpen,
      handleAddToReservation,
      posActiveFilters,
      selectedBrandName,
      setSelectedBrandName,
      selectedItemType,
      setSelectedItemType,
      selectedSectionName,
      setSelectedSectionName,
      selectedDepartmentName,
      setSelectedDepartmentName,
      selectedCategoryName,
      setSelectedCategoryName,
      selectedSupplierName,
      setSelectedSupplierName
    };
  
    return (
      <POSContext.Provider value={value}>
        {children}
      </POSContext.Provider>
    );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
};

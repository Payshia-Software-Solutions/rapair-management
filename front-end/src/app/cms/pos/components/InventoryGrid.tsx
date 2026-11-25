"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { 
  Search, 
  Plus, 
  RotateCcw, 
  Banknote, 
  History, 
  Store, 
  Info, 
  Sun, 
  Moon, 
  Keyboard, 
  LayoutGrid, 
  RefreshCw,
  Filter,
  LayoutDashboard,
  FileText,
  Barcode,
  Loader2,
  Star,
  Monitor,
  SlidersHorizontal,
  MoreVertical,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePOS } from "../context/POSContext";
import { fetchPosDayLedger } from "@/lib/api";
import { signOut } from "@/lib/session";
import { requestPosLock, getAutoLockMinutes, setAutoLockMinutes } from "./PosLockScreen";
import { getKotRoute, setKotRoute, type KotRoute } from "@/lib/api/printqueue";
import { erpHomeRoute } from "@/lib/home-route";

// Back to ERP opens the company's chosen home dashboard (Company Profile), not a fixed page
const goToErp = async () => { window.location.href = await erpHomeRoute(); };

export const InventoryGrid: React.FC = () => {
  const {
    inventory,
    systemTaxes,
    searchQuery,
    setSearchQuery,
    setGuideModalOpen,
    toggleTheme,
    theme,
    setReturnDialogOpen,
    setRefundDialogOpen,
    setLedgerDialogOpen,
    setPendingInvoicesDialogOpen,
    setLoadingLedger,
    setDayLedger,
    selectedLocation,
    setSelectedProduct,
    setProductModalOpen,
    vKeyboardEnabled,
    setVKeyboardEnabled,
    setVKeyboardActiveInput,
    autoAddOnScan,
    setAutoAddOnScan,
    setTableManagementOpen,
    reloadData,
    loading: dataLoading,
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
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
    setSelectedSupplierName,
    isMenuPricing,
    cart,
    holdPOSBill,
    openCheckoutDialog,
    setBillDiscountDialogOpen,
    checkoutOpen,
    posLayout,
    layoutPref,
    setLayoutPref,
    appTheme,
    setAppTheme,
    canCheckout,
    promoItemIds,
    promoCategoryIds
  } = usePOS();
  // Item is in an offer running right now (item list or category)
  const hasOffer = (p: any) => promoItemIds.has(Number(p.id)) || (Array.isArray(p.collection_ids) && p.collection_ids.some((c: any) => promoCategoryIds.has(Number(c))));
  const offerBadge = <span className="inline-flex items-center rounded px-1 py-0 text-[8px] lg:text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white">Offer</span>;
  // Steward = order-taking only: no sales/manager tools anywhere in the grid
  const isSteward = !canCheckout;
  const isCompact = posLayout === 'compact';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [autoLockMin, setAutoLockMin] = useState(5);
  const [kotRoute, setKotRouteState] = useState<KotRoute>('local');
  useEffect(() => { setKotRouteState(getKotRoute()); }, []);
  useEffect(() => { setAutoLockMin(getAutoLockMinutes()); }, []);

  // ---- Browse mode (per terminal): show every item, or category/collection tiles first ----
  const [browseMode, setBrowseModeState] = useState<'all' | 'groups'>('groups');
  // In groups mode: cashier tapped "All items" to see everything
  const [showAllInGroups, setShowAllInGroups] = useState(false);
  const [groupSource, setGroupSourceState] = useState<'category' | 'collection'>('category');
  useEffect(() => {
    try {
      const m = window.localStorage.getItem('pos_browse_mode');
      if (m === 'all' || m === 'groups') setBrowseModeState(m);
      const g = window.localStorage.getItem('pos_group_source');
      if (g === 'category' || g === 'collection') setGroupSourceState(g);
    } catch {}
  }, []);
  const setBrowseMode = (v: 'all' | 'groups') => {
    setBrowseModeState(v);
    try { window.localStorage.setItem('pos_browse_mode', v); } catch {}
  };
  const setGroupSource = (v: 'category' | 'collection') => {
    setGroupSourceState(v);
    try { window.localStorage.setItem('pos_group_source', v); } catch {}
  };

  const [colSearch, setColSearch] = React.useState("");
  const [selectedRecipeType, setSelectedRecipeType] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- Favorites (per location, saved on this terminal) ----
  const favKey = `pos_favorites_${selectedLocation || 'default'}`;
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(favKey);
      const list = raw ? JSON.parse(raw) : [];
      setFavoriteIds(Array.isArray(list) ? list.map(String) : []);
    } catch {
      setFavoriteIds([]);
    }
  }, [favKey]);

  const toggleFavorite = (id: string | number) => {
    setFavoriteIds(prev => {
      const sid = String(id);
      const next = prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid];
      try { window.localStorage.setItem(favKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const favoriteProducts = useMemo(() => {
    const byId = new Map(inventory.map(p => [String(p.id), p]));
    return favoriteIds.map(id => byId.get(id)).filter(Boolean) as any[];
  }, [inventory, favoriteIds]);

  // ---- Keyboard shortcuts: F2 search, F4 discount, F8 hold, F9 checkout, Alt+L lock ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Alt+L locks from anywhere in the POS (even with a dialog open)
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        requestPosLock();
        return;
      }
      if (checkoutOpen) return;
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4' && cart.length > 0 && !isSteward) {
        e.preventDefault();
        setBillDiscountDialogOpen(true);
      } else if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        void holdPOSBill();
      } else if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        void openCheckoutDialog();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [checkoutOpen, cart.length, holdPOSBill, openCheckoutDialog, setBillDiscountDialogOpen]);

  // Helper to calculate tax-inclusive display price for an item based on active location taxes
  const getTaxInclusivePrice = (basePrice: number) => {
    if (!systemTaxes || systemTaxes.length === 0 || basePrice <= 0) return basePrice;
    let currentBase = basePrice;
    let totalTax = 0;
    const sortedTaxes = [...systemTaxes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    sortedTaxes.forEach(tax => {
      const applyTo = tax.apply_on === 'base_plus_previous' ? currentBase : basePrice;
      const taxAmt = applyTo * (Number(tax.rate_percent || 0) / 100);
      totalTax += taxAmt;
      currentBase += taxAmt;
    });
    return basePrice + totalTax;
  };

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery, selectedCollectionId, selectedRecipeType, selectedBrandName, selectedItemType, selectedSectionName, selectedDepartmentName, selectedCategoryName, selectedSupplierName]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 50);
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget.current]);

  const filteredInventory = useMemo(() => {
    let filtered = [...inventory];

    if (showFavoritesOnly) {
      const favSet = new Set(favoriteIds);
      filtered = filtered.filter(p => favSet.has(String(p.id)));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.part_name?.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) || 
        p.brand?.toLowerCase().includes(q) ||
        p.barcode_number?.toLowerCase().includes(q) ||
        `item-${p.id}`.includes(q)
      );
    }

    // Collection filter
    if (selectedCollectionId !== null) {
      filtered = filtered.filter(p => {
        const cids = Array.isArray(p.collection_ids) ? p.collection_ids : [];
        return cids.includes(selectedCollectionId);
      });
    }

    // Recipe Type filter
    if (selectedRecipeType !== null) {
      filtered = filtered.filter(p => p.recipe_type === selectedRecipeType);
    }

    // Brand filter
    if (selectedBrandName) {
      filtered = filtered.filter(p => (p.brand_name || p.brand) === selectedBrandName);
    }

    // Item Type filter
    if (selectedItemType) {
      filtered = filtered.filter(p => p.item_type === selectedItemType);
    }

    // Section filter
    if (selectedSectionName) {
      filtered = filtered.filter(p => p.section_name === selectedSectionName);
    }

    // Department filter
    if (selectedDepartmentName) {
      filtered = filtered.filter(p => p.department_name === selectedDepartmentName);
    }

    // Category filter
    if (selectedCategoryName) {
      filtered = filtered.filter(p => p.category_name === selectedCategoryName);
    }

    // Supplier filter
    if (selectedSupplierName) {
      filtered = filtered.filter(p => {
        if (!p.suppliers || !Array.isArray(p.suppliers)) return false;
        return p.suppliers.some((s: any) => s.name === selectedSupplierName);
      });
    }

    // Sellable items first; sold-out items drop to the end (stable for the rest)
    const isOut = (p: any) => Number(p.stock_quantity) <= 0 && p.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(p.recipe_type);
    return filtered
      .map((p, i) => ({ p, i, out: isOut(p) }))
      .sort((a, b) => (Number(a.out) - Number(b.out)) || (a.i - b.i))
      .map(x => x.p);
  }, [
    inventory, searchQuery, selectedCollectionId, selectedRecipeType,
    selectedBrandName, selectedItemType, selectedSectionName,
    selectedDepartmentName, selectedCategoryName, selectedSupplierName,
    showFavoritesOnly, favoriteIds
  ]);

  const filteredCollections = useMemo(() => {
    if (!colSearch.trim()) return collections;
    const q = colSearch.toLowerCase();
    return collections.filter(c => c.name?.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const uniqueBrands = useMemo(() => {
    const brands = inventory.map(p => p.brand_name || p.brand).filter(Boolean);
    return Array.from(new Set(brands)).sort();
  }, [inventory]);

  const uniqueItemTypes = useMemo(() => {
    const types = inventory.map(p => p.item_type).filter(Boolean);
    return Array.from(new Set(types)).sort();
  }, [inventory]);

  const uniqueSections = useMemo(() => {
    const sections = inventory.map(p => p.section_name).filter(Boolean);
    return Array.from(new Set(sections)).sort();
  }, [inventory]);

  const uniqueDepartments = useMemo(() => {
    const deps = inventory.map(p => p.department_name).filter(Boolean);
    return Array.from(new Set(deps)).sort();
  }, [inventory]);

  const uniqueCategories = useMemo(() => {
    const cats = inventory.map(p => p.category_name).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [inventory]);

  const uniqueSuppliers = useMemo(() => {
    const sups = inventory.flatMap(p => p.suppliers?.map((s: any) => s.name) || []).filter(Boolean);
    return Array.from(new Set(sups)).sort();
  }, [inventory]);

  // Groups used by the tab bar and the "groups first" browse mode.
  // Falls back to collections when items have no category (and vice versa).
  const effectiveGroupSource: 'category' | 'collection' =
    groupSource === 'collection'
      ? (collections.length > 0 ? 'collection' : 'category')
      : (uniqueCategories.length > 0 ? 'category' : 'collection');

  const groups = useMemo(() => {
    if (effectiveGroupSource === 'category') {
      const counts = new Map<string, number>();
      inventory.forEach(p => { if (p.category_name) counts.set(p.category_name, (counts.get(p.category_name) || 0) + 1); });
      return uniqueCategories.map((c: string) => ({ key: `cat-${c}`, kind: 'category' as const, id: c, label: c, count: counts.get(c) || 0 }));
    }
    return collections.map((col: any) => ({
      key: `col-${col.id}`, kind: 'collection' as const, id: col.id, label: col.name,
      count: inventory.filter(p => Array.isArray(p.collection_ids) && p.collection_ids.includes(col.id)).length,
    })).filter((g: any) => g.count > 0);
  }, [effectiveGroupSource, inventory, uniqueCategories, collections]);

  const clearAllFilters = () => {
    setShowAllInGroups(false);
    setShowFavoritesOnly(false); setSelectedCollectionId(null); setSelectedRecipeType(null); setSelectedBrandName(null);
    setSelectedItemType(null); setSelectedSectionName(null); setSelectedDepartmentName(null); setSelectedCategoryName(null); setSelectedSupplierName(null);
  };

  const openGroup = (g: { kind: 'category' | 'collection'; id: any }) => {
    clearAllFilters();
    if (g.kind === 'category') setSelectedCategoryName(g.id);
    else setSelectedCollectionId(g.id);
  };

  const isGroupActive = (g: { kind: 'category' | 'collection'; id: any }) =>
    !showFavoritesOnly && (g.kind === 'category' ? selectedCategoryName === g.id : selectedCollectionId === g.id);

  const noFilterActive = !showFavoritesOnly && [selectedCollectionId, selectedRecipeType, selectedBrandName, selectedItemType, selectedSectionName, selectedDepartmentName, selectedCategoryName, selectedSupplierName].every(v => v === null);

  // Groups-first mode: show tiles until a group is opened or the cashier searches
  const showGroupTiles = browseMode === 'groups' && groups.length > 0 && noFilterActive && !showAllInGroups && !searchQuery.trim();

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const ActionButtons = ({ isMobileMenu = false }: { isMobileMenu?: boolean }) => {
    const btnClass = isMobileMenu 
       ? "w-full h-12 justify-start gap-4 px-4 rounded-md font-bold border-none" 
       : "h-10 w-10 shrink-0 bg-transparent border-border";

    return (
        <>
            <Button
              variant="outline"
              size={isMobileMenu ? "default" : "icon"}
              className={`${btnClass} ${!isMobileMenu ? "hover:bg-primary/10 hover:border-primary hover:text-primary" : "bg-primary/10 text-primary"}`}
              onClick={goToErp}
            >
              <LayoutDashboard className="w-5 h-5" />
              {isMobileMenu && <span className="font-black">Back to ERP</span>}
            </Button>

            <Button
              variant="outline"
              size={isMobileMenu ? "default" : "icon"}
              className={`${btnClass} ${!isMobileMenu ? "hover:bg-slate-100 dark:hover:bg-slate-800" : "bg-slate-100 dark:bg-slate-900"}`}
              onClick={reloadData}
              disabled={dataLoading}
            >
              <RefreshCw className={`w-5 h-5 text-slate-500 ${dataLoading ? 'animate-spin' : ''}`} />
              {isMobileMenu && <span>Refresh Data</span>}
            </Button>

            <Button
              variant="outline"
              size={isMobileMenu ? "default" : "icon"}
              className={`${btnClass} border-2 ${vKeyboardEnabled ? 'bg-primary/10 border-primary text-primary shadow-sm' : ''} ${!isMobileMenu && !vKeyboardEnabled ? 'text-slate-500' : ''}`}
              onClick={() => setVKeyboardEnabled(!vKeyboardEnabled)}
            >
              <Keyboard className="w-5 h-5 font-bold" />
              {isMobileMenu && <span>Virtual Keyboard</span>}
            </Button>

            <Button
              variant="outline"
              size={isMobileMenu ? "default" : "icon"}
              className={`${btnClass} border-2 ${autoAddOnScan ? 'bg-primary/10 border-primary text-primary shadow-sm' : ''} ${!isMobileMenu && !autoAddOnScan ? 'text-slate-500' : ''}`}
              onClick={() => setAutoAddOnScan(!autoAddOnScan)}
              title="Scanner: Auto Add to Cart"
            >
              <Barcode className="w-5 h-5 font-bold" />
              {isMobileMenu && <span>Scanner Auto-Add</span>}
            </Button>

            <Button
              variant="outline"
              size={isMobileMenu ? "default" : "icon"}
              className={btnClass}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {isMobileMenu && <span>Toggle Theme</span>}
            </Button>

            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400" : "h-10 px-3 shrink-0 font-medium flex items-center gap-2"}
              onClick={() => setReturnDialogOpen(true)}
            >
              <RotateCcw className="w-4 h-4" /> 
              <span>Returns</span>
            </Button>
            
            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" : "h-10 px-3 shrink-0 font-medium flex items-center gap-2"}
              onClick={() => setRefundDialogOpen(true)}
            >
              <Banknote className="w-4 h-4" /> 
              <span>Refunds</span>
            </Button>

            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "h-10 px-3 shrink-0 font-medium flex items-center gap-2"}
              onClick={() => setPendingInvoicesDialogOpen(true)}
            >
              <FileText className="w-4 h-4" /> 
              <span>Pending</span>
            </Button>

            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400" : "h-10 px-3 shrink-0 font-medium flex items-center gap-2"}
              onClick={async () => {
                 setLedgerDialogOpen(true);
                 setLoadingLedger(true);
                 try {
                    const data = await fetchPosDayLedger(selectedLocation);
                    setDayLedger(data);
                 } finally {
                    setLoadingLedger(false);
                 }
              }}
            >
              <History className="w-4 h-4" />
              <span>Summary</span>
            </Button>

            {isMobileMenu && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 mb-2 flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" /> Screen layout
                </p>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900">
                  {(['auto', 'compact', 'full'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLayoutPref(opt)}
                      className={`h-9 rounded-lg text-xs font-bold capitalize transition-colors ${layoutPref === opt ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  Auto picks compact on small / square POS screens. Saved on this terminal.
                </p>

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 mt-4 mb-2 flex items-center gap-1.5">
                  <LayoutGrid className="w-3 h-3" /> Item view
                </p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900">
                  {([['all', 'All items'], ['groups', 'Groups first']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setBrowseMode(val); clearAllFilters(); }}
                      className={`h-9 rounded-lg text-xs font-bold transition-colors ${browseMode === val ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 mt-3 mb-2">Group by</p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900">
                  {([['category', 'Category'], ['collection', 'Collection']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setGroupSource(val); clearAllFilters(); }}
                      className={`h-9 rounded-lg text-xs font-bold transition-colors ${groupSource === val ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  Groups first: the cashier taps a category or collection tile, then picks the item. Search still shows all items.
                </p>
              </div>
            )}
        </>
    );
  };

  return (
    <div className="flex-1 flex h-full bg-slate-50 dark:bg-card border-r border-border overflow-hidden relative">
      {/* Compact screens: filters slide over the grid instead of taking a column */}
      {isCompact && filtersOpen && (
        <div className="absolute inset-0 z-30 bg-black/30" onClick={() => setFiltersOpen(false)} />
      )}
      {/* Vertical Collections Sidebar */}
      <div
        onClick={(e) => {
          // Close the slide-over after a filter is picked
          if (isCompact && (e.target as HTMLElement).closest('button')) setTimeout(() => setFiltersOpen(false), 120);
        }}
        className={`w-64 flex-col border-r border-border bg-white dark:bg-slate-950 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${
          posLayout === 'full' ? 'flex' : isCompact && filtersOpen ? 'flex absolute left-0 top-0 bottom-0 z-40 shadow-2xl animate-in slide-in-from-left duration-200' : 'hidden'
        }`}
      >
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 mb-3">
             <LayoutGrid className="w-4 h-4 text-primary" />
             <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Collections</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search groups..." 
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              className="h-9 pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm"
              onFocus={() => {
                if (vKeyboardEnabled) {
                  setVKeyboardActiveInput({
                    key: "Collection Search",
                    value: colSearch,
                    setter: (val: string) => setColSearch(val)
                  });
                }
              }}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedCollectionId(null);
              setSelectedRecipeType(null);
              setSelectedBrandName(null);
              setSelectedItemType(null);
              setSelectedSectionName(null);
              setSelectedDepartmentName(null);
              setSelectedCategoryName(null);
              setSelectedSupplierName(null);
            }}
            className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${[selectedCollectionId, selectedRecipeType, selectedBrandName, selectedItemType, selectedSectionName, selectedDepartmentName, selectedCategoryName, selectedSupplierName].every(v => v === null) ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
          >
            <Filter className={`w-4 h-4 ${[selectedCollectionId, selectedRecipeType, selectedBrandName, selectedItemType, selectedSectionName, selectedDepartmentName, selectedCategoryName, selectedSupplierName].every(v => v === null) ? 'text-white' : 'text-slate-400'}`} />
            All Items
          </Button>
          
          {posActiveFilters?.includes('recipe_types') && (
            <>
              <div className="pt-2 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recipe Types</p>
              </div>
              
              {['Standard', 'A La Carte', 'Buffet', 'Recipe'].map(type => (
                <Button
                  key={type}
                  variant="ghost"
                  onClick={() => setSelectedRecipeType(type === selectedRecipeType ? null : type)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedRecipeType === type ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedRecipeType === type ? 'bg-white' : 'bg-amber-400'}`} />
                  <span className="truncate">{type}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('collections') && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Collections</p>
              </div>
              
              {filteredCollections.map(col => (
                <Button
                  key={col.id}
                  variant="ghost"
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedCollectionId === col.id ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedCollectionId === col.id ? 'bg-white' : 'bg-slate-300 dark:bg-slate-700'}`} />
                  <span className="truncate">{col.name}</span>
                </Button>
              ))}
              
              {filteredCollections.length === 0 && colSearch && (
                <div className="py-10 text-center px-4">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">No results</p>
                </div>
              )}
            </>
          )}

          {posActiveFilters?.includes('brands') && uniqueBrands.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Brands</p>
              </div>
              
              {uniqueBrands.map((b: any) => (
                <Button
                  key={b}
                  variant="ghost"
                  onClick={() => setSelectedBrandName(b === selectedBrandName ? null : b)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedBrandName === b ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedBrandName === b ? 'bg-white' : 'bg-indigo-400'}`} />
                  <span className="truncate">{b}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('item_type') && uniqueItemTypes.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Item Type</p>
              </div>
              
              {uniqueItemTypes.map((t: any) => (
                <Button
                  key={t}
                  variant="ghost"
                  onClick={() => setSelectedItemType(t === selectedItemType ? null : t)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedItemType === t ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20 hover:bg-violet-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedItemType === t ? 'bg-white' : 'bg-violet-400'}`} />
                  <span className="truncate">{t}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('sections') && uniqueSections.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sections</p>
              </div>
              
              {uniqueSections.map((s: any) => (
                <Button
                  key={s}
                  variant="ghost"
                  onClick={() => setSelectedSectionName(s === selectedSectionName ? null : s)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedSectionName === s ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedSectionName === s ? 'bg-white' : 'bg-emerald-400'}`} />
                  <span className="truncate">{s}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('departments') && uniqueDepartments.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Departments</p>
              </div>
              
              {uniqueDepartments.map((d: any) => (
                <Button
                  key={d}
                  variant="ghost"
                  onClick={() => setSelectedDepartmentName(d === selectedDepartmentName ? null : d)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedDepartmentName === d ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 hover:bg-sky-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedDepartmentName === d ? 'bg-white' : 'bg-sky-400'}`} />
                  <span className="truncate">{d}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('categories') && uniqueCategories.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categories</p>
              </div>
              
              {uniqueCategories.map((c: any) => (
                <Button
                  key={c}
                  variant="ghost"
                  onClick={() => setSelectedCategoryName(c === selectedCategoryName ? null : c)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedCategoryName === c ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedCategoryName === c ? 'bg-white' : 'bg-rose-400'}`} />
                  <span className="truncate">{c}</span>
                </Button>
              ))}
            </>
          )}

          {posActiveFilters?.includes('suppliers') && uniqueSuppliers.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-1">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Suppliers</p>
              </div>
              
              {uniqueSuppliers.map((s: any) => (
                <Button
                  key={s}
                  variant="ghost"
                  onClick={() => setSelectedSupplierName(s === selectedSupplierName ? null : s)}
                  className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-md transition-all ${selectedSupplierName === s ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20 hover:bg-fuchsia-500' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedSupplierName === s ? 'bg-white' : 'bg-fuchsia-400'}`} />
                  <span className="truncate">{s}</span>
                </Button>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border bg-slate-50/30 dark:bg-slate-900/30">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
             <span>Quick Filter</span>
             <Badge variant="outline" className="text-[9px] px-1 h-4">{filteredCollections.length}</Badge>
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar: Search & Actions */}
        <div className={`${isCompact ? 'p-2 gap-1.5' : 'px-3 py-2 gap-2'} bg-white dark:bg-card border-b border-border shadow-sm flex items-center shrink-0`}>
          {isCompact && (
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(v => !v)}
              title="Collections & filters"
              className={`h-10 px-2.5 rounded-md gap-1.5 shrink-0 font-bold ${
                [selectedCollectionId, selectedRecipeType, selectedBrandName, selectedItemType, selectedSectionName, selectedDepartmentName, selectedCategoryName, selectedSupplierName].some(v => v !== null)
                  ? 'bg-primary text-white border-primary hover:bg-primary hover:text-white' : 'text-slate-500'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          )}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={typeof window !== 'undefined' && window.innerWidth < 640 ? "Search..." : "Scan barcode or search products... (F2)"}
              className={`pl-9 h-10 text-sm bg-slate-50 dark:bg-slate-900 border-none focus-visible:ring-1 focus-visible:ring-primary shadow-inner rounded-md`}
              onFocus={() => {
                if (vKeyboardEnabled) {
                  setVKeyboardActiveInput({
                    key: "Product Search",
                    value: searchQuery,
                    setter: (val: string) => setSearchQuery(val)
                  });
                }
              }}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFavoritesOnly(v => !v)}
            title="Show favorite items only"
            className={`${isCompact ? 'hidden' : 'h-10 px-3'} rounded-md gap-1.5 shrink-0 font-bold ${showFavoritesOnly ? 'bg-amber-400 border-amber-400 text-amber-950 hover:bg-amber-400' : 'text-slate-500'}`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            <span className="hidden xl:inline text-xs uppercase tracking-wider">Favorites</span>
          </Button>

          {/* Wide screens: actions in a row. Compact / mobile: everything in the menu. */}
          {posLayout === 'full' && !isSteward && (
            <div className="flex items-center gap-2">
              <ActionButtons />
            </div>
          )}

          {/* Lock (Alt+L) â€” always visible, next to the menu */}
          <Button
            variant="outline"
            size="icon"
            onClick={requestPosLock}
            title="Lock POS (Alt+L)"
            aria-label="Lock POS (Alt+L)"
            aria-keyshortcuts="Alt+L"
            className="h-10 w-10 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          >
            <Lock className="w-4 h-4" />
          </Button>

          {/* Actions menu (also holds the screen layout switch) */}
          <div className="flex">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Menu & screen layout" className={`h-10 w-10 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500`}>
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 max-h-[min(80dvh,560px)] overflow-y-auto p-1.5">
                {(() => {
                  // Compact menu: one row per action, grouped, toggles show their state.
                  const Row = ({ icon: Icon, label, onClick, right, disabled }: { icon: any; label: string; onClick: () => void; right?: React.ReactNode; disabled?: boolean }) => (
                    <button
                      type="button"
                      onClick={onClick}
                      disabled={disabled}
                      className="w-full h-9 px-2.5 rounded-md flex items-center gap-2.5 text-sm text-left hover:bg-muted focus-visible:outline-none focus-visible:bg-muted disabled:opacity-50"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{label}</span>
                      {right}
                    </button>
                  );
                  const Toggle = ({ on }: { on: boolean }) => (
                    <span className={`w-8 h-[18px] rounded-full p-0.5 transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`} aria-hidden="true">
                      <span className={`block w-3.5 h-3.5 rounded-full bg-background shadow transition-transform ${on ? 'translate-x-3.5' : ''}`} />
                    </span>
                  );
                  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
                    <div className="py-1">
                      <div className="px-2.5 pt-1 pb-1 text-xs font-medium text-muted-foreground">{title}</div>
                      {children}
                    </div>
                  );
                  const Segmented = ({ value, options, onChange, label }: { value: string; options: Array<[string, string]>; onChange: (v: any) => void; label: string }) => (
                    <div role="radiogroup" aria-label={label} className={`mx-2.5 mb-1 grid gap-0.5 p-0.5 rounded-md bg-muted`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
                      {options.map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={value === v}
                          onClick={() => onChange(v)}
                          className={`h-7 rounded-sm text-xs transition-colors ${value === v ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  );
                  const openLedger = async () => {
                    setLedgerDialogOpen(true);
                    setLoadingLedger(true);
                    try { setDayLedger(await fetchPosDayLedger(Number(selectedLocation))); } finally { setLoadingLedger(false); }
                  };
                  return (
                    <div className="divide-y divide-border">
                      {/* Actions already shown in the top bar on wide screens are only listed here when space is tight */}
                      {posLayout !== 'full' && !isSteward && (
                        <Section title="Sales">
                          <Row icon={RotateCcw} label="Returns" onClick={() => setReturnDialogOpen(true)} />
                          <Row icon={Banknote} label="Refunds" onClick={() => setRefundDialogOpen(true)} />
                          <Row icon={FileText} label="Pending invoices" onClick={() => setPendingInvoicesDialogOpen(true)} />
                          <Row icon={History} label="Day summary" onClick={openLedger} />
                        </Section>
                      )}

                      <Section title="Terminal">
                        <div className="px-2.5 pt-1 pb-1 text-xs text-muted-foreground">Kitchen tickets (KOT)</div>
                        <Segmented label="Kitchen tickets" value={kotRoute} onChange={(v) => { setKotRoute(v); setKotRouteState(v); }} options={[['local', 'Print here'], ['queue', 'Send to kitchen PC']]} />
                        <p className="px-2.5 pb-1.5 text-[11px] leading-snug text-muted-foreground">Use "Send to kitchen PC" on tablets: the kitchen PC's printer app prints them.</p>
                        <Row icon={Lock} label="Lock screen" onClick={requestPosLock} right={<kbd className="text-[10px] text-muted-foreground">Alt+L</kbd>} />
                        <Row icon={Keyboard} label="On-screen keyboard" onClick={() => setVKeyboardEnabled(!vKeyboardEnabled)} right={<Toggle on={vKeyboardEnabled} />} />
                        <Row icon={Barcode} label="Add to cart on scan" onClick={() => setAutoAddOnScan(!autoAddOnScan)} right={<Toggle on={autoAddOnScan} />} />
                        <Row icon={RefreshCw} label={dataLoading ? 'Refreshingâ€¦' : 'Refresh items & prices'} onClick={reloadData} disabled={dataLoading} />
                      </Section>

                      <Section title="Display">
                        <div className="px-2.5 pb-1 text-xs text-muted-foreground">Theme</div>
                        <Segmented label="Theme" value={appTheme} onChange={setAppTheme} options={[['light', 'Light'], ['dark', 'Dark'], ['dim', 'Dim']]} />
                        <div className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">Screen layout</div>
                        <Segmented label="Screen layout" value={layoutPref} onChange={setLayoutPref} options={[['auto', 'Auto'], ['compact', 'Compact'], ['full', 'Full']]} />
                        <div className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">Item view</div>
                        <Segmented label="Item view" value={browseMode} onChange={(v) => { setBrowseMode(v); clearAllFilters(); }} options={[['all', 'All items'], ['groups', 'Groups first']]} />
                        <div className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">Group by</div>
                        <Segmented label="Group by" value={groupSource} onChange={(v) => { setGroupSource(v); clearAllFilters(); }} options={[['category', 'Category'], ['collection', 'Collection']]} />
                        <div className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">Auto-lock when idle</div>
                        <Segmented label="Auto-lock" value={String(autoLockMin)} onChange={(v) => { setAutoLockMinutes(Number(v)); setAutoLockMin(Number(v)); }} options={[['0', 'Off'], ['2', '2 min'], ['5', '5 min'], ['10', '10 min']]} />
                        <p className="px-2.5 pt-1 text-[11px] leading-snug text-muted-foreground">Saved on this terminal.</p>
                      </Section>

                      <div className="py-1">
                        {isSteward
                          ? <Row icon={LogOut} label="Sign out" onClick={() => signOut()} />
                          : <Row icon={LayoutDashboard} label="Back to ERP" onClick={() => { goToErp(); }} />}
                      </div>
                    </div>
                  );
                })()}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Compact screens: group tabs replace the filter sidebar (one tap, always visible) */}
        {posLayout !== 'full' && (() => {
          const tabClass = (on: boolean) => `shrink-0 h-10 px-4 rounded-lg text-xs font-black uppercase tracking-wide whitespace-nowrap transition-colors ${on ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-white dark:bg-slate-900 border border-border text-slate-600 dark:text-slate-300 hover:border-primary/50'}`;
          return (
            <ScrollRow>
              <button type="button" className={`${tabClass(noFilterActive && !showAllInGroups)} flex items-center gap-1.5`} onClick={clearAllFilters}>
                {browseMode === 'groups' && <LayoutGrid className="w-3.5 h-3.5" />}
                {browseMode === 'groups' ? (effectiveGroupSource === 'category' ? 'Categories' : 'Collections') : 'All'}
              </button>
              {browseMode === 'groups' && (
                <button type="button" className={tabClass(showAllInGroups && noFilterActive)} onClick={() => { clearAllFilters(); setShowAllInGroups(true); }}>
                  All items
                </button>
              )}
              <button type="button" className={`${tabClass(showFavoritesOnly)} flex items-center gap-1.5`} onClick={() => setShowFavoritesOnly(v => !v)}>
                <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : 'text-amber-500 fill-amber-400'}`} /> Favorites
              </button>
              {groups.map(g => (
                <button
                  key={g.key}
                  type="button"
                  className={tabClass(isGroupActive(g))}
                  onClick={() => (isGroupActive(g) ? clearAllFilters() : openGroup(g))}
                >
                  {g.label}
                </button>
              ))}
            </ScrollRow>
          );
        })()}

        {/* Quick-add strip: one tap adds a favorite item */}
        {!isCompact && !showFavoritesOnly && !searchQuery.trim() && favoriteProducts.length > 0 && (
          <div className="px-2 lg:px-4 py-2 bg-amber-50/60 dark:bg-amber-500/5 border-b border-amber-100 dark:border-amber-500/10 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
            {favoriteProducts.map(p => {
              const out = p.stock_quantity <= 0 && p.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(p.recipe_type);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out}
                  onClick={() => handleProductClick(p)}
                  className="shrink-0 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/20 hover:border-amber-500 text-left disabled:opacity-40 transition-colors"
                >
                  <div className="text-xs font-bold leading-tight max-w-[160px] truncate">{p.part_name}</div>
                  <div className="text-[10px] font-black text-amber-700 dark:text-amber-400 tabular-nums">
                    {Number(p.price || p.cost_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Inside a category/collection (or All items / Favorites): clear way back to the cards */}
        {browseMode === 'groups' && groups.length > 0 && !showGroupTiles && !searchQuery.trim() && (() => {
          const current =
            showFavoritesOnly ? 'Favorites' :
            selectedCategoryName ? selectedCategoryName :
            selectedCollectionId !== null ? (collections.find((c: any) => c.id === selectedCollectionId)?.name || 'Collection') :
            showAllInGroups ? 'All items' : 'Filtered items';
          return (
            <div className="px-2 lg:px-4 py-1.5 border-b border-border bg-background flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 pl-2 shrink-0" onClick={clearAllFilters}>
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                {effectiveGroupSource === 'category' ? 'Categories' : 'Collections'}
              </Button>
              <span className="text-sm font-medium truncate">{current}</span>
              <span className="text-xs text-muted-foreground shrink-0">Â· {filteredInventory.length} {filteredInventory.length === 1 ? 'item' : 'items'}</span>
            </div>
          );
        })()}

        {/* Product Grid */}
        <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-2' : 'p-2 lg:p-4'} custom-scrollbar`}>
          {showGroupTiles ? (
            /* Groups-first: big tiles, tap one to open its items */
            <div className={isCompact
              ? 'grid grid-cols-3 gap-2'
              : 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3'}>
              <button
                type="button"
                onClick={() => { clearAllFilters(); setShowAllInGroups(true); }}
                className="h-24 rounded-lg p-3 flex flex-col justify-between text-left border-2 border-dashed border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors active:scale-[0.98]"
              >
                <LayoutGrid className="w-5 h-5 text-primary" aria-hidden="true" />
                <div>
                  <div className="font-semibold text-sm">All items</div>
                  <div className="text-xs text-muted-foreground">{inventory.length} items</div>
                </div>
              </button>
              {favoriteProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => { clearAllFilters(); setShowFavoritesOnly(true); }}
                  className="h-24 rounded-md p-3 flex flex-col justify-between text-left bg-amber-400 hover:bg-amber-500 text-amber-950 transition-colors active:scale-[0.98]"
                >
                  <Star className="w-5 h-5 fill-current" />
                  <div>
                    <div className="font-black text-sm uppercase tracking-wide">Favorites</div>
                    <div className="text-[11px] font-bold opacity-70">{favoriteProducts.length} {favoriteProducts.length === 1 ? 'item' : 'items'}</div>
                  </div>
                </button>
              )}
              {groups.map((g, i) => {
                const palette = [
                  'bg-indigo-600 hover:bg-indigo-700', 'bg-emerald-600 hover:bg-emerald-700', 'bg-sky-600 hover:bg-sky-700',
                  'bg-rose-600 hover:bg-rose-700', 'bg-violet-600 hover:bg-violet-700', 'bg-teal-600 hover:bg-teal-700',
                  'bg-orange-600 hover:bg-orange-700', 'bg-slate-700 hover:bg-slate-800',
                ];
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => openGroup(g)}
                    className={`h-24 rounded-md p-3 flex flex-col justify-end text-left text-white transition-colors active:scale-[0.98] ${palette[i % palette.length]}`}
                  >
                    <div className="font-black text-sm leading-tight uppercase tracking-wide line-clamp-2">{g.label}</div>
                    <div className="text-[11px] font-bold opacity-75 mt-0.5">{g.count} {g.count === 1 ? 'item' : 'items'}</div>
                  </button>
                );
              })}
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              {showFavoritesOnly ? <Star className="w-12 h-12 mb-4 opacity-20" /> : <Search className="w-12 h-12 mb-4 opacity-10" />}
              <p className="font-bold uppercase tracking-widest text-[10px]">
                {showFavoritesOnly ? 'No favorites yet. Tap the star on an item to add it.' : 'No records found'}
              </p>
            </div>
          ) : (
            <div className={isCompact
              ? 'grid grid-cols-3 gap-2'
              : 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 lg:gap-4'}>
              {filteredInventory.slice(0, visibleCount).map(product => {
                const outOfStock = product.stock_quantity <= 0 && product.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(product.recipe_type);
                if (isCompact) {
                  // Compact POS tile: name + price only; stock shows only when it matters.
                  const tracksStock = product.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(product.recipe_type);
                  const qty = Number(product.stock_quantity || 0);
                  const isFav = favoriteIds.includes(String(product.id));
                  return (
                    <div
                      key={product.id}
                      onClick={() => !outOfStock && handleProductClick(product)}
                      className={`relative rounded-lg p-2.5 min-h-[88px] flex flex-col justify-between border transition-colors select-none ${
                        outOfStock
                          ? 'bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 border-border hover:border-primary active:bg-primary/5 cursor-pointer'
                      }`}
                    >
                      <button
                        type="button"
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                        className="absolute top-1 right-1 p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-500 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                      </button>
                      <h4 className={`pr-5 font-semibold text-sm leading-snug line-clamp-3 ${outOfStock ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {product.part_name}
                      </h4>
                      <div className="flex items-end justify-between gap-1 mt-1.5">
                        <span className={`font-black text-sm tabular-nums ${outOfStock ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {Number(product.price || product.cost_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {hasOffer(product) && !outOfStock && offerBadge}
                        {tracksStock && outOfStock && (
                          <span className="text-[9px] font-black uppercase text-rose-500">Sold out</span>
                        )}
                        {tracksStock && !outOfStock && qty <= 5 && (
                          <span className="text-[9px] font-black uppercase text-orange-500 tabular-nums">{Number(qty.toFixed(2))} left</span>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={product.id}
                    onClick={() => !outOfStock && handleProductClick(product)}
                    className={`relative bg-white dark:bg-slate-900 border border-border hover:border-primary transition-all duration-200 flex flex-col justify-between cursor-pointer group active:scale-[0.98] ${isCompact ? 'rounded-lg p-2 min-h-[96px]' : 'hover:shadow-xl rounded-md lg:rounded-lg p-3 lg:p-4'} ${outOfStock ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <div className={`flex justify-between items-start ${isCompact ? 'mb-1' : 'mb-2 lg:mb-4'}`}>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={product.item_type === 'Service' ? 'secondary' : 'outline'} className="text-[8px] lg:text-[10px] tracking-widest uppercase px-1 py-0 w-fit">
                          {product.item_type}
                        </Badge>
                        {hasOffer(product) && offerBadge}
                        {product.recipe_type && product.recipe_type !== 'Standard' && (
                          <Badge variant="outline" className={`text-[8px] lg:text-[10px] tracking-widest uppercase px-1 py-0 w-fit border-none ${product.recipe_type === 'A La Carte' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                            {product.recipe_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {product.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(product.recipe_type) && (
                          <span className={`text-[8px] lg:text-[10px] font-black uppercase ${product.stock_quantity > 5 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {product.stock_quantity} <span className="hidden lg:inline">Left</span>
                          </span>
                        )}
                        <button
                          type="button"
                          title={favoriteIds.includes(String(product.id)) ? 'Remove from favorites' : 'Add to favorites'}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                          className="p-1 -m-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          <Star className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${favoriteIds.includes(String(product.id)) ? 'text-amber-500 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 mb-1 ${isCompact ? 'hidden' : ''}`}>
                        {product.sku && <p className="text-[8px] lg:text-[10px] text-muted-foreground font-mono">{product.sku}</p>}
                        {(product.brand_name || product.brand) && (
                          <span className="text-[8px] lg:text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                            {product.brand_name || product.brand}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors line-clamp-2 text-xs lg:text-sm">{product.part_name}</h4>
                    </div>
                    <div className={`${isCompact ? 'mt-1 pt-1' : 'mt-2 lg:mt-4 pt-2 lg:pt-4'} border-t border-border flex justify-between items-center`}>
                      {(() => {
                        const basePrice = Number(product.price || product.cost_price || 0);
                        // Menu pricing: the price already includes taxes, so no "Incl. Tax" hint.
                        const taxIncPrice = isMenuPricing ? basePrice : getTaxInclusivePrice(basePrice);
                        return (
                          <div className="flex flex-col">
                            <span className={`font-black ${isCompact ? 'text-[13px]' : 'text-sm lg:text-base'} text-slate-900 dark:text-white tabular-nums`}>
                              {isCompact ? '' : 'LKR '}{basePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {!isCompact && taxIncPrice > basePrice && (
                              <span className="text-[10px] lg:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                Incl. Tax: LKR {taxIncPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <div className={`${isCompact ? 'hidden' : 'flex'} w-7 h-7 lg:w-8 lg:h-8 rounded-lg lg:rounded-md bg-slate-50 dark:bg-slate-800 items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm shrink-0`}>
                        <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!showGroupTiles && visibleCount < filteredInventory.length && (
            <div ref={observerTarget} className="h-20 w-full flex items-center justify-center mt-4">
               <Loader2 className="w-6 h-6 animate-spin text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Horizontal tab row that works with a mouse, not just touch:
 *  - â—€ â–¶ buttons appear only when there is more to scroll
 *  - mouse wheel scrolls sideways
 *  - click-and-drag scrolls (a drag never triggers a tab click)
 *  - the selected tab is kept in view
 */
function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // vertical wheel -> horizontal scroll (needs a non-passive listener to stop page scroll)
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [update]);

  // keep the selected tab visible when it changes
  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('.bg-primary');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    update();
  });

  const scrollBy = (dir: number) => ref.current?.scrollBy({ left: dir * Math.max(200, (ref.current?.clientWidth || 400) * 0.6), behavior: 'smooth' });

  const arrow = (dir: -1 | 1) => (
    <button
      type="button"
      aria-label={dir < 0 ? 'Scroll tabs left' : 'Scroll tabs right'}
      onClick={() => scrollBy(dir)}
      className={`absolute top-0 bottom-0 ${dir < 0 ? 'left-0 pl-1 pr-3 bg-gradient-to-r' : 'right-0 pr-1 pl-3 bg-gradient-to-l'} from-slate-100 via-slate-100/95 to-transparent dark:from-slate-950 dark:via-slate-950/95 z-10 flex items-center`}
    >
      <span className="h-8 w-8 rounded-md border border-border bg-background shadow-sm flex items-center justify-center hover:bg-muted">
        {dir < 0 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </span>
    </button>
  );

  return (
    <div className="relative bg-slate-100/80 dark:bg-slate-950 border-b border-border shrink-0">
      {canLeft && arrow(-1)}
      <div
        ref={ref}
        onScroll={update}
        onMouseDown={(e) => { if (e.button === 0) drag.current = { x: e.clientX, left: ref.current!.scrollLeft, moved: false }; }}
        onMouseMove={(e) => {
          const d = drag.current;
          if (!d || !ref.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          if (d.moved) ref.current.scrollLeft = d.left - dx;
        }}
        onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onMouseLeave={() => { drag.current = null; }}
        onClickCapture={(e) => { if (drag.current?.moved) { e.stopPropagation(); e.preventDefault(); } }}
        className="px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
      >
        {children}
      </div>
      {canRight && arrow(1)}
    </div>
  );
}

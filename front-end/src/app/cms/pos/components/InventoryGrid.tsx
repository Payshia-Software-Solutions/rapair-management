"use client";

import React, { useMemo, useState } from "react";
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
  Filter 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePOS } from "../context/POSContext";
import { fetchPosDayLedger } from "@/lib/api";

export const InventoryGrid: React.FC = () => {
  const {
    inventory,
    searchQuery,
    setSearchQuery,
    setGuideModalOpen,
    toggleTheme,
    theme,
    setReturnDialogOpen,
    setRefundDialogOpen,
    setLedgerDialogOpen,
    setLoadingLedger,
    setDayLedger,
    selectedLocation,
    setSelectedProduct,
    setProductModalOpen,
    vKeyboardEnabled,
    setVKeyboardEnabled,
    setVKeyboardActiveInput,
    setTableManagementOpen,
    reloadData,
    loading: dataLoading,
    collections,
    selectedCollectionId,
    setSelectedCollectionId
  } = usePOS();

  const [colSearch, setColSearch] = React.useState("");

  const filteredInventory = useMemo(() => {
    let filtered = [...inventory];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.part_name?.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) || 
        p.brand?.toLowerCase().includes(q)
      );
    }

    // Collection filter
    if (selectedCollectionId !== null) {
      filtered = filtered.filter(p => {
        const cids = Array.isArray(p.collection_ids) ? p.collection_ids : [];
        return cids.includes(selectedCollectionId);
      });
    }

    return filtered;
  }, [inventory, searchQuery, selectedCollectionId]);

  const filteredCollections = useMemo(() => {
    if (!colSearch.trim()) return collections;
    const q = colSearch.toLowerCase();
    return collections.filter(c => c.name?.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const ActionButtons = ({ isMobileMenu = false }: { isMobileMenu?: boolean }) => {
    const btnClass = isMobileMenu 
       ? "w-full h-12 justify-start gap-4 px-4 rounded-xl font-bold border-none" 
       : "h-10 w-10 shrink-0 bg-transparent border-border";

    return (
        <>
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
              className={btnClass}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {isMobileMenu && <span>Toggle Theme</span>}
            </Button>

            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400" : "h-10 px-3 shrink-0 bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 font-bold flex items-center gap-2"}
              onClick={() => setReturnDialogOpen(true)}
            >
              <RotateCcw className="w-4 h-4" /> 
              <span>Returns</span>
            </Button>
            
            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" : "h-10 px-3 shrink-0 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 font-bold flex items-center gap-2"}
              onClick={() => setRefundDialogOpen(true)}
            >
              <Banknote className="w-4 h-4" /> 
              <span>Refunds</span>
            </Button>

            <Button
              variant="outline"
              className={isMobileMenu ? btnClass + " bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400" : "h-10 px-3 shrink-0 bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-400 font-bold flex items-center gap-2"}
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
        </>
    );
  };

  return (
    <div className="flex-1 flex h-full bg-slate-50 dark:bg-card border-r border-border overflow-hidden">
      {/* Vertical Collections Sidebar - Hidden on mobile */}
      <div className="w-64 flex flex-col border-r border-border bg-white dark:bg-slate-950 shrink-0 hidden lg:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
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
            onClick={() => setSelectedCollectionId(null)}
            className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-xl transition-all ${selectedCollectionId === null ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
          >
            <Filter className={`w-4 h-4 ${selectedCollectionId === null ? 'text-white' : 'text-slate-400'}`} />
            All Items
          </Button>
          
          {filteredCollections.map(col => (
            <Button
              key={col.id}
              variant="ghost"
              onClick={() => setSelectedCollectionId(col.id)}
              className={`w-full justify-start gap-3 h-11 px-3 font-bold rounded-xl transition-all ${selectedCollectionId === col.id ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
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
        <div className="p-4 bg-white dark:bg-card border-b border-border shadow-sm flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Scan barcode or search products..." 
              className="pl-10 h-14 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary shadow-inner rounded-xl text-lg backdrop-blur-xl"
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

          {/* Desktop Actions Row */}
          <div className="hidden md:flex items-center gap-2">
            <ActionButtons />
          </div>

          {/* Mobile Actions Menu */}
          <div className="flex md:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-14 w-14 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500">
                  <Settings2 className="w-6 h-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[280px] p-4 rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-950">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Quick Actions</p>
                    <div className="grid grid-cols-1 gap-2">
                       <ActionButtons isMobileMenu />
                    </div>
                 </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredInventory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Search className="w-12 h-12 mb-4 opacity-10" />
              <p className="font-bold uppercase tracking-widest text-[10px]">No records found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredInventory.map(product => {
                const outOfStock = product.stock_quantity <= 0 && product.item_type !== 'Service';
                return (
                  <div 
                    key={product.id} 
                    onClick={() => !outOfStock && handleProductClick(product)}
                    className={`relative bg-white dark:bg-slate-900 border border-border hover:border-primary hover:shadow-xl transition-all duration-300 rounded-2xl p-4 flex flex-col justify-between cursor-pointer group ${outOfStock ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant={product.item_type === 'Service' ? 'secondary' : 'outline'} className="text-[10px] tracking-widest uppercase px-1.5 py-0">
                        {product.item_type}
                      </Badge>
                      {product.item_type !== 'Service' && (
                        <span className={`text-[10px] font-black uppercase ${product.stock_quantity > 5 ? 'text-emerald-500' : 'text-orange-500'}`}>
                          {product.stock_quantity} Left
                        </span>
                      )}
                    </div>
                    <div>
                      {product.sku && <p className="text-[10px] text-muted-foreground font-mono mb-1">{product.sku}</p>}
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors line-clamp-2 text-sm">{product.part_name}</h4>
                      {product.brand && <p className="text-[11px] text-muted-foreground mt-1 font-medium">{product.brand}</p>}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                      <span className="font-black text-base text-slate-900 dark:text-white tabular-nums">LKR {(product.price || product.cost_price || 0).toLocaleString()}</span>
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

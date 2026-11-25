"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePOS } from "../../context/POSContext";
import { fetchPartBatches } from "@/lib/api";
import { Loader2, Calendar, Archive, Layers, ArrowRight, Check, Banknote, Minus, Plus, Delete, AlertCircle, Tag } from "lucide-react";

export const ProductSelectionDialog: React.FC = () => {
  const {
    productModalOpen,
    setProductModalOpen,
    selectedProduct,
    setSelectedProduct,
    addToCartWithQty,
    selectedLocation,
    systemTaxes,
    posLayout,
    isMenuPricing
  } = usePOS();
  // Small / square POS screens: tighter spacing so everything fits without scrolling
  const c = posLayout === 'compact';

  const [modalQty, setModalQty] = useState<string>("1");
  // The pre-filled "1" is a default, not typed input: the first digit REPLACES it
  // (typing 1 gives 1, not 11; typing 5 gives 5). Later digits append as normal.
  const [qtyFresh, setQtyFresh] = useState(true);
  const [modalDiscount, setModalDiscount] = useState<string>("0");
  const [showDiscount, setShowDiscount] = useState(false);
  
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [manualSelections, setManualSelections] = useState<Record<number, number>>({});
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);

  // Reset local state when modal opens with a new product
  useEffect(() => {
    if (productModalOpen) {
      setModalQty("1");
      setQtyFresh(true);
      setModalDiscount("0");
      setShowDiscount(false);
      setBatches([]);
      setManualSelections({});
      
      if (selectedProduct && (selectedProduct.is_fifo || selectedProduct.is_expiry)) {
        setLoadingBatches(true);
        fetchPartBatches(selectedProduct.id, selectedLocation)
          .then(data => setBatches(data || []))
          .catch(() => setBatches([]))
          .finally(() => setLoadingBatches(false));
      }
    }
  }, [productModalOpen, selectedProduct, selectedLocation]);

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

  const handleNumpadClick = (val: string) => {
    // When using numpad, we reset manual selections to let FIFO take over again
    setManualSelections({});
    if (val === 'C') { setModalQty("1"); setQtyFresh(true); return; }
    if (val === 'DEL') {
      setModalQty(prev => (qtyFresh || prev.length <= 1) ? "1" : prev.slice(0, -1));
      setQtyFresh(prev => prev || modalQty.length <= 1);
      return;
    }
    if (val === '.') {
      setModalQty(prev => qtyFresh ? "0." : (prev.includes('.') ? prev : prev + '.'));
      setQtyFresh(false);
      return;
    }
    setModalQty(prev => (qtyFresh || prev === "0") ? val : prev + val);
    setQtyFresh(false);
  };

  const handleManualBatchChange = (batchId: number, newQty: number, onHand: number) => {
    const safeQty = Math.max(0, Math.min(newQty, onHand));
    const newManual = { ...manualSelections, [batchId]: safeQty };
    
    // Remove if 0 to keep logic clean
    if (safeQty === 0) delete newManual[batchId];
    
    setManualSelections(newManual);
    
    // Update the main modal quantity to reflect the sum of manual choices
    const total = Object.values(newManual).reduce((a, b) => a + b, 0);
    setModalQty(String(total));
  };

  const confirmAddToCart = useCallback(() => {
    if (!selectedProduct) return;
    const q = parseFloat(modalQty);
    const d = parseFloat(modalDiscount) || 0;
    if (isNaN(q) || q <= 0) return;
    
    // Prepare batch assignments
    let selectedBatches: any[] = [];
    if (Object.keys(manualSelections).length > 0) {
      selectedBatches = Object.entries(manualSelections).map(([id, qty]) => ({
        batch_id: parseInt(id),
        qty: qty
      }));
    } else if (batches.length > 0 && (selectedProduct.is_fifo || selectedProduct.is_expiry)) {
      // Auto-FIFO fallback
      let remaining = q;
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(b.quantity_on_hand));
        if (take > 0) {
          selectedBatches.push({ batch_id: b.id > 0 ? b.id : null, qty: take });
          remaining -= take;
        }
      }
    }
    
    addToCartWithQty(selectedProduct, q, d, selectedBatches.length > 0 ? selectedBatches : undefined);
    setProductModalOpen(false);
    setSelectedProduct(null);
  }, [selectedProduct, modalQty, modalDiscount, addToCartWithQty, setProductModalOpen, setSelectedProduct, manualSelections, batches]);

  // Keyboard Numpad Integration
  useEffect(() => {
    if (!productModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack if user is typing in an input field directly (like batch inputs)
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (isDiscountDialogOpen) setIsDiscountDialogOpen(false);
          else if (isAdjustmentOpen) setIsAdjustmentOpen(false);
          else confirmAddToCart();
        }
        return; 
      }

      const key = e.key;
      const isNumber = /^[0-9]$/.test(key);
      const isDelete = key === 'Backspace' || key === 'Delete';
      const isClear = key.toLowerCase() === 'c';
      const isEnter = key === 'Enter';

      if (isDiscountDialogOpen) {
        if (isNumber) { e.preventDefault(); setModalDiscount(prev => prev === "0" ? key : prev + key); }
        else if (isDelete) { e.preventDefault(); setModalDiscount(prev => prev.length > 1 ? prev.slice(0, -1) : "0"); }
        else if (isClear) { e.preventDefault(); setModalDiscount("0"); }
        else if (isEnter) { e.preventDefault(); setIsDiscountDialogOpen(false); }
      } else if (!isAdjustmentOpen) {
        // Main Quantity Logic
        if (isNumber) { e.preventDefault(); handleNumpadClick(key); }
        else if (key === '.') { e.preventDefault(); handleNumpadClick('.'); }
        else if (isDelete) { e.preventDefault(); handleNumpadClick('DEL'); }
        else if (isClear) { e.preventDefault(); handleNumpadClick('C'); }
        else if (isEnter) { e.preventDefault(); confirmAddToCart(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productModalOpen, isAdjustmentOpen, isDiscountDialogOpen, modalQty, modalDiscount, confirmAddToCart]);

  // ---- Derived values for the view ----
  const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unitPrice = Number(selectedProduct?.price || selectedProduct?.cost_price || 0);
  // Menu pricing: the price already includes taxes, so no "incl. tax" line
  const taxIncPrice = isMenuPricing ? unitPrice : getTaxInclusivePrice(unitPrice);
  const tracksStock = !!selectedProduct && selectedProduct.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(selectedProduct.recipe_type);
  // For FIFO/expiry items the batch sum is the source of truth (the product card can be stale)
  const batchTotal = batches.reduce((acc, b) => acc + Number(b.quantity_on_hand), 0);
  const availableQty = !selectedProduct ? 0
    : (selectedProduct.is_fifo || selectedProduct.is_expiry)
      ? ((batches.length > 0 || !loadingBatches) ? batchTotal : Number(selectedProduct.stock_quantity || 0))
      : Number(selectedProduct.stock_quantity || 0);
  const qtyNum = parseFloat(modalQty) || 0;
  const exceedsStock = tracksStock && qtyNum > availableQty;
  const lineTotal = Math.max(0, qtyNum * (unitPrice - (parseFloat(modalDiscount) || 0)));

  const stepQty = (delta: number) => {
    setManualSelections({});
    setQtyFresh(false);
    setModalQty(prev => {
      const next = Math.max(1, Math.round(((parseFloat(prev) || 0) + delta) * 1000) / 1000);
      return String(next);
    });
  };

  return (
    <Dialog open={productModalOpen} onOpenChange={(open) => {
      if (!open) { 
        setProductModalOpen(false); 
        setSelectedProduct(null); 
        setShowDiscount(false); 
      }
    }}>
      <DialogContent size="lg" className={`${c ?'':''} sm:rounded-lg p-0 flex flex-col gap-0 overflow-hidden bg-background`}>
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto custom-scrollbar">
          {/* Left: Product Info */}
          <div className={`w-full md:w-[45%] bg-muted/30 ${c ? 'p-4' : 'p-4 md:p-6'} flex flex-col border-b md:border-b-0 md:border-r border-border relative`}>
            {selectedProduct && (
              <div className={c ? 'space-y-3' : 'space-y-4'}>
                <DialogHeader className="text-left p-0 space-y-1 pr-8">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={selectedProduct.item_type === 'Service' ? 'secondary' : 'outline'} className="text-xs font-medium">
                      {selectedProduct.item_type}
                    </Badge>
                    {selectedProduct.recipe_type && selectedProduct.recipe_type !== 'Standard' && (
                      <Badge variant="secondary" className="text-xs font-medium">{selectedProduct.recipe_type}</Badge>
                    )}
                  </div>
                  <DialogTitle className="leading-snug">{selectedProduct.part_name}</DialogTitle>
                  {selectedProduct.sku && <p className="text-xs text-muted-foreground font-mono">{selectedProduct.sku}</p>}
                </DialogHeader>

                <div className={c ? 'space-y-3' : 'space-y-4'}>
                  {/* Item details: one card, label/value rows (same pattern as ERP detail views) */}
                  <dl className="rounded-lg border border-border bg-background divide-y divide-border text-sm">
                    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="text-right">
                        <div className="font-semibold tabular-nums">LKR {money(unitPrice)}</div>
                        {taxIncPrice > unitPrice && (
                          <div className="text-xs text-muted-foreground tabular-nums">Incl. tax LKR {money(taxIncPrice)}</div>
                        )}
                      </dd>
                    </div>
                    {(selectedProduct.brand_name || selectedProduct.brand) && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="text-muted-foreground">Brand</dt>
                        <dd className="font-medium text-right truncate">{selectedProduct.brand_name || selectedProduct.brand}</dd>
                      </div>
                    )}
                    {(selectedProduct.category_name || selectedProduct.category) && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="text-muted-foreground">Category</dt>
                        <dd className="font-medium text-right truncate">{selectedProduct.category_name || selectedProduct.category}</dd>
                      </div>
                    )}
                    {tracksStock && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="text-muted-foreground">In stock</dt>
                        <dd className="flex items-center gap-2 font-medium tabular-nums">
                          {loadingBatches ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <span className={`w-2 h-2 rounded-full ${availableQty > 0 ? 'bg-emerald-500' : 'bg-destructive'}`} aria-hidden="true" />
                              <span className={availableQty > 0 ? '' : 'text-destructive'}>
                                {Number(availableQty).toLocaleString(undefined, { maximumFractionDigits: 3 })} {selectedProduct.unit}
                              </span>
                            </>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {tracksStock && !loadingBatches && availableQty <= 0 && (
                    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Out of stock at this location. Check another location or transfer stock.</span>
                    </div>
                  )}

                  {/* Boolean(): is_fifo/is_expiry come back as 0/1 and a bare 0 would render as "0" */}
                  {selectedProduct.item_type !== 'Service' && !['A La Carte', 'Buffet'].includes(selectedProduct.recipe_type) && Boolean(Number(selectedProduct.is_fifo) || Number(selectedProduct.is_expiry)) && (
                    <div className="pt-4 mt-2">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex flex-col">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Batch Selection</p>
                          <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-0.5">
                            Current preference
                          </p>
                        </div>
                        {loadingBatches && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>

                      <div className={`p-4 rounded-lg border-2 transition-all ${Object.keys(manualSelections).length > 0 ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20' : 'bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100">
                                {Object.keys(manualSelections).length > 0 ? 'Manual Selection' : 'Auto-FIFO Selection'}
                            </span>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                               {Object.keys(manualSelections).length > 0 ? 'Manual Override Active' : 'Auto-Loadout Details'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {Object.keys(manualSelections).length > 0 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setManualSelections({}); }}
                                    className="px-2 py-1 bg-rose-100 dark:bg-rose-500/10 text-[9px] font-black uppercase text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={() => setIsAdjustmentOpen(true)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-primary hover:text-white transition-all"
                            >
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                            {(() => {
                                const isManual = Object.keys(manualSelections).length > 0;
                                let picks: any[] = [];
                                
                                if (isManual) {
                                    picks = Object.entries(manualSelections).map(([id, qty]) => {
                                        const b = batches.find(b => String(b.id) === String(id));
                                        return { name: b?.batch_number === 'UNBATCHED' ? 'General Stock' : b?.batch_number, qty };
                                    });
                                } else {
                                    let remaining = parseInt(modalQty, 10) || 0;
                                    for (const b of batches) {
                                        if (remaining <= 0) break;
                                        const take = Math.min(remaining, Number(b.quantity_on_hand));
                                        if (take > 0) {
                                            picks.push({ name: b.batch_number === 'UNBATCHED' ? 'General Stock' : b.batch_number, qty: take });
                                            remaining -= take;
                                        }
                                    }
                                }

                                if (picks.length === 0) return <span className="text-[10px] text-slate-400 font-bold uppercase">No stock to allocate</span>;
                                return picks.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                        <span className="truncate max-w-[120px]">{p.name || 'Batch'}</span>
                                        <span className="font-black text-slate-900 dark:text-slate-100 shrink-0">{p.qty} {selectedProduct.unit}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                        
                        <button 
                            onClick={() => setIsAdjustmentOpen(true)}
                            className="w-full mt-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-center text-slate-400 hover:text-primary transition-colors border-t border-slate-100 dark:border-slate-800/50"
                        >
                            Change Selection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Right: Numpad */}
          <div className={`w-full md:w-[55%] ${c ? 'p-4' : 'p-4 md:p-6'} flex flex-col bg-background border-t md:border-t-0 border-border`}>
            {/* Quantity: stepper for the common +1/-1, keypad for typed amounts */}
            <div className={c ? 'mb-3' : 'mb-4'}>
              <label id="pos-qty-label" className="text-sm font-medium">Quantity</label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <Button type="button" variant="outline" className={`${c ? 'h-11 w-11' : 'h-12 w-12'} shrink-0 rounded-md`} onClick={() => stepQty(-1)} aria-label="Decrease quantity" disabled={qtyNum <= 1}>
                  <Minus className="w-4 h-4" />
                </Button>
                <div
                  aria-labelledby="pos-qty-label"
                  aria-live="polite"
                  className={`flex-1 ${c ? 'h-11' : 'h-12'} rounded-md border border-input bg-muted/40 flex items-center justify-center text-2xl font-semibold tabular-nums ${exceedsStock ? 'border-destructive text-destructive' : ''}`}
                >
                  {/* highlighted while it's still the default: the next digit replaces it */}
                  <span className={qtyFresh ? 'px-1.5 rounded bg-primary/15 text-primary' : ''}>{modalQty}</span>
                </div>
                <Button type="button" variant="outline" className={`${c ? 'h-11 w-11' : 'h-12 w-12'} shrink-0 rounded-md`} onClick={() => stepQty(1)} aria-label="Increase quantity">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {exceedsStock && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  Only {Number(availableQty).toLocaleString(undefined, { maximumFractionDigits: 3 })} {selectedProduct?.unit} available.
                </p>
              )}
            </div>

            {/* Keypad */}
            <div className={`grid grid-cols-3 ${c ? 'gap-2 mb-3' : 'gap-2.5 mb-5'}`}>
              {['1','2','3','4','5','6','7','8','9','.','0','DEL'].map(val => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  aria-label={val === 'DEL' ? 'Delete last digit' : undefined}
                  className={`${c ? 'h-12' : 'h-14'} rounded-md text-lg font-semibold tabular-nums active:bg-muted ${val === 'DEL' ? 'text-muted-foreground' : ''}`}
                  onClick={() => handleNumpadClick(val)}
                >
                  {val === 'DEL' ? <Delete className="w-5 h-5" /> : val}
                </Button>
              ))}
            </div>

            {/* Line discount */}
            <div className="mt-auto">
              <button
                type="button"
                onClick={() => setIsDiscountDialogOpen(true)}
                className={`w-full rounded-md border px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${Number(modalDiscount) > 0 ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm">
                    <span className="font-medium">Line discount</span>
                    <span className="text-muted-foreground"> · {Number(modalDiscount) > 0 ? `LKR ${money(Number(modalDiscount))} per unit` : 'None'}</span>
                  </span>
                </span>
                <span className="text-sm font-medium text-primary shrink-0">{Number(modalDiscount) > 0 ? 'Change' : 'Add'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: line total + actions */}
        <div className={`${c ? 'px-4 py-3' : 'px-6 py-4'} bg-background border-t border-border flex items-center justify-between gap-4 shrink-0`}>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Line total</div>
            <div className="text-lg font-semibold tabular-nums">LKR {money(lineTotal)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => { setProductModalOpen(false); setSelectedProduct(null); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 px-5 gap-2"
              onClick={confirmAddToCart}
              disabled={!selectedProduct || qtyNum <= 0 || exceedsStock}
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              Add to cart
              <kbd className="hidden sm:inline-flex ml-1 rounded border border-primary-foreground/30 px-1.5 text-[10px] font-medium opacity-80">Enter</kbd>
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Batch Adjustment Sub-Dialog */}
      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent size="lg" className="sm:h-[min(760px,calc(100dvh-2rem))] p-0 flex flex-col overflow-hidden sm:rounded-lg">
          <DialogHeader className="px-5 pt-5 pb-3 text-left border-b border-border shrink-0">
            <DialogTitle>Adjust batch selection</DialogTitle>
            <p className="text-sm text-muted-foreground">Choose how many units to take from each batch.</p>
          </DialogHeader>

          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {/* Master Quantity Control */}
            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Quantity</span>
                    <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">{modalQty} <span className="text-sm font-bold text-slate-400">{selectedProduct?.unit}</span></span>
                </div>
                <div className="flex items-center bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm h-14">
                  <button 
                    className="w-14 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors text-2xl font-black"
                    onClick={() => {
                        const q = parseInt(modalQty, 10) || 0;
                        if (q > 1) {
                            setModalQty(String(q - 1));
                            setManualSelections({}); // Reset manual if overall qty changes via main selector for safety or keep it? 
                            // User request: "adjust the qty and batch selection"
                        }
                    }}
                  >-</button>
                  <input 
                    type="number"
                    step="any"
                    className="w-20 h-full text-center text-xl font-black bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={modalQty}
                    onChange={(e) => {
                        setModalQty(e.target.value);
                        setManualSelections({});
                    }}
                  />
                  <button 
                    className="w-14 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-colors text-2xl font-black"
                    onClick={() => {
                        const q = parseFloat(modalQty) || 0;
                        setModalQty(String(q + 1));
                        setManualSelections({});
                    }}
                  >+</button>
                </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 mb-2">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Batches</h4>
                 {Object.keys(manualSelections).length > 0 && (
                   <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Manual Overrides Active</span>
                 )}
              </div>
              
              {batches.map((b, idx) => {
                const onHand = Number(b.quantity_on_hand);
                const isManual = Object.keys(manualSelections).length > 0;
                let picked = 0;
                
                if (isManual) {
                  picked = manualSelections[b.id] || 0;
                } else {
                  // Pre-fill calculation for display
                  let remaining = parseInt(modalQty, 10) || 0;
                  for (let i = 0; i <= idx; i++) {
                    const currentBatchOH = Number(batches[i].quantity_on_hand);
                    const take = Math.min(remaining, currentBatchOH);
                    if (i === idx) picked = take;
                    remaining -= take;
                  }
                }

                const isUnbatched = b.batch_number === 'UNBATCHED';
                
                return (
                  <div key={b.id || idx} className={`p-5 rounded-lg border-2 transition-all duration-300 ${picked > 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/40' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent opacity-60 hover:opacity-100'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-md ${picked > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Archive className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-sm font-black tracking-tight ${isUnbatched ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100'}`}>
                            {isUnbatched ? 'General Stock' : b.batch_number}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{onHand} available</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm h-10">
                        <button 
                          className="w-10 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-colors"
                          onClick={() => handleManualBatchChange(b.id, picked - 1, onHand)}
                        >-</button>
                        <input 
                          type="number"
                          step="any"
                          className="w-12 h-full text-center text-xs font-black bg-transparent focus:outline-none"
                          value={picked || ''}
                          placeholder="0"
                          onChange={(e) => handleManualBatchChange(b.id, parseFloat(e.target.value) || 0, onHand)}
                        />
                        <button 
                          className="w-10 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-l border-slate-100 dark:border-slate-800 transition-colors"
                          onClick={() => handleManualBatchChange(b.id, picked + 1, onHand)}
                        >+</button>
                      </div>
                    </div>

                    {(b.expiry_date || b.mfg_date) && (
                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex gap-4">
                            {b.expiry_date && (
                                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    Exp: {b.expiry_date}
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
             <Button 
                onClick={() => setIsAdjustmentOpen(false)}
                className="w-full h-14 rounded-lg text-lg font-black tracking-widest uppercase shadow-xl bg-slate-900 hover:bg-black text-white"
             >
                <Check className="w-5 h-5 mr-3" /> Confirm Selection
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Adjustment Sub-Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent size="sm" className="p-0 flex flex-col gap-0 overflow-y-auto sm:rounded-lg">
          {/* Standard modal layout: header / body / footer (same as ERP dialogs) */}
          <DialogHeader className="px-5 pt-5 pb-3 text-left border-b border-border">
            <DialogTitle>Line discount</DialogTitle>
            <p className="text-sm text-muted-foreground">Amount taken off each unit of {selectedProduct?.part_name || 'this item'}.</p>
          </DialogHeader>

          <div className="px-5 py-4 space-y-3">
            <div>
              <label id="line-disc-label" className="text-sm font-medium">Discount per unit (LKR)</label>
              <div aria-labelledby="line-disc-label" aria-live="polite"
                className={`mt-1.5 h-12 rounded-md border bg-muted/40 flex items-center justify-end px-4 text-2xl font-semibold tabular-nums ${Number(modalDiscount) >= unitPrice && unitPrice > 0 ? 'border-destructive text-destructive' : 'border-input'}`}>
                {modalDiscount}
              </div>
              {unitPrice > 0 && (
                <p className={`mt-1.5 text-xs ${Number(modalDiscount) >= unitPrice ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {Number(modalDiscount) >= unitPrice
                    ? `Discount can't be more than the unit price (LKR ${money(unitPrice)}).`
                    : `New unit price: LKR ${money(unitPrice - (Number(modalDiscount) || 0))}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','C','0','DEL'].map(val => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  aria-label={val === 'DEL' ? 'Delete last digit' : val === 'C' ? 'Clear amount' : undefined}
                  className={`h-12 rounded-md text-lg font-semibold tabular-nums ${val === 'C' || val === 'DEL' ? 'text-muted-foreground' : ''}`}
                  onClick={() => {
                    if (val === 'C') setModalDiscount("0");
                    else if (val === 'DEL') setModalDiscount(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
                    else setModalDiscount(prev => prev === "0" ? val : prev + val);
                  }}
                >
                  {val === 'DEL' ? <Delete className="w-5 h-5" /> : val}
                </Button>
              ))}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-background">
            <Button type="button" variant="outline" className="h-11"
              onClick={() => { setModalDiscount("0"); setIsDiscountDialogOpen(false); }}>
              Remove discount
            </Button>
            <Button type="button" className="h-11 px-5"
              disabled={unitPrice > 0 && Number(modalDiscount) >= unitPrice}
              onClick={() => setIsDiscountDialogOpen(false)}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>

  );
};

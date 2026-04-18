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
import { Loader2, Calendar, Archive, Layers } from "lucide-react";

export const ProductSelectionDialog: React.FC = () => {
  const {
    productModalOpen,
    setProductModalOpen,
    selectedProduct,
    setSelectedProduct,
    addToCartWithQty,
    selectedLocation
  } = usePOS();

  const [modalQty, setModalQty] = useState<string>("1");
  const [modalDiscount, setModalDiscount] = useState<string>("0");
  const [showDiscount, setShowDiscount] = useState(false);
  
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [manualSelections, setManualSelections] = useState<Record<number, number>>({});

  // Reset local state when modal opens with a new product
  useEffect(() => {
    if (productModalOpen) {
      setModalQty("1");
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

  const handleNumpadClick = (val: string) => {
    // When using numpad, we reset manual selections to let FIFO take over again
    setManualSelections({});
    if (val === 'C') setModalQty("1");
    else if (val === 'DEL') setModalQty(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
    else setModalQty(prev => prev === "0" ? val : prev + val);
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
    const q = parseInt(modalQty, 10);
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
      // Don't hijack if user is typing in discount input
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmAddToCart();
        }
        return; 
      }

      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        handleNumpadClick(key);
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        handleNumpadClick('DEL');
      } else if (key.toLowerCase() === 'c') {
        e.preventDefault();
        handleNumpadClick('C');
      } else if (key === 'Enter') {
        e.preventDefault();
        confirmAddToCart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productModalOpen, modalQty, modalDiscount, confirmAddToCart]);

  return (
    <Dialog open={productModalOpen} onOpenChange={(open) => {
      if (!open) { 
        setProductModalOpen(false); 
        setSelectedProduct(null); 
        setShowDiscount(false); 
      }
    }}>
      <DialogContent className="w-full sm:max-w-xl h-[100dvh] sm:h-auto rounded-none sm:rounded-3xl p-0 flex flex-col overflow-hidden bg-background border-none shadow-2xl">
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto custom-scrollbar">
          {/* Left: Product Info */}
          <div className="w-full md:w-[42%] bg-slate-50 dark:bg-slate-900/50 p-4 md:p-6 flex flex-col border-b md:border-b-0 md:border-r border-border relative">
            {selectedProduct && (
              <div className="space-y-6 md:mt-4">
                <DialogHeader className="text-left p-0">
                  <Badge variant={selectedProduct.item_type === 'Service' ? 'secondary' : 'outline'} className="mb-2 w-fit text-[9px] font-black tracking-widest uppercase py-0 px-2 h-5">
                    {selectedProduct.item_type}
                  </Badge>
                  <DialogTitle className="text-xl font-black leading-tight text-foreground">{selectedProduct.part_name}</DialogTitle>
                  <p className="text-[11px] text-muted-foreground mt-1 font-bold uppercase tracking-tight">{selectedProduct.sku}</p>
                </DialogHeader>
                
                <div className="space-y-4">
                  {selectedProduct.item_type !== 'Service' && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-3">Inventory Status</p>
                      {(() => {
                        // Safety: If we've loaded batches and they show a different total than the product card,
                        // the product card is likely stale. Use the batch sum as the source of truth.
                        const batchTotal = batches.reduce((acc, b) => acc + Number(b.quantity_on_hand), 0);
                        const displayQty = (batches.length > 0 || !loadingBatches) ? batchTotal : (selectedProduct.stock_quantity || 0);
                        const isOutOfStock = displayQty <= 0;

                        return (
                          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-2.5 rounded-xl border border-border shadow-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${!isOutOfStock ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                            <div className="flex flex-col">
                              <span className={`text-base font-black tracking-tight leading-none ${!isOutOfStock ? 'text-foreground' : 'text-rose-600'}`}>
                                {Number(displayQty).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {selectedProduct.unit}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Available at this location</span>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const batchTotal = batches.reduce((acc, b) => acc + Number(b.quantity_on_hand), 0);
                        const displayQty = (batches.length > 0 || !loadingBatches) ? batchTotal : (selectedProduct.stock_quantity || 0);
                        if (displayQty <= 0 && selectedProduct.item_type === 'Part') {
                          return (
                            <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-center gap-3">
                              <Loader2 className="w-5 h-5 text-rose-500 shrink-0" />
                              <p className="text-[11px] leading-tight text-rose-700 dark:text-rose-300 font-black uppercase tracking-tight">
                                Item out of stock. Please check another location.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {selectedProduct.item_type !== 'Service' && (selectedProduct.is_fifo || selectedProduct.is_expiry) && (
                    <div className="pt-4 mt-2">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex flex-col">
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Batch Selection</p>
                          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-0.5">
                            {Object.keys(manualSelections).length > 0 ? 'Manual Mode Active' : 'Auto-FIFO Active'}
                          </p>
                        </div>
                        {loadingBatches && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      
                      {batches.length > 0 ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {(() => {
                            let remaining = parseInt(modalQty, 10) || 0;
                            const isManual = Object.keys(manualSelections).length > 0;

                            return batches.map((b, idx) => {
                              const onHand = Number(b.quantity_on_hand);
                              let picked = 0;
                              
                              if (isManual) {
                                picked = manualSelections[b.id] || 0;
                              } else {
                                picked = Math.min(remaining, onHand);
                                remaining = Math.max(0, remaining - picked);
                              }

                              const isUnbatched = b.batch_number === 'UNBATCHED';
                              
                              return (
                                <div key={b.id || idx} className={`p-2.5 rounded-xl border transition-all duration-300 ${picked > 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' : 'bg-white/50 border-border opacity-70 hover:opacity-100'}`}>
                                  <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <Archive className={`w-3.5 h-3.5 ${picked > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                      <div className="flex flex-col">
                                        <span className={`text-[11px] font-black tracking-tight ${isUnbatched ? 'text-muted-foreground italic' : ''}`}>
                                          {isUnbatched ? 'General Stock' : b.batch_number}
                                        </span>
                                        <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-tighter">{onHand} left</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center bg-white dark:bg-slate-950 border border-border rounded-lg overflow-hidden shadow-sm h-8">
                                      <button 
                                        className="w-7 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-r border-border transition-colors text-lg leading-none"
                                        onClick={() => handleManualBatchChange(b.id, picked - 1, onHand)}
                                      >-</button>
                                      <input 
                                        type="number"
                                        className="w-10 h-full text-center text-[11px] font-black bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={picked || ''}
                                        placeholder="0"
                                        onChange={(e) => handleManualBatchChange(b.id, parseInt(e.target.value) || 0, onHand)}
                                      />
                                      <button 
                                        className="w-7 h-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 border-l border-border transition-colors text-lg leading-none"
                                        onClick={() => handleManualBatchChange(b.id, picked + 1, onHand)}
                                      >+</button>
                                    </div>
                                  </div>

                                  {picked > 0 && !isManual && (
                                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tight mb-2">Auto-Picked according to FIFO</div>
                                  )}

                                  {(b.expiry_date || b.mfg_date) && (
                                    <div className="flex gap-4 pt-2 border-t border-emerald-100/50 dark:border-emerald-500/10 text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                                      {b.mfg_date && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 opacity-70" /> {b.mfg_date}</div>}
                                      {b.expiry_date && <div className={`flex items-center gap-1.5 ${new Date(b.expiry_date) < new Date() ? 'text-rose-500' : ''}`}><Layers className="w-3 h-3 opacity-70" /> {b.expiry_date}</div>}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : !loadingBatches ? (
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/20 p-6 rounded-2xl text-center border-2 border-dashed border-muted flex flex-col items-center gap-2">
                           <Layers className="w-5 h-5 opacity-20" />
                           No specific batches found
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Right: Numpad */}
          <div className="w-full md:w-[58%] p-4 md:p-6 flex flex-col bg-white dark:bg-card border-t md:border-t-0 border-border">
            {/* Quantity Display */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Quantity</label>
              <div className="mt-1.5 h-12 sm:h-14 bg-muted/30 border-2 border-border rounded-xl flex items-center justify-end px-4 shadow-inner focus-within:border-primary transition-colors">
                <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tighter text-foreground">{modalQty}</span>
              </div>
            </div>

            {/* Numpad Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1','2','3','4','5','6','7','8','9','C','0','DEL'].map(val => (
                <Button
                  key={val}
                  variant={val === 'C' || val === 'DEL' ? 'secondary' : 'outline'}
                  className={`h-12 sm:h-14 text-lg sm:text-xl font-black rounded-xl shadow-sm ${val !== 'C' && val !== 'DEL' ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-border hover:border-primary transition-all' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-none'}`}
                  onClick={() => handleNumpadClick(val)}
                >
                  {val}
                </Button>
              ))}
            </div>

            {/* Discount */}
            {!showDiscount ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-dashed border-rose-200 dark:border-rose-500/30 rounded-xl h-10 font-bold text-xs tracking-widest uppercase"
                onClick={() => setShowDiscount(true)}
              >
                + Add Line Discount
              </Button>
            ) : (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                <label className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                  <span>Discount per Unit (LKR)</span>
                  <button onClick={() => { setShowDiscount(false); setModalDiscount("0"); }} className="text-rose-400 hover:text-rose-600 text-lg leading-none">&times;</button>
                </label>
                <Input
                  type="number"
                  autoFocus
                  value={modalDiscount}
                  onChange={(e) => setModalDiscount(e.target.value)}
                  className="h-12 text-right font-black text-xl text-rose-600 dark:text-rose-400 bg-white dark:bg-card border-rose-200 dark:border-rose-500/40 focus-visible:ring-rose-400 rounded-lg"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3 md:p-5 bg-white dark:bg-card border-t border-border shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)] shrink-0">
          <Button 
            size="lg" 
            className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-black tracking-widest uppercase shadow-xl"
            onClick={confirmAddToCart}
            disabled={!selectedProduct || parseInt(modalQty, 10) <= 0 || (selectedProduct?.item_type !== 'Service' && parseInt(modalQty, 10) > selectedProduct?.stock_quantity)}
          >
            <ShoppingCart className="w-4 h-4 sm:w-5 h-5 mr-3" /> Add to Cart
          </Button>
          {selectedProduct && selectedProduct.item_type !== 'Service' && parseInt(modalQty, 10) > selectedProduct.stock_quantity && (
            <p className="text-center text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-2 px-4">Cannot exceed available stock</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

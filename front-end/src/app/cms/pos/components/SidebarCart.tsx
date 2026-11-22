"use client";

import React from "react";
import { 
  MapPin, 
  User, 
  Plus, 
  Loader2, 
  ShoppingCart, 
  Trash2, 
  Minus, 
  Calculator,
  Percent,
  Utensils,
  ShoppingBag,
  Store,
  ArrowRight,
  LayoutGrid,
  PauseCircle,
  Clock,
  RefreshCw,
  Gift,
  Home,
  Printer,
  MessageSquarePlus,
  X
} from "lucide-react";
import { LineNoteDialog } from "./Dialogs/LineNoteDialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePOS } from "../context/POSContext";
import { OrderTypeSelector } from "./OrderTypeSelector";
import { PromotionsDialog } from "@/components/promotions-dialog";

export const SidebarCart: React.FC = () => {
  const {
    cart,
    locations,
    inventory,
    selectedLocation,
    setSelectedLocation,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    addCustomerOpen,
    setAddCustomerOpen,
    addingCustomer,
    newCustomer,
    setNewCustomer,
    handleQuickAddCustomer,
    updateCartLine,
    removeCartLine,
    totals,
    openCheckoutDialog,
    billDiscountValue,
    billDiscountType,
    setBillDiscountDialogOpen,
    vKeyboardEnabled,
    setVKeyboardActiveInput,
    orderType,
    setOrderType,
    setOrderTypeDialogOpen,
    selectedTable,
    selectedSteward,
    tables,
    stewards,
    holdPOSBill,
    heldOrders,
    setHeldOrderId,
    loadPOSBill,
    refreshHeldOrders,
    appliedPromotion,
    setAppliedPromotion,
    setIsPromotionPromptOpen,
    setReservationDialogOpen,
    setGuestPrintSelectionOpen,
    setGuestPrintOrderId,
    isMenuPricing,
    posLayout,
    canCheckout,
    printKOT,
    setCompRequest,
    removeComp
  } = usePOS();
  const compTotal = cart.reduce((s: number, l: any) => s + (l.is_comp ? Number(l.quantity) * Number(l.unit_price) : 0), 0);
  const canCompBill = cart.some((l: any) => !l.is_comp && !l.is_reward && Number(l.unit_price) > 0);
  const isCompact = posLayout === 'compact';
  // Tab mode (phones / portrait tablets): touch-sized lines
  const tab = posLayout === 'mobile';

  const [heldOrdersOpen, setHeldOrdersOpen] = React.useState(false);
  const [isPromotionsOpen, setIsPromotionsOpen] = React.useState(false);
  const [noteLineIndex, setNoteLineIndex] = React.useState<number | null>(null);
  const noteLine = noteLineIndex !== null ? cart[noteLineIndex] : null;
  const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentLocationName = locations.find(l => String(l.id) === String(selectedLocation))?.name || "Selected Location";

  return (
    <div className={`w-full shrink-0 flex flex-col bg-white dark:bg-card h-full overflow-hidden relative ${posLayout === 'full' ? 'lg:rounded-lg border-t lg:border border-border lg:shadow-xl' : ''}`}>

      {/* POS Header: customer + held bills + promotions (one row) */}
      <div className="p-2 bg-muted/20 border-b border-border shrink-0">
        <div className="flex gap-2 items-center">
          {/* Customer (location is shown in the bottom status bar). Stewards don't pick customers. */}
        {!canCheckout ? (
          <div className="flex-1 min-w-0 px-1 text-sm font-medium">Current order</div>
        ) : (<>
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <SearchableSelect
            triggerClassName="h-9 px-2.5 text-sm"
            value={selectedCustomer}
            onValueChange={setSelectedCustomer}
            placeholder="Search Customer..."
            options={customers.map(c => ({
              value: String(c.id),
              label: c.phone ? `${c.name} (${c.phone})` : c.name,
              keywords: `${c.name} ${c.phone}`
            }))}
          />
        </div>
        
        <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Add customer" aria-label="Add customer"><Plus className="w-4 h-4" /></Button>
          </DialogTrigger>
          <DialogContent size="sm" className="overflow-y-auto sm:rounded-lg p-6 bg-background">
            <DialogHeader><DialogTitle>Add Walk-In</DialogTitle></DialogHeader>
            <form onSubmit={handleQuickAddCustomer} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">Name</label>
                <Input 
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
                  autoFocus 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Phone</label>
                <Input 
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} 
                  required
                />
              </div>
              <Button type="submit" disabled={addingCustomer} className="w-full">
                {addingCustomer ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save & Select"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </>)}

          <Dialog open={heldOrdersOpen} onOpenChange={(open) => {
            setHeldOrdersOpen(open);
            if (open) refreshHeldOrders();
          }}>
              <DialogTrigger asChild>
                  <Button variant="outline" className="h-9 gap-1.5 px-2.5 shrink-0" title="Held bills">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{isCompact ? heldOrders.length : `Held (${heldOrders.length})`}</span>
                  </Button>
              </DialogTrigger>
              <DialogContent size="lg" className="sm:rounded-lg p-0 overflow-y-auto bg-background">
                  <DialogHeader className="p-6 pb-2">
                      <DialogTitle className="flex items-center gap-3">
                          <Clock className="w-6 h-6 text-orange-500" />
                          Held Bills List
                      </DialogTitle>
                  </DialogHeader>
                  <div className="p-2 max-h-[60vh] overflow-y-auto">
                      {heldOrders.length === 0 ? (
                          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
                              <Clock className="w-12 h-12 opacity-10" />
                              <p className="font-bold italic">No bills on hold for this location.</p>
                          </div>
                      ) : (
                          <div className="grid gap-2 p-2">
                              {Array.isArray(heldOrders) && heldOrders.map((order) => (
                                  <div 
                                    key={order.id} 
                                    className="p-4 rounded-lg border border-border bg-slate-50 dark:bg-slate-900 hover:border-orange-500 transition-all cursor-pointer group flex justify-between items-center"
                                    onClick={() => {
                                        loadPOSBill(order.id);
                                        setHeldOrdersOpen(false);
                                    }}
                                  >
                                       <div>
                                           <div className="font-black text-lg">#{order.id} - {order.customer_name}</div>
                                           <div className="text-xs text-muted-foreground mt-1 font-bold">LKR {Number(order.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {order.items_count} Items</div>
                                           <div className="text-[10px] text-orange-500 mt-1 uppercase font-black">{order.order_type} | {new Date(order.created_at).toLocaleTimeString()}</div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <Button
                                               type="button"
                                               size="sm"
                                               variant="outline"
                                               onClick={(e) => { 
                                                   e.stopPropagation(); 
                                                   void printKOT(order.id, true);
                                               }}
                                               className="h-8 px-2.5 text-[10px] font-black uppercase tracking-tight gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-700/40 dark:text-amber-400 z-10"
                                               title="Reprint Full KOT"
                                           >
                                               <Utensils className="w-3.5 h-3.5" />
                                               <span>KOT</span>
                                           </Button>
                                           <Button 
                                               type="button"
                                               size="sm"
                                               variant="outline"
                                               onClick={(e) => { 
                                                   e.stopPropagation(); 
                                                   setGuestPrintOrderId(order.id);
                                                   setGuestPrintSelectionOpen(true);
                                               }}
                                               className="h-8 px-2.5 text-[10px] font-black uppercase tracking-tight gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-700/40 dark:text-blue-400 z-10"
                                               title="Print Guest Bill"
                                           >
                                               <Printer className="w-3.5 h-3.5" />
                                               <span>Bill</span>
                                           </Button>
                                           <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all ml-1" />
                                       </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </DialogContent>
          </Dialog>

          {canCheckout && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPromotionsOpen(true)}
              className="h-9 w-9 shrink-0"
              title="View Active Promotions"
            >
              <Percent className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>


      {/* Order context: one line (mode · table · steward) */}
      {orderType && (
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-muted/40 text-sm min-w-0">
          {orderType === "dine_in" ? <Utensils className="w-4 h-4 text-primary shrink-0" aria-hidden="true" /> :
           orderType === "take_away" ? <ShoppingBag className="w-4 h-4 text-primary shrink-0" aria-hidden="true" /> :
           <Store className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />}
          <span className="font-medium shrink-0">{orderType === "dine_in" ? "Dine in" : orderType === "take_away" ? "Take away" : "Retail"}</span>
          {orderType === "dine_in" && selectedTable && (
            <span className="text-muted-foreground truncate">· {tables.find(t => String(t.id) === selectedTable)?.name || "Table"}</span>
          )}
          {orderType === "dine_in" && selectedSteward && (
            <span className="text-muted-foreground truncate">· {stewards.find(s => String(s.id) === selectedSteward)?.name || "Steward"}</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOrderTypeDialogOpen(true)} className="ml-auto h-7 px-2 text-xs text-primary shrink-0">
            Change
          </Button>
        </div>
      )}

      {/* Cart List */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-2 custom-scrollbar relative">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 px-6 text-muted-foreground">
            <ShoppingCart className="w-8 h-8 opacity-30 mb-1" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No items yet</p>
            <p className="text-xs">Tap an item on the left, or scan a barcode.</p>
          </div>
        ) : (
          <div className={tab ? "space-y-2" : "space-y-1.5 lg:space-y-2"}>
            {cart.map((item, index) => {
              const isReward = !!item.is_reward;
              
              if (isReward) {
                return (
                  <div key={index} className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-2 lg:p-3 rounded-md shadow-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                    <div className="absolute top-0 right-0 p-1 opacity-10">
                       <Gift className="w-8 h-8 lg:w-12 lg:h-12 -rotate-12" />
                    </div>
                    <div className="flex justify-between items-start mb-1 lg:mb-2 relative z-10">
                      <div className="flex flex-col gap-0.5 lg:gap-1 pr-2">
                        <div className="font-bold text-xs lg:text-sm leading-tight text-emerald-900 dark:text-emerald-400">
                          {item.description}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-[6px] lg:text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                            Free Gift
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 lg:mt-3 relative z-10">
                       <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-emerald-700/70 dark:text-emerald-500/70">
                          <span>Qty: {item.quantity}</span>
                          <span className="opacity-50">|</span>
                          <span>{item.item_type}</span>
                       </div>
                       <div className="text-right">
                          <div className="text-[8px] lg:text-[10px] line-through text-muted-foreground opacity-50">LKR {Number(item.unit_price).toLocaleString()}</div>
                          <div className="text-xs lg:text-sm font-black text-emerald-600">LKR 0.00</div>
                       </div>
                    </div>
                  </div>
                );
              }

              if (item.is_comp) {
                return (
                  <div key={index} className={`bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 ${tab ? "p-3" : "p-2 lg:p-3"} rounded-md shadow-sm`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className={`${tab ? "text-base font-semibold leading-snug" : "font-bold text-xs lg:text-sm leading-tight"} text-foreground line-clamp-2`}>{item.description}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">Comp</span>
                          <span className="text-[10px] lg:text-[11px] text-violet-800 dark:text-violet-300 truncate">
                            {item.comp_reason}{item.comp_approver_name ? ` · ${item.comp_approver_name}` : ""}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComp(index)}
                        title="Remove complimentary (charge this item)"
                        aria-label="Remove complimentary"
                        className="w-6 h-6 lg:w-7 lg:h-7 -mt-1 -mr-1 shrink-0 text-violet-700 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] lg:text-xs font-semibold text-muted-foreground tabular-nums">Qty {item.quantity}</span>
                      <div className="text-right">
                        <div className="text-[8px] lg:text-[10px] line-through text-muted-foreground tabular-nums">LKR {money(item.quantity * item.unit_price)}</div>
                        <div className={`${tab ? "text-base font-semibold" : "text-xs lg:text-sm font-black"} text-violet-700 dark:text-violet-300 tabular-nums`}>LKR 0.00</div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className={`bg-white dark:bg-card border border-border ${tab ? "p-3" : "p-2 lg:p-3"} rounded-md hover:border-primary/30 transition-colors shadow-sm`}>
                  <div className="flex justify-between items-start mb-1 lg:mb-2">
                    <div className="pr-2 min-w-0">
                      <div className={`${tab ? "text-base font-semibold leading-snug" : "font-bold text-xs lg:text-sm leading-tight"} text-foreground line-clamp-2`}>{item.description}</div>
                      {(item.modifiers?.length > 0 || item.item_notes) && (
                        <button
                          type="button"
                          onClick={() => setNoteLineIndex(index)}
                          className="mt-1 flex flex-wrap gap-1 text-left"
                        >
                          {(item.modifiers || []).map((m: string) => (
                            <span key={m} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[9px] lg:text-[10px] font-bold">{m}</span>
                          ))}
                          {item.item_notes && (
                            <span className="text-[10px] lg:text-[11px] italic text-muted-foreground">“{item.item_notes}”</span>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center -mt-1 -mr-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setNoteLineIndex(index)}
                        title="Kitchen note / modifiers"
                        className={`w-6 h-6 lg:w-7 lg:h-7 hover:bg-amber-50 ${item.item_notes || item.modifiers?.length ? 'text-amber-600' : 'text-muted-foreground hover:text-amber-600'}`}
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      </Button>
                      {Number(item.unit_price) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCompRequest({ index })}
                          title="Make complimentary (manager PIN)"
                          aria-label="Make complimentary"
                          className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
                        >
                          <Gift className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCartLine(index)}
                        title="Remove item"
                        className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 lg:mt-3">
                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg border border-border p-0.5">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={tab ? "w-10 h-10 rounded-md" : "w-6 h-6 lg:w-7 lg:h-7 rounded-md"} 
                        onClick={() => updateCartLine(index, 'quantity', item.quantity - 1)} 
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                      </Button>
                      <input 
                        type="number"
                        step="any"
                        className="w-10 lg:w-12 text-center text-[10px] lg:text-xs font-black tabular-nums bg-transparent border-none focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={item.quantity}
                        onChange={(e) => {
                          let val = parseFloat(e.target.value) || 0;
                          const invItem = inventory.find(p => p.id === item.id);
                          if (invItem && invItem.item_type !== 'Service' && invItem.recipe_type !== 'A La Carte') {
                             if (val > invItem.stock_quantity) val = invItem.stock_quantity;
                          }
                          updateCartLine(index, 'quantity', val);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={tab ? "w-10 h-10 rounded-md text-primary" : "w-6 h-6 lg:w-7 lg:h-7 rounded-md text-primary"} 
                        onClick={() => {
                          let val = Number(item.quantity) + 1;
                          const invItem = inventory.find(p => p.id === item.id);
                          if (invItem && invItem.item_type !== 'Service' && invItem.recipe_type !== 'A La Carte') {
                             if (val > invItem.stock_quantity) val = invItem.stock_quantity;
                          }
                          updateCartLine(index, 'quantity', val);
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      {item.discount > 0 && (
                        <div className="text-[8px] lg:text-[10px] line-through text-muted-foreground opacity-50">LKR {money(item.quantity * item.unit_price)}</div>
                      )}
                      <div className={`${tab ? "text-base font-semibold" : "text-xs lg:text-sm font-black"} text-foreground tabular-nums`}>LKR {money((item.quantity * item.unit_price) - (item.quantity * item.discount))}</div>
                      {item.quantity > 1 && (
                        <div className="text-[9px] lg:text-[10px] text-muted-foreground tabular-nums">{item.quantity} × {money(item.unit_price - (item.discount || 0))}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals & Actions */}
      <div className="bg-white dark:bg-card border-t border-border shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
        <div className={`${isCompact ? 'px-3 py-2 space-y-1 text-xs' : 'p-3 lg:p-4 space-y-1 lg:space-y-2 text-xs lg:text-sm'} border-b border-border bg-slate-50/50 dark:bg-slate-900/50`}>
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-2">
              Subtotal
              {isMenuPricing && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider" title="Menu prices already include taxes">
                  Taxes incl.
                </span>
              )}
            </span>
            <span className="font-bold text-foreground tabular-nums">LKR {money(totals.subtotal)}</span>
          </div>

          {totals.lineDiscountTotal - compTotal > 0.005 && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
              <span>Line discounts</span>
              <span className="font-bold tabular-nums">-LKR {money(totals.lineDiscountTotal - compTotal)}</span>
            </div>
          )}

          {compTotal > 0 && (
            <div className="flex justify-between text-violet-700 dark:text-violet-300 font-medium">
              <span>Complimentary</span>
              <span className="font-bold tabular-nums">-LKR {money(compTotal)}</span>
            </div>
          )}

          {/* Bill discount: a plain row, like the other totals */}
{canCheckout && (
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setBillDiscountDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <Percent className="w-3.5 h-3.5" aria-hidden="true" />
              {billDiscountValue > 0
                ? `Bill discount (${billDiscountType === "percentage" ? billDiscountValue + "%" : "fixed"})`
                : "Add bill discount"}
              <kbd className="text-[10px] text-muted-foreground font-normal">F4</kbd>
            </button>
            {billDiscountValue > 0 && (
              <span className="font-medium text-destructive tabular-nums">-LKR {money(totals.billDiscountAmt)}</span>
            )}
          </div>
)}
{canCheckout && canCompBill && (
          <div className="flex">
            <button
              type="button"
              onClick={() => setCompRequest({ index: null })}
              className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
              Make whole bill complimentary
            </button>
          </div>
)}
          
          {/* Menu-pricing locations show only the service charge; the tax
              breakdown is booked internally and appears in the tax reports. */}
          {totals.displayTaxes.length > 0 && (
            <div className="pt-1 space-y-0.5">
                {totals.displayTaxes.map((t, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] lg:text-xs text-blue-600 dark:text-cyan-400">
                        <span>{t.is_sc ? 'Service charge' : t.code}{Number(t.rate_percent) > 0 ? ` (${Number(t.rate_percent)}%)` : ''}</span>
                        <span className="font-bold tabular-nums">LKR {money(t.amount)}</span>
                    </div>
                ))}
            </div>
          )}

          {appliedPromotion && (
            <div className="flex justify-between items-center py-2 px-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-top-1 duration-300">
               <div className="flex flex-col">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Promotion applied</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{appliedPromotion.name}</span>
               </div>
               <div className="flex items-center gap-3">
                  <span className="font-black text-amber-600">-LKR {Number(appliedPromotion.discount_value).toLocaleString()}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setIsPromotionPromptOpen(true)}
                      title="Switch Promotion"
                      className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-md transition-colors text-amber-600"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setAppliedPromotion(null)}
                      title="Remove Promotion"
                      className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-md transition-colors text-amber-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
        
        <div className={posLayout === 'mobile' ? `p-4 flex flex-col gap-3 ${canCheckout ? 'pb-24' : 'pb-4'}` : isCompact ? 'px-3 py-2.5 flex flex-col gap-2' : 'p-4 lg:p-5 flex flex-col gap-3 lg:gap-4'}>
          <div className={`${tab && canCheckout ? "hidden" : "flex"} justify-between items-center text-base lg:text-xl`}>
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className={`font-black ${isCompact ? 'text-2xl' : 'text-2xl lg:text-3xl'} tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400`}>
              LKR {money(totals.grandTotal)}
            </span>
          </div>

          
          {!canCheckout ? (
            /* Order-taking only (steward tablet): hold the bill and send the KOT */
            <div className="space-y-1.5">
              <Button
                size="lg"
                disabled={cart.length === 0 || !cart.some((l: any) => Number(l.quantity) > Number(l.kot_qty || 0))}
                onClick={holdPOSBill}
                className="w-full h-12 text-sm rounded-md font-semibold"
              >
                <Utensils className="w-4 h-4 mr-2" aria-hidden="true" /> Send to kitchen <kbd className="ml-1.5 text-[10px] font-normal opacity-70">F8</kbd>
              </Button>
              <p className="text-xs text-center text-muted-foreground">The cashier takes payment from the Held list.</p>
            </div>
          ) : (
          <div className={posLayout === 'mobile' ? 'hidden' : `grid grid-cols-2 ${isCompact ? 'gap-2' : 'gap-3'}`}>
              <Button
                variant="outline"
                size="lg"
                disabled={cart.length === 0}
                onClick={holdPOSBill}
                className={`${isCompact ? 'h-11 px-2 text-sm' : 'h-12 text-sm'} rounded-md font-semibold`}
              >
                {isCompact ? "Hold" : "Hold & send KOT"} <kbd className="ml-1.5 text-[10px] font-normal opacity-60">F8</kbd> <PauseCircle className={isCompact ? "w-4 h-4 ml-1 opacity-60" : "w-5 h-5 ml-2 opacity-60"} />
              </Button>
              <Button 
                size="lg" 
                disabled={cart.length === 0} 
                onClick={openCheckoutDialog}
                className={`${isCompact ? 'h-11 px-2 text-sm' : 'h-12 text-sm'} rounded-md font-semibold bg-primary hover:bg-primary/90`}
              >
                {isCompact ? "Pay" : "Checkout"} <kbd className="ml-1.5 text-[10px] font-normal opacity-70">F9</kbd> <ShoppingCart className={isCompact ? "w-4 h-4 ml-1 opacity-50" : "w-5 h-5 ml-2 opacity-50"} />
              </Button>
          </div>
          )}
        </div>
      </div>
      <LineNoteDialog
        open={noteLine !== null}
        onOpenChange={(open) => { if (!open) setNoteLineIndex(null); }}
        itemName={noteLine?.description || ""}
        notes={noteLine?.item_notes}
        modifiers={noteLine?.modifiers}
        onSave={(notes, modifiers) => {
          if (noteLineIndex === null) return;
          updateCartLine(noteLineIndex, 'item_notes', notes || undefined);
          updateCartLine(noteLineIndex, 'modifiers', modifiers);
        }}
      />
      <PromotionsDialog
        open={isPromotionsOpen}
        onOpenChange={setIsPromotionsOpen} 
        locationId={selectedLocation ? Number(selectedLocation) : null}
        locationName={currentLocationName}
      />
    </div>
  );
};

"use client";

import React from "react";
import { POSProvider, usePOS } from "./context/POSContext";
import { InventoryGrid } from "./components/InventoryGrid";
import { SidebarCart } from "./components/SidebarCart";
import { ProductSelectionDialog } from "./components/Dialogs/ProductSelectionDialog";
import { CheckoutDialog } from "./components/Dialogs/CheckoutDialog";
import { ManagementModals } from "./components/Dialogs/ManagementModals";
import { BillDiscountDialog } from "./components/Dialogs/BillDiscountDialog";
import { OrderTypeSelector } from "./components/OrderTypeSelector";
import { PromotionPromptDialog } from "./components/Dialogs/PromotionPromptDialog";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { MobilePosNav } from "./components/MobilePosNav";
import { PosStatusBar } from "./components/PosStatusBar";
import { PosLockScreen } from "./components/PosLockScreen";
import { VoidApprovalDialog } from "./components/Dialogs/VoidApprovalDialog";
import { CompApprovalDialog } from "./components/Dialogs/CompApprovalDialog";
import { PrintSelectionDialog } from "./components/Dialogs/PrintSelectionDialog";
import { PrintGuestSelectionDialog } from "./components/Dialogs/PrintGuestSelectionDialog";
import { Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { LayoutGrid, ShoppingCart as CartIcon } from "lucide-react";

/**
 * Main Content Component
 * Consumes POSContext and renders the modular layout.
 */
function POSContent() {
  const { 
    loading,
    selectedLocation, 
    setSelectedLocation, 
    locations,
    vKeyboardActiveInput,
    vKeyboardEnabled,
    activeMobileTab,
    setActiveMobileTab,
    cart,
    posLayout,
    cartWidth,
    permsReady,
    totals
  } = usePOS();

  const cartItemCount = cart.reduce((acc, it) => acc + Number(it.quantity), 0);

  // 1. Full-screen Loading State
  // Wait for permissions too, so stewards never see cashier tools flash on screen
  if (loading || !permsReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Initializing Terminal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden gap-0 w-full bg-slate-100 dark:bg-background transition-all duration-300 ${vKeyboardActiveInput && vKeyboardEnabled ? 'pb-[400px] sm:pb-[350px]' : ''}`}>
      
      {/* Location Enforcement Modal (If no location is set) */}
      <Dialog open={!selectedLocation} onOpenChange={() => {}}>
        <DialogContent size="sm" className="[&>button]:hidden rounded-lg p-8">
          <DialogHeader>
            <DialogTitle>Set Assigned Location</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground font-medium">Please select your service location to synchronize inventory and sales tracking.</p>
            <Select 
              value={selectedLocation} 
              onValueChange={(val) => {
                setSelectedLocation(val);
              }}
            >
              <SelectTrigger className="h-14 text-lg font-bold rounded-md border-2 focus:ring-primary">
                <SelectValue placeholder="Identify Terminal Location..." />
              </SelectTrigger>
              <SelectContent className="rounded-md shadow-xl border-none">
                {locations
                  .filter(loc => Boolean(loc.is_pos_active))
                  .map(loc => (
                  <SelectItem key={loc.id} value={String(loc.id)} className="font-bold py-3">
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Tabbed View (phones) */}
      {posLayout === 'mobile' && (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Tabs 
          value={activeMobileTab} 
          onValueChange={(val: any) => setActiveMobileTab(val)} 
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Menu / Order switch: labelled, 48px touch targets, order shows count + total */}
          <div className="bg-background border-b border-border px-3 py-2 shrink-0">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 rounded-md bg-muted">
              <TabsTrigger value="shelf" className="h-10 rounded-sm text-sm font-medium gap-2 data-[state=active]:shadow-sm">
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                Menu
              </TabsTrigger>
              <TabsTrigger value="bill" className="h-10 rounded-sm text-sm font-medium gap-2 data-[state=active]:shadow-sm">
                <CartIcon className="w-4 h-4" aria-hidden="true" />
                Order
                {cartItemCount > 0 && (
                  <>
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center tabular-nums">
                      {cartItemCount}
                    </span>
                    <span className="text-muted-foreground tabular-nums hidden sm:inline">
                      LKR {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="shelf" className="flex-1 mt-0 overflow-hidden">
            <InventoryGrid />
          </TabsContent>
          <TabsContent value="bill" className="flex-1 mt-0 overflow-hidden">
            <SidebarCart />
          </TabsContent>
        </Tabs>
      </div>
      )}

      {/* Side-by-Side View: compact for small/square POS screens, full for wide screens */}
      {posLayout !== 'mobile' && (
      <div className="flex flex-1 overflow-hidden min-w-0">
        <div className="flex-1 h-full overflow-hidden min-w-0">
          <InventoryGrid />
        </div>
        <div className="h-full overflow-hidden border-l border-border shrink-0" style={{ width: cartWidth }}>
          <SidebarCart />
        </div>
      </div>
      )}

      {posLayout !== 'mobile' && <PosStatusBar />}
      <VoidApprovalDialog />
      <CompApprovalDialog />
      <PosLockScreen />

      {posLayout === 'mobile' && <MobilePosNav />}
      
      {/* Functional Dialogs & Modals */}
      <ProductSelectionDialog />
      <CheckoutDialog />
      <ManagementModals />
      <BillDiscountDialog />
      <OrderTypeSelector />
      <PromotionPromptDialog />
      <VirtualKeyboard />
      <PrintSelectionDialog />
      <PrintGuestSelectionDialog />
    </div>
  );
}

/**
 * Root POS Page
 * Wraps the application in the POSProvider to manage global POS state.
 */
export default function POSPage() {
  return (
    <POSProvider>
      <POSContent />
    </POSProvider>
  );
}

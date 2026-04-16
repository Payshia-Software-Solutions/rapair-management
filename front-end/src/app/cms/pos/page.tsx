"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Calculator,
  Printer,
  CreditCard,
  Banknote,
  User,
  MapPin,
  Loader2,
  Store,
  Sun,
  Moon,
  Info,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchParts,
  fetchTaxes,
  fetchLocations,
  fetchCustomers,
  createCustomer,
  fetchCompany,
  createInvoice,
  createPaymentReceipt
} from "@/lib/api";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function POSPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data Context
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [systemTaxes, setSystemTaxes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  // POS State
  const [cart, setCart] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  // Quick Customer Add
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

  // Numpad Item Selection
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalQty, setModalQty] = useState<string>("1");
  const [modalDiscount, setModalDiscount] = useState<string>("0");
  const [showDiscount, setShowDiscount] = useState(false);

  // Checkout Dialog
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState<number>(0);
  // Cheque details
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBankName, setChequeBankName] = useState("");
  const [chequeBranchName, setChequeBranchName] = useState("");
  const [chequeDate, setChequeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chequePayee, setChequePayee] = useState("");

  // Guide Dialog
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Customer picker (shown when checkout is triggered without a customer)
  const [customerPickOpen, setCustomerPickOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [partsRes, taxesRes, locsRes, custsRes, compRes] = await Promise.all([
          fetchParts().catch(() => []),
          fetchTaxes('', { all: true }).catch(() => []),
          fetchLocations().catch(() => []),
          fetchCustomers().catch(() => []),
          fetchCompany().catch(() => null)
        ]);

        setInventory(partsRes.filter((p: any) => p.stock_quantity > 0 || p.item_type === 'Service'));
        
        let enabledIds = new Set<number>();
        if (compRes?.tax_ids_json) {
          try {
            const ids = JSON.parse(compRes.tax_ids_json);
            if (Array.isArray(ids)) enabledIds = new Set(ids);
          } catch {}
        }
        
        const filteredTaxes = (taxesRes || []).filter((t: any) => t.is_active && enabledIds.has(t.id));
        setSystemTaxes(filteredTaxes);
        
        setLocations(locsRes || []);
        setCustomers(custsRes || []);
        setCompany(compRes);

        const lsLocId = window?.localStorage?.getItem('location_id');
        if (lsLocId && (locsRes || []).some((l: any) => String(l.id) === lsLocId)) {
          setSelectedLocation(lsLocId);
        } else if (locsRes?.length === 1) {
          setSelectedLocation(String(locsRes[0].id));
        }
      } catch (err) {
        toast({ title: "Initialization Error", description: "Failed to load POS context.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadContext();
  }, [toast]);

  // --- Theme Management ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  // --- Cart Management ---
  const addToCartWithQty = (product: any, qty: number, discountAmt: number = 0) => {
    setCart(prev => {
      const existingLine = prev.find(item => item.id === product.id && item.unit_price === (product.price || product.cost_price || 0) && item.discount === discountAmt);
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

  const updateCartLine = (index: number, field: string, value: any) => {
    setCart(prev => {
      const newCart = [...prev];
      if (field === 'quantity' && value <= 0) return prev; // Avoid setting qty to 0 via input
      newCart[index] = { ...newCart[index], [field]: value };
      return newCart;
    });
  };

  const removeCartLine = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };


  // --- Calculations ---
  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDiscountTotal = 0;
    
    // Line level calculations
    cart.forEach(item => {
      const gross = item.quantity * item.unit_price;
      const discount = item.quantity * item.discount;
      subtotal += gross;
      lineDiscountTotal += discount;
    });

    const taxableAmount = Math.max(0, subtotal - lineDiscountTotal - globalDiscount);
    
    // Tax calculation
    let currentBase = taxableAmount;
    let taxSum = 0;
    const appliedTaxes: any[] = [];
    
    const sortedTaxes = [...systemTaxes].sort((a, b) => a.sort_order - b.sort_order);
    sortedTaxes.forEach(tax => {
      const applyTo = tax.apply_on === 'base_plus_previous' ? currentBase : taxableAmount;
      const taxAmt = applyTo * (Number(tax.rate_percent) / 100);
      taxSum += taxAmt;
      appliedTaxes.push({ name: tax.name, code: tax.code, rate_percent: tax.rate_percent, amount: taxAmt });
      if (tax.apply_on === 'base_plus_previous') {
        currentBase += taxAmt;
      }
    });

    const grandTotal = taxableAmount + taxSum;

    return { subtotal, lineDiscountTotal, taxableAmount, taxSum, appliedTaxes, grandTotal };
  }, [cart, globalDiscount, systemTaxes]);


  // --- Filter Products ---
  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const q = searchQuery.toLowerCase();
    return inventory.filter(p => 
      p.part_name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q) || 
      p.brand?.toLowerCase().includes(q)
    );
  }, [inventory, searchQuery]);


  // --- Handlers ---
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

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setModalQty("1"); // reset to 1
    setModalDiscount("0"); // reset discount
    setShowDiscount(false); // hide discount section
    setProductModalOpen(true);
  };

  const handleNumpadClick = (val: string) => {
    if (val === 'C') setModalQty("1");
    else if (val === 'DEL') setModalQty(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
    else setModalQty(prev => prev === "0" ? val : prev + val);
  };

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    const q = parseInt(modalQty, 10);
    const d = parseFloat(modalDiscount) || 0;
    if (isNaN(q) || q <= 0) return;
    
    addToCartWithQty(selectedProduct, q, d);
    setProductModalOpen(false);
    setSelectedProduct(null);
  };

  // Keyboard Numpad Integration
  useEffect(() => {
    if (!productModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keystrokes if the user is typing inside the Discount Input
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
  }, [productModalOpen, selectedProduct, modalQty, modalDiscount, confirmAddToCart]);

  const handleCheckoutProcess = async () => {
    if (!selectedLocation) { toast({ title: "Missing Data", description: "Select a location.", variant: "destructive" }); return; }
    if (cart.length === 0) return;
    // If no customer, auto-default to first customer and open a confirmation dialog
    if (!selectedCustomer) {
      if (customers.length > 0) setSelectedCustomer(String(customers[0].id));
      setCustomerPickOpen(true);
      setPendingCheckout(true);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Invoice payload
      const payload = {
        order_id: null,
        location_id: Number(selectedLocation),
        customer_id: Number(selectedCustomer),
        billing_address: company?.address || "",
        shipping_address: company?.address || "",
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0], // Immediate due date for POS
        subtotal: totals.subtotal,
        tax_total: totals.taxSum,
        discount_total: totals.lineDiscountTotal + globalDiscount,
        grand_total: totals.grandTotal,
        notes: "POS Retail Sale",
        // Map cart back to expected invoice items structure
        items: cart.map(item => ({
          item_id: item.id,
          description: item.description,
          item_type: item.item_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount, // Per unit discount
          line_total: Math.max(0, (item.unit_price - item.discount) * item.quantity)
        })),
        applied_taxes: totals.appliedTaxes
      };

      // 2. Generate
      const invoiceRes = await createInvoice(payload);
      const invoiceId = invoiceRes.data.id;

      // 3. Record Payment Receipt
      if (amountReceived > 0 || paymentMethod === 'Cheque') {
        const loc = locations.find((l: any) => String(l.id) === selectedLocation);
        const cust = customers.find((c: any) => String(c.id) === selectedCustomer);
        const receiptPayload: any = {
          invoice_id: invoiceId,
          invoice_no: invoiceRes.data.invoice_no ?? '',
          customer_id: Number(selectedCustomer),
          customer_name: cust?.name ?? '',
          location_id: Number(selectedLocation),
          amount: Math.min(amountReceived, totals.grandTotal),
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
          reference_no: 'POS Sale',
        };
        if (paymentMethod === 'Cheque') {
          receiptPayload.cheque = {
            cheque_no: chequeNo,
            bank_name: chequeBankName,
            branch_name: chequeBranchName,
            cheque_date: chequeDate,
            payee_name: chequePayee,
          };
        }
        await createPaymentReceipt(receiptPayload);
      }

      toast({ title: "Sale Complete", description: "Invoice generated successfully." });
      setCheckoutOpen(false);
      
      // Open thermal receipt in a new tab, keeping POS active
      window.open(`/cms/invoices/${invoiceId}/receipt?autoprint=1`, '_blank');

    } catch (err: any) {
      toast({ title: "Checkout Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden gap-0 w-full bg-slate-100 dark:bg-background">
      
      {/* Location Enforcement Modal */}
      <Dialog open={!loading && !selectedLocation} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Select Terminal Location</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">Please select the service location for this Point of Sale terminal before continuing.</p>
            <Select value={selectedLocation} onValueChange={(val) => {
              setSelectedLocation(val);
              window?.localStorage?.setItem('location_id', val);
            }}>
              <SelectTrigger className="h-12 text-lg">
                <SelectValue placeholder="Choose Location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
      {/* Customer Picker Dialog (triggered when no customer selected at checkout) */}
      <Dialog open={customerPickOpen} onOpenChange={(open) => {
        setCustomerPickOpen(open);
        if (!open) setPendingCheckout(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Select Customer
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">No customer was selected. Please confirm or choose a customer to continue checkout.</p>
            <SearchableSelect
              value={selectedCustomer}
              onValueChange={setSelectedCustomer}
              placeholder="Select Customer..."
              options={customers.map(c => ({
                value: String(c.id),
                label: c.name,
                keywords: `${c.name} ${c.phone}`
              }))}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setCustomerPickOpen(false); setPendingCheckout(false); }}>Cancel</Button>
            <Button
              disabled={!selectedCustomer}
              onClick={() => {
                setCustomerPickOpen(false);
                setPendingCheckout(false);
                // Trigger checkout immediately with the now-selected customer
                setCheckoutOpen(true);
                setAmountReceived(totals.grandTotal);
              }}
              className="flex-1 font-bold"
            >
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Information Guide Modal */}
      <Dialog open={guideModalOpen} onOpenChange={setGuideModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Info className="w-6 h-6 text-primary" /> POS Terminal Guide
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-primary">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="font-medium">Number Keys (0-9)</span>
                  <kbd className="px-2 py-1 bg-white border rounded shadow-sm text-xs">Qty Input</kbd>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="font-medium">Enter</span>
                  <kbd className="px-2 py-1 bg-white border rounded shadow-sm text-xs">Add / Pay</kbd>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="font-medium">Backspace / Del</span>
                  <kbd className="px-2 py-1 bg-white border rounded shadow-sm text-xs">Remove Qty</kbd>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="font-medium">C Key</span>
                  <kbd className="px-2 py-1 bg-white border rounded shadow-sm text-xs">Clear Qty</kbd>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-widest text-primary">Key Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span><strong>Touch Optimized:</strong> Use the on-screen Numpad for easier item entry on tablets or POS machines.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span><strong>Line Discounts:</strong> Specific discounts can be applied to individual items during selection.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span><strong>Auto-Printing:</strong> System immediately triggers printing and marks invoice as paid after successful checkout.</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                Tip: If the search box is focused, keyboard quantity inputs will type in search. Click outside or use the mouse to switch back to quantity dialing.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGuideModalOpen(false)} className="w-full font-bold">Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Selection & Numpad Modal */}
      <Dialog open={productModalOpen} onOpenChange={(open) => {
        if (!open) { setProductModalOpen(false); setSelectedProduct(null); setShowDiscount(false); }
      }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-background rounded-3xl">
          <div className="flex flex-col md:flex-row">
            {/* Left: Product Info */}
            <div className="w-full md:w-[45%] bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-border relative">
              {selectedProduct && (
                <div className="space-y-6 md:mt-4">
                  <div>
                    <Badge variant={selectedProduct.item_type === 'Service' ? 'secondary' : 'outline'} className="mb-3 text-[10px] tracking-widest uppercase">
                      {selectedProduct.item_type}
                    </Badge>
                    <h3 className="text-2xl font-black leading-tight text-foreground">{selectedProduct.part_name}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{selectedProduct.sku}</p>
                  </div>
                  
                  <div className="pt-6 border-t border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Unit Price</p>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">
                      LKR {(selectedProduct.price || selectedProduct.cost_price || 0).toLocaleString()}
                    </div>
                  </div>

                  {selectedProduct.item_type !== 'Service' && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-2 font-bold uppercase tracking-wider">Availability</p>
                      <div className={`text-base font-bold flex items-center gap-2 ${selectedProduct.stock_quantity > 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        <div className="w-2 h-2 rounded-full bg-current" />
                        {selectedProduct.stock_quantity} units in stock
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Right: Numpad */}
            <div className="w-full md:w-[55%] p-6 md:p-8 flex flex-col bg-white dark:bg-card">
              {/* Quantity Display */}
              <div className="mb-5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Quantity</label>
                <div className="mt-2 h-14 sm:h-16 bg-muted/30 border-2 border-border rounded-xl flex items-center justify-end px-4 shadow-inner focus-within:border-primary transition-colors">
                  <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter text-foreground">{modalQty}</span>
                </div>
              </div>

              {/* Numpad Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                {['1','2','3','4','5','6','7','8','9','C','0','DEL'].map(val => (
                  <Button
                    key={val}
                    variant={val === 'C' || val === 'DEL' ? 'secondary' : 'outline'}
                    className={`h-14 sm:h-16 text-xl sm:text-2xl font-black rounded-xl shadow-sm ${val !== 'C' && val !== 'DEL' ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-border hover:border-primary transition-all' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-none'}`}
                    onClick={() => handleNumpadClick(val)}
                  >
                    {val}
                  </Button>
                ))}
              </div>

              {/* Discount - collapsed by default */}
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

              <div className="mt-auto">
                <Button 
                  size="lg" 
                  className="w-full h-14 sm:h-16 rounded-xl text-lg sm:text-xl font-black tracking-widest uppercase shadow-xl"
                  onClick={confirmAddToCart}
                  disabled={!selectedProduct || parseInt(modalQty, 10) <= 0 || (selectedProduct?.item_type !== 'Service' && parseInt(modalQty, 10) > selectedProduct?.stock_quantity)}
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 mr-3" /> Add to Cart
                </Button>
                {selectedProduct && selectedProduct.item_type !== 'Service' && parseInt(modalQty, 10) > selectedProduct.stock_quantity && (
                  <p className="text-center text-sm text-rose-500 font-bold mt-2">Cannot exceed available stock</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- LEFT PANEL: Products Grid --- */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-card border-r border-border overflow-hidden p-4">
          {/* Top Bar: Search */}
          <div className="p-4 bg-white dark:bg-card border-b border-border shadow-sm flex items-center shrink-0">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or search by name / SKU..." 
                className="pl-10 h-14 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary shadow-inner rounded-xl text-lg backdrop-blur-xl"
              />
            </div>
            <div className="ml-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 bg-transparent border-border hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setGuideModalOpen(true)}
                title="Open POS Guide"
              >
                <Info className="w-5 h-5 text-slate-500" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 bg-transparent border-border"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <div className="flex items-center gap-2 px-4 h-10 border rounded-xl bg-orange-50/50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20 text-orange-700 dark:text-orange-400">
                <Store className="w-5 h-5" />
                <span className="font-bold tracking-tight">Retail POS</span>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredInventory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Search className="w-12 h-12 mb-4 opacity-20" />
                <p>No products found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredInventory.map(product => {
                  const outOfStock = product.stock_quantity <= 0 && product.item_type !== 'Service';
                  return (
                    <div 
                      key={product.id} 
                      onClick={() => !outOfStock && handleProductClick(product)}
                      className={`relative bg-white dark:bg-slate-900 border border-border hover:border-primary hover:shadow-lg transition-all rounded-2xl p-4 flex flex-col justify-between cursor-pointer group ${outOfStock ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <Badge variant={product.item_type === 'Service' ? 'secondary' : 'outline'} className="text-[10px] tracking-widest uppercase">
                          {product.item_type}
                        </Badge>
                        {product.item_type !== 'Service' && (
                          <span className={`text-xs font-bold ${product.stock_quantity > 5 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {product.stock_quantity} in stock
                          </span>
                        )}
                      </div>
                      <div>
                        {product.sku && <p className="text-[10px] text-muted-foreground mb-1">{product.sku}</p>}
                        <h4 className="font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">{product.part_name}</h4>
                        {product.brand && <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                        <span className="font-black text-lg text-foreground tabular-nums">LKR {(product.price || product.cost_price || 0).toLocaleString()}</span>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
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

        {/* --- RIGHT PANEL: Register / Cart --- */}
        <div className="w-full lg:w-[450px] shrink-0 flex flex-col bg-white dark:bg-card h-full rounded-2xl border border-border shadow-xl overflow-hidden relative">
          
          {/* POS Header: Customer & Location */}
          <div className="p-4 bg-muted/20 border-b border-border space-y-3 shrink-0">
            <div className="flex gap-2 items-center">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="h-9 border-0 bg-white dark:bg-slate-900 shadow-sm font-semibold">
                    <SelectValue placeholder="Location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <SearchableSelect
                  value={selectedCustomer}
                  onValueChange={setSelectedCustomer}
                  placeholder="Select or Search Customer..."
                  options={customers.map(c => ({
                    value: String(c.id),
                    label: c.name,
                    keywords: `${c.name} ${c.phone}`
                  }))}
                />
              </div>
              
              <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 shadow-sm"><Plus className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Walk-In</DialogTitle></DialogHeader>
                  <form onSubmit={handleQuickAddCustomer} className="space-y-4 pt-4">
                    <div className="space-y-2"><label className="text-sm font-bold">Name</label><Input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} autoFocus required/></div>
                    <div className="space-y-2"><label className="text-sm font-bold">Phone</label><Input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} required/></div>
                    <Button type="submit" disabled={addingCustomer} className="w-full">{addingCustomer ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save & Select"}</Button>
                  </form>
                </DialogContent>
              </Dialog>

            </div>
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-white dark:bg-card rounded-xl border border-dashed border-border m-2">
                <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="font-bold text-foreground">Cart is Empty</h3>
                <p className="text-sm mt-1">Scan or tap products to add them to the sale.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={index} className="bg-white dark:bg-card border border-border p-3 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm leading-tight text-foreground pr-2">{item.description}</div>
                      <Button variant="ghost" size="icon" onClick={() => removeCartLine(index)} className="w-6 h-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 -mt-1 -mr-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      
                      {/* Qty Controls */}
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg border border-border p-0.5">
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md" onClick={() => updateCartLine(index, 'quantity', item.quantity - 1)} disabled={item.quantity <= 1}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md bg-white border border-border shadow-sm text-primary" onClick={() => updateCartLine(index, 'quantity', item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <div className="font-black tabular-nums">LKR {(item.quantity * (item.unit_price - item.discount)).toLocaleString()}</div>
                        {item.discount > 0 && <div className="text-[10px] text-rose-500 line-through tabular-nums opacity-60">{(item.unit_price * item.quantity).toLocaleString()}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="bg-white dark:bg-card border-t border-border shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
            <div className="p-4 space-y-2 text-sm border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal :</span> <span className="font-bold text-foreground">LKR {totals.subtotal.toLocaleString()}</span></div>
              {totals.lineDiscountTotal > 0 && <div className="flex justify-between text-rose-500"><span>Discounts :</span> <span className="font-bold">-LKR {totals.lineDiscountTotal.toLocaleString()}</span></div>}
              {totals.appliedTaxes.map((t, idx) => (
                <div key={idx} className="flex justify-between text-blue-600 dark:text-cyan-400"><span>{t.code} {t.rate_percent > 0 ? `(${t.rate_percent}%)` : ''} :</span> <span className="font-bold">+LKR {t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              ))}
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xl">
                <span className="font-black uppercase tracking-tight text-muted-foreground">Total</span>
                <span className="font-black text-3xl tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400">LKR {totals.grandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              
              {/* Trigger Checkout Dialog */}
              <Dialog open={checkoutOpen} onOpenChange={(open) => {
                if(open && cart.length === 0) return;
                setCheckoutOpen(open);
                if(open) setAmountReceived(totals.grandTotal);
              }}>
                <DialogTrigger asChild>
                  <Button size="lg" disabled={cart.length === 0} className="w-full h-16 rounded-xl text-lg font-black tracking-widest uppercase bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                    Pay & Checkout <ShoppingCart className="w-6 h-6 ml-3 opacity-50" />
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                       <Calculator className="w-6 h-6 text-primary"/> POS Checkout
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-5 pt-4">
                    {/* Total */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl flex justify-between items-center">
                      <span className="font-bold text-muted-foreground uppercase tracking-wider text-xs">Total Due</span>
                      <span className="font-black text-2xl tabular-nums">LKR {totals.grandTotal.toLocaleString()}</span>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Payment Method</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['Cash', 'Card', 'Cheque', 'Bank Transfer'] as const).map(m => {
                          const icons: Record<string, React.ReactNode> = {
                            Cash: <Banknote className="w-4 h-4 mr-2" />,
                            Card: <CreditCard className="w-4 h-4 mr-2" />,
                            Cheque: <Receipt className="w-4 h-4 mr-2" />,
                            'Bank Transfer': <Store className="w-4 h-4 mr-2" />,
                          };
                          const active = paymentMethod === m;
                          return (
                            <Button key={m} type="button" variant={active ? 'default' : 'outline'}
                              className={`h-12 border-2 text-sm font-bold ${active ? 'border-primary ring-2 ring-primary/20' : ''}`}
                              onClick={() => { setPaymentMethod(m); if (amountReceived === 0) setAmountReceived(totals.grandTotal); }}
                            >
                              {icons[m]} {m}
                            </Button>
                          );
                        })}
                      </div>
                      {/* Credit Close */}
                      <Button
                        type="button"
                        variant={paymentMethod === 'Credit' ? 'destructive' : 'outline'}
                        className={`w-full h-11 border-2 font-bold text-sm ${paymentMethod === 'Credit' ? 'ring-2 ring-rose-500/20' : 'border-dashed border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10'}`}
                        onClick={() => { setPaymentMethod('Credit'); setAmountReceived(0); }}
                      >
                        📋 Credit Close — Invoice later
                      </Button>
                    </div>

                    {/* Cheque Details — shown only when Cheque selected */}
                    {paymentMethod === 'Cheque' && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl space-y-3">
                        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">📋 Cheque Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Last 6 Digits</label>
                            <Input maxLength={6} placeholder="XXXXXX" value={chequeNo} onChange={e => setChequeNo(e.target.value.replace(/\D/g, ''))} className="font-mono text-center tracking-widest font-bold h-10" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Cheque Date</label>
                            <Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className="h-10" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Bank</label>
                            <Input placeholder="e.g. Sampath Bank" value={chequeBankName} onChange={e => setChequeBankName(e.target.value)} className="h-10" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Branch</label>
                            <Input placeholder="e.g. Colombo 3" value={chequeBranchName} onChange={e => setChequeBranchName(e.target.value)} className="h-10" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Payee Name</label>
                            <Input placeholder="Name on cheque" value={chequePayee} onChange={e => setChequePayee(e.target.value)} className="h-10" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Amount Tendered — hidden for Credit */}
                    {paymentMethod !== 'Credit' && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount Tendered</label>
                        <Input 
                          type="number"
                          value={amountReceived} 
                          onChange={(e) => setAmountReceived(Number(e.target.value))}
                          className="text-center font-black text-3xl h-16 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 focus-visible:ring-emerald-500 text-emerald-600 dark:text-emerald-400"
                        />
                        <div className="flex justify-center gap-2">
                          {[0, 500, 1000, 5000].map(bump => (
                            <Button key={bump} variant="outline" size="sm" onClick={() => setAmountReceived(bump === 0 ? totals.grandTotal : amountReceived + bump)} className="font-bold tabular-nums">
                              {bump === 0 ? 'Exact' : `+${bump}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Change due */}
                    {paymentMethod !== 'Credit' && amountReceived - totals.grandTotal > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:border-orange-500/30 text-orange-600 dark:text-orange-400">
                        <span className="font-bold text-sm uppercase tracking-wider">Change Due</span>
                        <span className="font-black text-xl tabular-nums">LKR {(amountReceived - totals.grandTotal).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="mt-6 border-t pt-4">
                    <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                    <Button onClick={handleCheckoutProcess} disabled={submitting} className="font-bold flex-1 ml-2 shadow-lg shadow-primary/20">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-5 h-5 mr-2 opacity-50" />}
                      Process & Print
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            </div>
          </div>

      </div>
    </div>
  );
}

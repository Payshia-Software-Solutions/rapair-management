"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  Calculator,
  Save,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { fetchOrder, createInvoice, fetchOrderParts, fetchParts, fetchTaxes, fetchLocations, fetchCustomers, createCustomer, fetchCompany } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CreateInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState("");

  const [allParts, setAllParts] = useState<any[]>([]);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [systemTaxes, setSystemTaxes] = useState<any[]>([]);
  const [billDiscount, setBillDiscount] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");

  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [differentShipping, setDifferentShipping] = useState(false);
  
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const isStandalone = orderId === 'standalone';

  useEffect(() => {
    loadOrderContext();
  }, [orderId]);

  useEffect(() => {
    if (selectedCustomer && customers.length > 0) {
      const cust = customers.find(c => String(c.id) === selectedCustomer);
      if (cust && cust.address) {
        setBillingAddress(cust.address);
        if (!differentShipping) setShippingAddress(cust.address);
      }
    }
  }, [selectedCustomer, customers, differentShipping]);

  const loadOrderContext = async () => {
    setLoading(true);
    try {
      const fetches: Promise<any>[] = [
        fetchParts().catch(() => []),
        fetchTaxes('', { all: true }).catch(() => []),
        fetchLocations().catch(() => []),
        fetchCustomers().catch(() => []),
        fetchCompany().catch(() => null)
      ];

      // Only fetch order-specific data if not standalone
      if (!isStandalone) {
        fetches.push(fetchOrder(orderId));
        fetches.push(fetchOrderParts(orderId).catch(() => []));
      }

      const results = await Promise.all(fetches);
      
      let inventoryParts, allTaxesData, locs, custs, company, orderData, partsData;
      
      if (!isStandalone) {
        [inventoryParts, allTaxesData, locs, custs, company, orderData, partsData] = results;
      } else {
        [inventoryParts, allTaxesData, locs, custs, company] = results;
        orderData = null;
        partsData = [];
      }

      setOrder(orderData);
      setAllParts(inventoryParts);
      
      // Parse JSON from company data
      let enabledIds = new Set<number>();
      if (company?.tax_ids_json) {
        try {
          const ids = JSON.parse(company.tax_ids_json);
          if (Array.isArray(ids)) enabledIds = new Set(ids);
        } catch {
          // ignore
        }
      }
      
      const filteredTaxes = (allTaxesData || []).filter((t: any) => t.is_active && enabledIds.has(t.id));
      
      setSystemTaxes(filteredTaxes);
      setLocations(locs || []);
      setCustomers(custs || []);
      
      // Standalone mode: default to empty items
      if (isStandalone) {
        setItems([]);
      } else if (partsData && partsData.length > 0) {
        // Map order parts to invoice items
        const initialItems = partsData.map((p: any) => ({
          description: p.part_name || p.description,
          item_id: p.part_id,
          item_type: "Part",
          quantity: p.quantity,
          unit_price: p.unit_price,
          discount: 0,
          line_total: p.line_total
        }));
        setItems(initialItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load order context.",
        variant: "destructive"
      });
      router.push("/cms/invoices/new");
    } finally {
      setLoading(false);
    }
  };

  // discount is per-unit: line_total = (unit_price - discount) * qty
  const calculateLineTotal = (qty: number, price: number, discountPerUnit: number) => {
    return Math.max(0, (price - discountPerUnit) * qty);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (['quantity', 'unit_price', 'discount'].includes(field)) {
      const qty = Number(newItems[index].quantity) || 0;
      const price = Number(newItems[index].unit_price) || 0;
      const disc = Number(newItems[index].discount) || 0;
      newItems[index].line_total = calculateLineTotal(qty, price, disc);
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", item_type: "Part", quantity: 1, unit_price: 0, discount: 0, line_total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // subtotal = gross (no discount), line_discount = total saved across all items (discount/unit * qty)
  const totals = items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const discPerUnit = Number(item.discount) || 0;
    const gross = qty * price;
    const lineDiscount = discPerUnit * qty;
    const lineTotal = Math.max(0, gross - lineDiscount);
    return {
      subtotal: acc.subtotal + gross,
      line_discount: acc.line_discount + lineDiscount,
      line_totals_sum: acc.line_totals_sum + lineTotal
    };
  }, { subtotal: 0, line_discount: 0, line_totals_sum: 0 });

  const globalDiscountValue = Number(billDiscount) || 0;
  const globalDiscount = discountType === 'percent' 
    ? totals.line_totals_sum * (globalDiscountValue / 100)
    : globalDiscountValue;

  const taxableAmount = Math.max(0, totals.line_totals_sum - globalDiscount);
  
  let currentBase = taxableAmount;
  let taxSum = 0;
  const appliedTaxes: { name: string, code: string, amount: number }[] = [];
  
  const sortedTaxes = [...systemTaxes].sort((a, b) => a.sort_order - b.sort_order);
  sortedTaxes.forEach(tax => {
    const applyTo = tax.apply_on === 'base_plus_previous' ? currentBase : taxableAmount;
    const taxAmt = applyTo * (Number(tax.rate_percent) / 100);
    taxSum += taxAmt;
    appliedTaxes.push({ name: tax.name, code: tax.code, amount: taxAmt });
    if (tax.apply_on === 'base_plus_previous') {
      currentBase += taxAmt;
    }
  });

  const grandTotal = taxableAmount + taxSum;
  const totalDiscount = totals.line_discount + globalDiscount;

  const handleSave = async () => {
    // Basic Field Validations
    if (!selectedLocation) {
      toast({ title: "Validation Error", description: "Please select an originating location.", variant: "destructive" });
      return;
    }

    if (!selectedCustomer) {
      toast({ title: "Validation Error", description: "Please select or add a customer for this invoice.", variant: "destructive" });
      return;
    }

    // Item Validations
    if (items.length === 0) {
      toast({ title: "Validation Error", description: "Invoice must have at least one item.", variant: "destructive" });
      return;
    }

    if (items.some(i => !i.description.trim())) {
      toast({ title: "Validation Error", description: "All items must have a description.", variant: "destructive" });
      return;
    }

    if (grandTotal <= 0) {
      toast({ title: "Validation Error", description: "Invoice total must be greater than zero.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        order_id: Number(orderId) || null,
        location_id: selectedLocation ? Number(selectedLocation) : null,
        customer_id: selectedCustomer ? Number(selectedCustomer) : (order?.customer_id ?? 1),
        billing_address: billingAddress.trim(),
        shipping_address: differentShipping ? shippingAddress.trim() : billingAddress.trim(),
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: totals.subtotal,
        tax_total: taxSum,
        discount_total: totalDiscount,
        grand_total: grandTotal,
        notes: notes,
        items: items,
        applied_taxes: appliedTaxes.map(tax => ({
          ...tax,
          rate_percent: systemTaxes.find(st => st.code === tax.code)?.rate_percent || 0
        }))
      };

      const res = await createInvoice(payload);
      toast({ title: "Success", description: "Invoice generated successfully." });
      // Redirect directly to the print template
      router.push(`/cms/invoices/${res.data.id}/print?autoprint=1`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>CMS</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => router.push('/cms/invoices')}>Invoices</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-medium text-foreground">Draft Invoice</span>
        </div>

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 border border-slate-200 dark:border-0 px-8 py-7 shadow-sm dark:shadow-xl">
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-20 w-32 h-32 rounded-full bg-blue-400/10 dark:bg-cyan-400/10 blur-xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold tracking-widest uppercase">
                  {isStandalone ? "Direct Invoice" : "Invoice Builder"}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                {isStandalone ? "Create Direct Invoice" : "Draft Invoice"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                {isStandalone ? (
                  "Create a standalone invoice without a repair order reference."
                ) : (
                  <>
                    Composing invoice for <span className="text-amber-600 dark:text-amber-300 font-semibold">Order #{orderId}</span>
                    {order?.customer_name && <span className="text-slate-500 dark:text-slate-400"> · {order.customer_name}</span>}
                  </>
                )}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={submitting || items.length === 0 || !selectedLocation || !selectedCustomer}
              className="h-12 px-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold shadow-lg shadow-amber-500/30 border-0 transition-all hover:scale-105"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Generate Invoice
            </Button>
          </div>
        </div>


        {/* ── Location + Customer Bar ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm">
          {/* Location */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest block">📍 Location</label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="h-11 border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/40 focus:ring-amber-400/50 focus:border-amber-400">
                <SelectValue placeholder="Select originating location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc: any) => (
                  <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest block">👤 Customer</label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <SearchableSelect
                  value={selectedCustomer}
                  onValueChange={setSelectedCustomer}
                  options={customers.map(c => ({
                    value: String(c.id),
                    label: `${c.name} (${c.phone || 'No Phone'})`,
                    keywords: `${c.name} ${c.phone || ''} ${c.email || ''}`
                  }))}
                  placeholder="Search & link customer..."
                />
              </div>
              <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10 w-10 p-0 shrink-0 border-slate-200 dark:border-border hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-500 transition-all">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Quick Add Customer</DialogTitle></DialogHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
                      toast({ title: "Validation Error", description: "Name and Phone are required", variant: "destructive" });
                      return;
                    }
                    setAddingCustomer(true);
                    try {
                      const res = await createCustomer({ name: newCustomerName, phone: newCustomerPhone, status: 'Active' });
                      toast({ title: "Success", description: "Customer added successfully" });
                      const newCustId = res.data.id;
                      const custs = await fetchCustomers();
                      setCustomers(custs);
                      setSelectedCustomer(String(newCustId));
                      setAddCustomerOpen(false);
                      setNewCustomerName("");
                      setNewCustomerPhone("");
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message || "Failed to add customer", variant: "destructive" });
                    } finally {
                      setAddingCustomer(false);
                    }
                  }} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Customer Name *</label>
                      <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} required placeholder="e.g. John Doe" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Phone Number *</label>
                      <Input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} required placeholder="e.g. 0771234567" />
                    </div>
                    <Button type="submit" disabled={addingCustomer} className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold border-0">
                      {addingCustomer ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Customer"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Line Items Card ── */}
          <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-amber-400" />
                <span className="font-bold text-slate-800 dark:text-foreground text-base">Line Items</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-muted-foreground font-medium">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="p-5 space-y-3">
              {items.map((item, index) => (
                <div key={index} className={`flex flex-wrap lg:flex-nowrap items-start gap-3 p-4 rounded-xl border transition-all ${index % 2 === 0 ? 'bg-slate-50 dark:bg-muted/30 border-slate-100 dark:border-border' : 'bg-white dark:bg-card border-slate-100 dark:border-border'} hover:border-amber-300 dark:hover:border-amber-400/50 hover:shadow-sm`}>
                  <div className="w-full lg:w-2/5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                    <Input
                      placeholder="e.g. Oil Filter / Labor"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      disabled={!!item.item_id}
                      className={`border-slate-200 dark:border-border focus:border-amber-400 focus:ring-amber-400/30 ${!!item.item_id ? 'bg-slate-100 dark:bg-muted text-slate-400 dark:text-muted-foreground cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="w-1/2 lg:w-1/6">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Type</label>
                    <Select 
                      value={item.item_type} 
                      onValueChange={(val) => handleItemChange(index, 'item_type', val)} 
                      disabled={!!item.item_id}
                    >
                      <SelectTrigger className={`border-slate-200 dark:border-border focus:border-amber-400 ${!!item.item_id ? 'bg-slate-100 dark:bg-muted text-slate-400 dark:text-muted-foreground cursor-not-allowed opacity-100' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Part">Part</SelectItem>
                        <SelectItem value="Labor">Labor</SelectItem>
                        <SelectItem value="Service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-1/2 lg:w-20">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Qty</label>
                    <Input
                      type="number" min="0.01" step="0.01"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="border-slate-200 dark:border-border focus:border-amber-400 focus:ring-amber-400/30"
                    />
                  </div>
                  <div className="w-1/2 lg:w-28">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Unit Price</label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      className="border-slate-200 dark:border-border focus:border-amber-400 focus:ring-amber-400/30"
                    />
                  </div>
                  <div className="w-1/2 lg:w-24">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Disc/Unit</label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={item.discount}
                      onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                      className="border-slate-200 dark:border-border focus:border-amber-400 focus:ring-amber-400/30"
                    />
                  </div>
                  <div className="w-1/2 lg:w-28">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Total</label>
                    <Input
                      type="number"
                      readOnly
                      value={Number(item.line_total || 0).toFixed(2)}
                      className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-400/50 font-bold text-amber-600 dark:text-amber-400 cursor-default"
                    />
                  </div>
                  <div className="w-full lg:w-auto pt-5 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1} className="text-slate-400 dark:text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-destructive/10 dark:hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add Controls */}
              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 dark:border-border mt-2">
                <div className="w-full">
                  <SearchableSelect
                    value={selectedPartId}
                    onValueChange={(val) => {
                      const p = allParts.find(x => String(x.id) === String(val));
                      if (p) {
                        setItems([...items, {
                          item_id: p.id,
                          description: p.part_name,
                          item_type: p.item_type === "Service" ? "Service" : "Part",
                          quantity: 1,
                          unit_price: p.price || p.cost_price || 0,
                          discount: 0,
                          line_total: p.price || p.cost_price || 0
                        }]);
                        setSelectedPartId("");
                      }
                    }}
                    options={allParts.map(p => ({
                      value: String(p.id),
                      label: `${p.part_name}${p.sku ? ` (${p.sku})` : ''}`,
                      keywords: `${p.part_name} ${p.sku || ''}`
                    }))}
                    placeholder="🔍 Select from inventory to add item..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-5">

            {/* Details Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/40">
                <div className="w-1 h-4 rounded-full bg-cyan-400" />
                <span className="font-bold text-slate-800 dark:text-foreground text-sm">Invoice Details</span>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Issue Date</label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="border-slate-200 dark:border-border focus:border-amber-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Due Date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-slate-200 dark:border-border focus:border-amber-400" />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[7, 21, 30, 45, 60].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          const d = new Date(issueDate || new Date().toISOString().split('T')[0]);
                          d.setDate(d.getDate() + days);
                          setDueDate(d.toISOString().split('T')[0]);
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-muted text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-400 border border-slate-200 dark:border-border transition-colors font-bold uppercase tracking-tighter"
                      >
                        {days}D
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Notes</label>
                  <Input placeholder="Thank you for your business!" value={notes} onChange={(e) => setNotes(e.target.value)} className="border-slate-200 dark:border-border focus:border-amber-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Billing Address</label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background text-slate-800 dark:text-foreground px-3 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all"
                    placeholder="Enter billing address..."
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="diffShip" checked={differentShipping} onChange={(e) => setDifferentShipping(e.target.checked)} className="rounded border-slate-300 dark:border-border accent-amber-500 w-4 h-4 cursor-pointer" />
                  <label htmlFor="diffShip" className="text-sm font-medium text-slate-600 dark:text-muted-foreground cursor-pointer select-none">Different Shipping Address</label>
                </div>
                {differentShipping && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-1.5 block">Shipping Address</label>
                    <textarea
                      className="flex min-h-[72px] w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-background text-slate-800 dark:text-foreground px-3 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all"
                      placeholder="Enter shipping address..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Totals Card */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-0">
              {/* Header */}
              <div className="bg-slate-100 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-700 px-5 py-4 flex items-center gap-2 border-b border-slate-200 dark:border-0">
                <Calculator className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="font-bold text-slate-800 dark:text-white text-sm tracking-wide">Invoice Summary</span>
              </div>

              {/* Bill Discount Input */}
              <div className="bg-slate-50 dark:bg-slate-700 px-5 py-3 flex items-center gap-3 border-b border-slate-200 dark:border-white/10">
                <span className="text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap font-medium">Bill Discount</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                  className="bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 h-8 flex-1 text-sm"
                />
                <Button
                  variant="ghost"
                  onClick={() => setDiscountType(prev => prev === 'value' ? 'percent' : 'value')}
                  className="h-8 min-w-[44px] px-2 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/40 text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 font-bold text-xs shrink-0 border border-amber-300 dark:border-amber-400/30"
                >
                  {discountType === 'percent' ? '%' : 'LKR'}
                </Button>
              </div>

              {/* Breakdown */}
              <div className="bg-white dark:bg-slate-800 px-5 py-4 space-y-2.5">
                <div className="flex justify-between text-slate-600 dark:text-slate-300 text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">LKR {totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.line_discount > 0 && (
                  <div className="flex justify-between text-red-500 dark:text-rose-400 text-sm">
                    <span>Item Discounts</span>
                    <span>−LKR {totals.line_discount.toFixed(2)}</span>
                  </div>
                )}
                {globalDiscount > 0 && (
                  <div className="flex justify-between text-red-500 dark:text-rose-400 text-sm">
                    <span>Bill Discount {discountType === 'percent' ? `(${billDiscount}%)` : ''}</span>
                    <span>−LKR {globalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {(totals.line_discount > 0 || globalDiscount > 0) && (
                  <div className="flex justify-between text-slate-400 dark:text-slate-500 text-xs border-t border-slate-100 dark:border-slate-700 pt-2">
                    <span>After Discount</span>
                    <span>LKR {taxableAmount.toFixed(2)}</span>
                  </div>
                )}
                {appliedTaxes.map((tax, idx) => (
                  <div key={idx} className="flex justify-between text-blue-600 dark:text-cyan-400 text-sm">
                    <span title={tax.name} className="cursor-help">{tax.code}</span>
                    <span>+LKR {tax.amount.toFixed(2)}</span>
                  </div>
                ))}

                {/* Grand Total */}
                <div className="border-t border-slate-100 dark:border-slate-600 mt-1 pt-3 flex justify-between items-baseline">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold text-sm">Grand Total</span>
                  <span className="text-amber-500 dark:text-amber-400 font-extrabold text-2xl">LKR {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleSave}
                disabled={submitting || grandTotal <= 0}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-4 text-sm tracking-wide transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {submitting ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
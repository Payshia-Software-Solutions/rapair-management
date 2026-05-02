"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchCustomers, 
  fetchTaxes, 
  fetchParts, 
  createQuotation,
  fetchCompany,
  fetchLocations,
  fetchShippingProviders,
  fetchCostingTemplates,
  fetchCostingTemplate
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft, 
  Loader2, 
  Calculator, 
  User, 
  Package, 
  Info,
  Calendar,
  Globe,
  Truck
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

export default function CreateQuotationPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([{ description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  const [shippingProviders, setShippingProviders] = useState<any[]>([]);
  const [costingTemplates, setCostingTemplates] = useState<any[]>([]);

  // International Shipping State
  const [isInternational, setIsInternational] = useState(false);
  const [shippingProviderId, setShippingProviderId] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingCountry, setShippingCountry] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateItems, setTemplateItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cData, tData, pData, compData, locData, sData, ctData] = await Promise.all([
          fetchCustomers(),
          fetchTaxes(),
          fetchParts(),
          fetchCompany().catch(() => null),
          fetchLocations().catch(() => []),
          fetchShippingProviders().catch(() => []),
          fetchCostingTemplates().catch(() => [])
        ]);
        setCustomers(cData);
        setTaxes(tData);
        setParts(pData);
        setLocations(locData);
        setShippingProviders(sData?.data || sData || []);
        setCostingTemplates(Array.isArray(ctData?.data) ? ctData.data : []);

        // Pre-select location (LS preference or default)
        const lsLocId = window?.localStorage?.getItem('location_id');
        if (lsLocId && (locData || []).some((l: any) => String(l.id) === lsLocId)) {
          setSelectedLocationId(lsLocId);
        } else {
          const defaultLoc = (locData || []).find((l: any) => l.is_default);
          if (defaultLoc) setSelectedLocationId(String(defaultLoc.id));
          else if (locData && locData.length > 0) setSelectedLocationId(String(locData[0].id));
        }

        // Auto-apply default taxes same as invoice
        if (compData?.tax_ids_json) {
          try {
            const ids = JSON.parse(compData.tax_ids_json);
            if (Array.isArray(ids)) {
              setSelectedTaxIds(ids.map(id => id.toString()));
            }
          } catch (e) {}
        }
      } catch (err: any) {
        toast({ title: "Error", description: "Failed to load initialization data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.length ? newItems : [{ description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = Number(newItems[index].quantity || 0) * Number(newItems[index].unit_price || 0);
    }
    
    if (field === 'item_id') {
      const part = parts.find(p => p.id.toString() === value);
      if (part) {
        newItems[index].description = part.part_name;
        newItems[index].unit_price = part.price;
        newItems[index].line_total = Number(newItems[index].quantity || 0) * Number(part.price || 0);
      }
    }
    
    setItems(newItems);
  };

  const calculateShippingCost = (baseCost: number, templateItems: any[]) => {
    let total = baseCost;
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    
    templateItems.forEach(item => {
      if (item.cost_type === 'Fixed') {
        total += Number(item.value);
      } else if (item.cost_type === 'Percentage') {
        total += baseCost * (Number(item.value) / 100);
      } else if (item.cost_type === 'Per Unit') {
        total += Number(item.value) * totalQty;
      }
    });
    return total;
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId || templateId === "none") {
      setTemplateItems([]);
      // Reset to provider base cost if a provider is selected
      const provider = shippingProviders.find(p => p.id.toString() === shippingProviderId);
      if (provider) setShippingCost(Number(provider.base_cost));
      return;
    }

    try {
      const res = await fetchCostingTemplate(Number(templateId));
      if (res && res.status === 'success') {
        const items = res.data.items || [];
        setTemplateItems(items);
        
        const provider = shippingProviders.find(p => p.id.toString() === shippingProviderId);
        const base = provider ? Number(provider.base_cost) : 0;
        setShippingCost(calculateShippingCost(base, items));
      }
    } catch (err) {
      console.error("Failed to fetch template items", err);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setShippingProviderId(providerId);
    const provider = shippingProviders.find(p => p.id.toString() === providerId);
    const base = provider ? Number(provider.base_cost) : 0;
    
    if (selectedTemplateId && selectedTemplateId !== "none") {
      setShippingCost(calculateShippingCost(base, templateItems));
    } else {
      setShippingCost(base);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  
  const appliedTaxes = selectedTaxIds.map(tid => {
    const t = taxes.find(tx => tx.id.toString() === tid);
    if (!t) return null;
    const amount = subtotal * (Number(t.rate_percent) / 100);
    return {
      name: t.name,
      code: t.code,
      rate_percent: t.rate_percent,
      amount: amount
    };
  }).filter(t => t !== null) as any[];

  const taxTotal = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);
  const grandTotal = subtotal + taxTotal + (isInternational ? Number(shippingCost || 0) : 0);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Missing Information", description: "Please select a customer.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        location_id: selectedLocationId,
        issue_date: issueDate,
        expiry_date: expiryDate || null,
        notes,
        subtotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        items,
        taxes: appliedTaxes,
        is_international: isInternational ? 1 : 0,
        shipping_provider_id: isInternational ? shippingProviderId : null,
        shipping_costing_template_id: isInternational && selectedTemplateId !== "none" ? selectedTemplateId : null,
        shipping_cost: isInternational ? shippingCost : 0,
        shipping_country: isInternational ? shippingCountry : null,
        shipping_address: isInternational ? shippingAddress : null
      };

      const res = await createQuotation(payload);
      toast({ title: "Success", description: "Quotation created successfully" });
      
      // Professional Auto-Print: Open print layout in a new tab
      window.open(`/sales/quotations/print/${res.data.id}`, '_blank');
      
      // Redirect to details view instead of just the list
      router.push(`/sales/quotations/${res.data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Initializing builder...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullWidth={true}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/sales/quotations">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight">New Quotation</h1>
              <p className="text-muted-foreground text-sm">Create a professional estimate for your client</p>
            </div>
          </div>
          <Button 
            className="h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Save Quotation
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-xl bg-muted/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" /> Items & Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 px-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">
                  <div className="col-span-6">Description / Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right pr-4">Total</div>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-background p-4 rounded-xl border border-primary/10 shadow-sm relative group animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="col-span-1 md:col-span-6 space-y-2">
                      <Select 
                        value={item.item_id?.toString()} 
                        onValueChange={(val) => updateItem(index, 'item_id', val)}
                      >
                        <SelectTrigger className="h-11 font-medium">
                          <SelectValue placeholder="Select an item or type below..." />
                        </SelectTrigger>
                        <SelectContent>
                          {parts.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.part_name} (LKR {p.price})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Additional details or custom description..." 
                        className="h-10 text-xs bg-muted/30"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <Label className="md:hidden">Quantity</Label>
                      <Input 
                        type="number" 
                        className="h-11 text-center font-bold"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <Label className="md:hidden">Unit Price</Label>
                      <Input 
                        type="number" 
                        className="h-11 text-right font-bold"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 flex flex-col justify-center items-end pr-4">
                      <div className="md:hidden text-xs text-muted-foreground uppercase font-black mb-1">Line Total</div>
                      <div className="font-black text-lg">
                        LKR {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-destructive text-white shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:scale-110"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <Button 
                  variant="outline" 
                  className="w-full h-12 border-dashed border-2 hover:bg-primary/5 hover:border-primary/30 text-primary font-bold transition-all"
                  onClick={handleAddItem}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Line Item
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Terms & Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea 
                  className="w-full min-h-[120px] p-4 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="Terms of service, payment instructions, or internal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Customer & Totals */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl bg-primary text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <User className="w-32 h-32" />
              </div>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5" /> Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/70">Service Location</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger className="h-12 bg-white/10 border-white/20 text-white font-bold">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/70">Customer</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger className="h-12 bg-white/10 border-white/20 text-white font-bold">
                        <SelectValue placeholder="Select a customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/70">Issue Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                      <Input 
                        type="date" 
                        className="h-11 bg-white/10 border-white/20 text-white pl-10"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Expiry Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                      <Input 
                        type="date" 
                        className="h-11 bg-white/10 border-white/20 text-white pl-10"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-card border-t-4 border-t-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" /> Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Subtotal</span>
                    <span className="font-bold">LKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Applicable Taxes</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {taxes.map(t => (
                        <div key={t.id} className="flex items-center space-x-2 bg-muted/20 p-2 rounded-lg border border-transparent hover:border-primary/20 transition-colors">
                          <Checkbox 
                            id={`tax-${t.id}`} 
                            checked={selectedTaxIds.includes(t.id.toString())}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTaxIds([...selectedTaxIds, t.id.toString()]);
                              } else {
                                setSelectedTaxIds(selectedTaxIds.filter(id => id !== t.id.toString()));
                              }
                            }}
                          />
                          <label 
                            htmlFor={`tax-${t.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            {t.name} ({t.rate_percent}%)
                          </label>
                        </div>
                      ))}
                      {taxes.length === 0 && <p className="text-xs text-muted-foreground italic">No taxes configured</p>}
                    </div>
                  </div>

                  {appliedTaxes.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {appliedTaxes.map((at, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm animate-in fade-in slide-in-from-right-2">
                          <span className="text-muted-foreground font-medium">{at.name} ({at.rate_percent}%)</span>
                          <span className="font-bold text-primary">+ LKR {at.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* International Shipping Section */}
                  <div className="pt-4 border-t border-dashed space-y-4">
                    <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/20">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <Label htmlFor="intl-toggle" className="font-bold text-blue-900 dark:text-blue-300 cursor-pointer">International Delivery</Label>
                      </div>
                      <Checkbox 
                        id="intl-toggle" 
                        checked={isInternational}
                        onCheckedChange={(checked) => setIsInternational(!!checked)}
                      />
                    </div>

                    {isInternational && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Shipping Carrier</Label>
                          <Select 
                            value={shippingProviderId} 
                            onValueChange={handleProviderChange}
                          >
                            <SelectTrigger className="h-11 font-bold border-blue-200 dark:border-blue-900/30">
                              <SelectValue placeholder="Select carrier..." />
                            </SelectTrigger>
                            <SelectContent>
                              {shippingProviders.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name} (Base: LKR {p.base_cost})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Costing Template</Label>
                          <Select 
                            value={selectedTemplateId || "none"} 
                            onValueChange={handleTemplateChange}
                          >
                            <SelectTrigger className="h-11 font-bold border-indigo-200 dark:border-indigo-900/30">
                              <SelectValue placeholder="No template (Base Cost Only)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No template (Base Cost Only)</SelectItem>
                              {costingTemplates.map(t => (
                                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Shipping Cost</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">LKR</span>
                              <Input 
                                type="number"
                                className="h-11 pl-12 font-black text-blue-600"
                                value={shippingCost}
                                onChange={(e) => setShippingCost(Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Country</Label>
                            <Input 
                              placeholder="e.g. USA"
                              className="h-11 font-bold"
                              value={shippingCountry}
                              onChange={(e) => setShippingCountry(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-black text-muted-foreground opacity-70 tracking-widest">Shipping Address</Label>
                          <textarea 
                            className="w-full min-h-[80px] p-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                            placeholder="Full destination address..."
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {isInternational && (
                      <div className="flex justify-between items-center text-sm font-bold text-blue-600 dark:text-blue-400">
                        <span>Total Shipping Fee</span>
                        <span>LKR {Number(shippingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {isInternational && templateItems.length > 0 && (
                      <div className="mt-2 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20 animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-[10px] uppercase font-black text-indigo-400 tracking-widest mb-2 flex items-center gap-2">
                          <Calculator className="w-3 h-3" /> Costing Sheet Breakdown
                        </div>
                        <div className="space-y-1.5">
                          {/* Base Cost from Carrier */}
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Base Carrier Rate</span>
                            <span>LKR {Number(shippingProviders.find(p => p.id.toString() === shippingProviderId)?.base_cost || 0).toLocaleString()}</span>
                          </div>
                          {/* Template Components */}
                          {templateItems.map((ti, idx) => {
                            const base = Number(shippingProviders.find(p => p.id.toString() === shippingProviderId)?.base_cost || 0);
                            const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                            
                            let amount = 0;
                            if (ti.cost_type === 'Fixed') amount = Number(ti.value);
                            else if (ti.cost_type === 'Percentage') amount = base * (Number(ti.value) / 100);
                            else if (ti.cost_type === 'Per Unit') amount = Number(ti.value) * totalQty;

                            return (
                              <div key={idx} className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                <span>
                                  {ti.name} 
                                  {ti.cost_type === 'Percentage' ? ` (${ti.value}%)` : ''}
                                  {ti.cost_type === 'Per Unit' ? ` (LKR ${ti.value} x ${totalQty})` : ''}
                                </span>
                                <span>+ LKR {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-dashed flex justify-between items-center">
                  <span className="text-lg font-black tracking-tight">Grand Total</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary tracking-tighter">
                      LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Inclusive of all taxes</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-4 rounded-b-xl">
                <div className="flex items-start gap-2 text-[10px] text-muted-foreground italic leading-tight">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  Prices are based on current inventory and are valid until the expiry date specified.
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

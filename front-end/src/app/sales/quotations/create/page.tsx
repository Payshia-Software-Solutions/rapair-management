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
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SectionCard, LoadingState } from "@/components/page-shell";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ChevronLeft, Loader2 } from "lucide-react";
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
  const [defaultTaxIds, setDefaultTaxIds] = useState<string[]>([]);
  const [showAllTaxes, setShowAllTaxes] = useState(false);
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
              setDefaultTaxIds(ids.map(id => id.toString()));
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

  const companyTaxIds = new Set(defaultTaxIds);
  // Company taxes first; the rest only when asked for (master data holds other countries' taxes too).
  const visibleTaxes = showAllTaxes
    ? taxes
    : taxes.filter((t) => companyTaxIds.has(t.id.toString()) || selectedTaxIds.includes(t.id.toString()));
  const hiddenTaxCount = taxes.length - visibleTaxes.length;

  const filledItems = items.filter((it) => String(it.description || "").trim() || it.item_id);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Choose a customer", description: "Pick who this quotation is for.", variant: "destructive" });
      return;
    }
    if (filledItems.length === 0) {
      toast({ title: "Add an item", description: "A quotation needs at least one line.", variant: "destructive" });
      return;
    }
    const bad = filledItems.findIndex((it) => !(Number(it.quantity) > 0));
    if (bad >= 0) {
      toast({ title: "Check the quantities", description: `Line ${bad + 1} needs a quantity above 0.`, variant: "destructive" });
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
        items: filledItems,
        taxes: appliedTaxes,
        is_international: isInternational ? 1 : 0,
        shipping_provider_id: isInternational ? shippingProviderId : null,
        shipping_costing_template_id: isInternational && selectedTemplateId !== "none" ? selectedTemplateId : null,
        shipping_cost: isInternational ? shippingCost : 0,
        shipping_country: isInternational ? shippingCountry : null,
        shipping_address: isInternational ? shippingAddress : null
      };

      const res = await createQuotation(payload);
      toast({ title: "Quotation saved", description: "You can print or send it from the next screen." });
      router.push(`/sales/quotations/${res.data.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't save the quotation", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const money = (n: number) => `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const partOptions = parts.map((p) => ({ value: p.id.toString(), label: `${p.part_name} · LKR ${Number(p.price || 0).toLocaleString()}`, keywords: `${p.part_name} ${p.part_number || ""} ${p.sku || ""}` }));
  const customerOptions = customers.map((c) => ({ value: c.id.toString(), label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}`, keywords: `${c.name} ${c.phone || ""} ${c.email || ""}` }));
  const carrierBase = Number(shippingProviders.find((p) => p.id.toString() === shippingProviderId)?.base_cost || 0);
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  if (loading) {
    return <DashboardLayout title="New Quotation"><Card><LoadingState /></Card></DashboardLayout>;
  }

  return (
    <DashboardLayout title="New Quotation">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Back to quotations"><Link href="/sales/quotations"><ChevronLeft className="h-5 w-5" /></Link></Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
              <p className="text-sm text-muted-foreground">Price estimate for a customer, valid until the expiry date.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/sales/quotations">Cancel</Link></Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4 mr-2" aria-hidden="true" />}
              Save quotation
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-5">
            <SectionCard title="Customer" bodyClassName="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Customer</Label>
                <SearchableSelect value={selectedCustomerId} onValueChange={setSelectedCustomerId} options={customerOptions}
                  placeholder="Search customers by name or phone" searchPlaceholder="Name, phone or email…" emptyText="No customer found" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-issue">Issue date</Label>
                <Input id="q-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-expiry">Valid until</Label>
                <Input id="q-expiry" type="date" value={expiryDate} min={issueDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              {locations.length > 1 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Location</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Items" description="Pick from your item list, or type a description for anything else."
              action={<Button size="sm" variant="outline" onClick={handleAddItem}><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add line</Button>}>
              <div className="hidden grid-cols-[1fr_90px_130px_130px_36px] gap-3 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:grid">
                <span>Item / description</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Amount</span><span />
              </div>
              <ol className="divide-y">
                {items.map((item, index) => (
                  <li key={index} className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-[1fr_90px_130px_130px_36px] md:items-start">
                    <div className="col-span-2 space-y-2 md:col-span-1">
                      <SearchableSelect value={item.item_id?.toString() || ""} onValueChange={(val) => updateItem(index, 'item_id', val)}
                        options={partOptions} placeholder="Search items…" searchPlaceholder="Item name or code…" emptyText="No item found" />
                      <Input placeholder="Description (shown on the quotation)" value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)} aria-label={`Line ${index + 1} description`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground md:sr-only">Qty</Label>
                      <Input type="number" min={0} step="any" className="text-right tabular-nums" value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)} aria-label={`Line ${index + 1} quantity`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground md:sr-only">Unit price</Label>
                      <Input type="number" min={0} step="0.01" className="text-right tabular-nums" value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)} aria-label={`Line ${index + 1} unit price`} />
                    </div>
                    <p className="self-center text-right text-sm font-medium tabular-nums md:pt-2">{money(item.line_total)}</p>
                    <Button variant="ghost" size="icon" className="h-9 w-9 justify-self-end text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveItem(index)} aria-label={`Remove line ${index + 1}`} disabled={items.length === 1 && !item.description && !item.item_id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ol>
              <div className="border-t p-3">
                <Button variant="ghost" size="sm" onClick={handleAddItem}><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add another line</Button>
              </div>
            </SectionCard>

            <SectionCard title="Terms & notes" description="Printed at the bottom of the quotation." bodyClassName="p-4">
              <Textarea rows={4} placeholder="Payment terms, delivery time, warranty…" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Terms and notes" />
            </SectionCard>

            <SectionCard title="International delivery" description="Add a carrier and shipping cost for overseas customers."
              action={<Switch checked={isInternational} onCheckedChange={setIsInternational} aria-label="International delivery" />}
              bodyClassName={isInternational ? "grid grid-cols-1 gap-4 p-4 sm:grid-cols-2" : "hidden"}>
              <div className="space-y-1.5">
                <Label>Carrier</Label>
                <Select value={shippingProviderId} onValueChange={handleProviderChange}>
                  <SelectTrigger><SelectValue placeholder="Select carrier" /></SelectTrigger>
                  <SelectContent>{shippingProviders.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name} · base {money(p.base_cost)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Costing template</Label>
                <Select value={selectedTemplateId || "none"} onValueChange={handleTemplateChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (carrier base cost only)</SelectItem>
                    {costingTemplates.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-ship-cost">Shipping cost (LKR)</Label>
                <Input id="q-ship-cost" type="number" min={0} step="0.01" className="tabular-nums" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-country">Country</Label>
                <Input id="q-country" placeholder="e.g. Maldives" value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="q-ship-addr">Delivery address</Label>
                <Textarea id="q-ship-addr" rows={2} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
              </div>
              {templateItems.length > 0 && (
                <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">How the shipping cost adds up</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Carrier base rate</span><span className="tabular-nums">{money(carrierBase)}</span></div>
                  {templateItems.map((ti, idx) => {
                    const amount = ti.cost_type === 'Fixed' ? Number(ti.value) : ti.cost_type === 'Percentage' ? carrierBase * (Number(ti.value) / 100) : ti.cost_type === 'Per Unit' ? Number(ti.value) * totalQty : 0;
                    return (
                      <div key={idx} className="flex justify-between">
                        <span className="text-muted-foreground">{ti.name}{ti.cost_type === 'Percentage' ? ` (${ti.value}%)` : ''}{ti.cost_type === 'Per Unit' ? ` (LKR ${ti.value} × ${totalQty})` : ''}</span>
                        <span className="tabular-nums">{money(amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <SectionCard title="Summary">
              <div className="space-y-2 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({filledItems.length} line{filledItems.length === 1 ? "" : "s"})</span><span className="tabular-nums">{money(subtotal)}</span></div>
                {appliedTaxes.map((at, idx) => (
                  <div key={idx} className="flex justify-between"><span className="text-muted-foreground">{at.name} ({Number(at.rate_percent)}%)</span><span className="tabular-nums">{money(at.amount)}</span></div>
                ))}
                {isInternational && <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="tabular-nums">{money(shippingCost)}</span></div>}
                <div className="flex items-baseline justify-between border-t pt-3">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-semibold tabular-nums">{money(grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-2 border-t p-4">
                <p className="text-xs font-medium text-muted-foreground">Taxes on this quotation</p>
                {visibleTaxes.length === 0 ? <p className="text-sm text-muted-foreground">No taxes set up for the company.</p> : (
                  <div className="grid gap-1.5">
                    {visibleTaxes.map((t) => {
                      const on = selectedTaxIds.includes(t.id.toString());
                      return (
                        <label key={t.id} htmlFor={`tax-${t.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox id={`tax-${t.id}`} checked={on}
                            onCheckedChange={(checked) => setSelectedTaxIds(checked ? [...selectedTaxIds, t.id.toString()] : selectedTaxIds.filter((id) => id !== t.id.toString()))} />
                          <span className="flex-1">{t.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{Number(t.rate_percent)}%</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {(hiddenTaxCount > 0 || showAllTaxes) && (
                  <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => setShowAllTaxes((v) => !v)}>
                    {showAllTaxes ? "Show company taxes only" : `Show ${hiddenTaxCount} other tax${hiddenTaxCount === 1 ? "" : "es"}`}
                  </Button>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

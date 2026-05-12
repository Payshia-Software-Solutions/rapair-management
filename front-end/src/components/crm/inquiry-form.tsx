"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  fetchInquirySources, 
  fetchInquiryTypes, 
  fetchCustomers,
  fetchEmployees,
  fetchParts,
  Inquiry
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Phone, Mail, FileText, Info, CheckCircle2, MapPin, Plus, Trash2, Package, Globe, Calendar, Home, Wrench, Settings, Share2, Users, Award, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface InquiryFormProps {
  initialData?: Partial<Inquiry>;
  onSuccess: (data: any) => void;
  onCancel: () => void;
}

export function InquiryForm({ initialData, onSuccess, onCancel }: InquiryFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const [formData, setFormData] = useState({
    customer_name: initialData?.customer_name || "",
    customer_id: initialData?.customer_id || null,
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    source: initialData?.source || "Direct",
    inquiry_type: initialData?.inquiry_type || "General",
    status: initialData?.status || "New",
    assigned_to: initialData?.assigned_to || null,
    requirements: initialData?.requirements || "",
    notes: initialData?.notes || "",
    items: (initialData as any)?.items || []
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sRes, tRes, cRes, eRes, iRes] = await Promise.all([
          fetchInquirySources(),
          fetchInquiryTypes(),
          fetchCustomers(),
          fetchEmployees(),
          fetchParts()
        ]);
        console.log("Form data loaded:", { sRes, tRes, cRes, eRes, iRes });
        setSources(Array.isArray(sRes) ? sRes : []);
        setTypes(Array.isArray(tRes) ? tRes : []);
        setCustomers(Array.isArray(cRes) ? cRes : []);
        setEmployees(Array.isArray(eRes) ? eRes : []);
        setMasterItems(Array.isArray(iRes) ? iRes : []);
      } catch (err: any) {
        console.error("Failed to load form data", err);
        toast({ 
          title: "Data Loading Error", 
          description: err.message || "Failed to load form dropdowns. Check console for details.", 
          variant: "destructive" 
        });
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name) {
      toast({ title: "Error", description: "Customer name is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      onSuccess(formData);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save inquiry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (val: string) => {
    if (val === "none") {
      setFormData({ ...formData, customer_id: null });
      return;
    }
    const customer = customers.find(c => c.id.toString() === val);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customer.id,
        customer_name: customer.name,
        phone: customer.phone || formData.phone,
        email: customer.email || formData.email
      });
    }
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: null, description: "", quantity: 1, unit_price: 0 }]
    });
  };

  const removeItemRow = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === 'item_id') {
      if (value === "none") {
        newItems[index] = { ...newItems[index], item_id: null };
      } else {
        const item = masterItems.find(i => i.id.toString() === value);
        if (item) {
          newItems[index] = { 
            ...newItems[index], 
            item_id: item.id, 
            description: item.name || item.part_name, 
            unit_price: item.price || item.unit_price || 0 
          };
        }
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setFormData({ ...formData, items: newItems });
  };

  const statusOptions = ["New", "Contacted", "Qualified", "Converted", "Lost"];
  
  const typeIcons: Record<string, any> = {
    'General': Info,
    'Export': Globe,
    'Banquet Booking': Calendar,
    'Room Booking': Home,
    'Service': Wrench,
    'Parts': Package,
    'Repair': Settings,
    'Other': FileText
  };

  const sourceIcons: Record<string, any> = {
    'Direct': User,
    'Website': Globe,
    'Social Media': Share2,
    'Referral': Users,
    'Exhibition': Award,
    'Other': Info
  };

  const filteredMasterItems = masterItems.filter(item => {
    const name = (item.part_name || item.name || "").toLowerCase();
    const sku = (item.sku || "").toLowerCase();
    const query = itemSearch.toLowerCase();
    return name.includes(query) || sku.includes(query);
  });
  const typeOptions = types.length > 0 ? types : ['General', 'Export', 'Banquet Booking', 'Room Booking', 'Service', 'Parts', 'Repair', 'Other'];
  const sourceOptions = sources.length > 0 ? sources : ['Direct', 'Website', 'Social Media', 'Referral', 'Exhibition', 'Other'];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Customer Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
            <User className="h-5 w-5" />
            <span>Customer Information</span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customer_id">Link to Existing Customer</Label>
            <Select onValueChange={handleCustomerChange} value={formData.customer_id?.toString() || "none"}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">New Lead (Unregistered)</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer/Company Name *</Label>
            <Input 
              id="customer_name" 
              value={formData.customer_name} 
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} 
              placeholder="Enter name"
              required
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                  className="pl-10 h-11"
                  placeholder="e.g. +94..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  className="pl-10 h-11"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assignment & Status Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
            <Info className="h-5 w-5" />
            <span>Lead Tracking</span>
          </div>

          <div className="space-y-3">
            <Label>Inquiry Type</Label>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((t) => {
                const Icon = typeIcons[t] || Info;
                return (
                  <Button
                    key={t}
                    type="button"
                    variant={formData.inquiry_type === t ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, inquiry_type: t })}
                    className={cn(
                      "rounded-full px-4 h-9 transition-all gap-2",
                      formData.inquiry_type === t ? "shadow-md scale-105" : "hover:bg-primary/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Status</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {statusOptions.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={formData.status === s ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, status: s as any })}
                  className={cn(
                    "h-10 text-xs font-bold uppercase tracking-wider",
                    formData.status === s ? "bg-primary" : "bg-card"
                  )}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Inquiry Source</Label>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((s) => {
                const Icon = sourceIcons[s] || Info;
                return (
                  <Button
                    key={s}
                    type="button"
                    variant={formData.source === s ? "secondary" : "ghost"}
                    onClick={() => setFormData({ ...formData, source: s })}
                    className={cn(
                      "rounded-md border h-9 gap-2",
                      formData.source === s ? "bg-secondary border-primary/50 text-primary font-semibold" : "border-transparent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {s}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="assigned_to">Assign To Staff</Label>
            <Select 
              onValueChange={(val) => setFormData({ ...formData, assigned_to: val === "none" ? null : Number(val) })} 
              value={formData.assigned_to?.toString() || "none"}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Assign Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Inquiry Items Section */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Package className="h-5 w-5" />
            <span>Inquiry Items (Optional)</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>

        {formData.items.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Link Existing Product</th>
                  <th className="px-4 py-2 text-left font-medium">Description (Manual Entry)</th>
                  <th className="px-4 py-2 text-right font-medium w-32">Qty</th>
                  <th className="px-4 py-2 text-right font-medium w-40">Est. Price</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {formData.items.map((item: any, idx: number) => (
                  <tr key={idx} className="bg-card hover:bg-muted/10">
                    <td className="px-4 py-2">
                      <Select 
                        value={item.item_id?.toString() || "none"}
                        onValueChange={(val) => handleItemChange(idx, 'item_id', val)}
                      >
                        <SelectTrigger className="h-9 border-none bg-transparent focus:ring-0">
                          <SelectValue placeholder="Search Item..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                            <Input 
                              placeholder="Search products..." 
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                              className="h-8 text-xs"
                              onKeyDown={(e) => e.stopPropagation()} // Prevent select from closing
                            />
                          </div>
                          <SelectItem value="none" className="text-muted-foreground italic font-semibold border-b">
                            Manual Entry Only
                          </SelectItem>
                          {filteredMasterItems.length > 0 ? (
                            filteredMasterItems.map(mi => (
                              <SelectItem key={mi.id} value={mi.id.toString()}>
                                <div className="flex flex-col">
                                  <span>{mi.part_name || mi.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{mi.sku || 'No SKU'}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-4 text-xs text-muted-foreground text-center">
                              {itemSearch ? "No results found" : "No products available"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        value={item.description} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="h-8 border-none bg-transparent focus:ring-0 shadow-none"
                        placeholder="Item details..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        type="number"
                        value={item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className="h-8 text-right border-none bg-transparent focus:ring-0 shadow-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        type="number"
                        value={item.unit_price} 
                        onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                        className="h-8 text-right border-none bg-transparent focus:ring-0 shadow-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
            No specific items linked to this inquiry. Click "Add Item" to specify products.
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
        <div className="space-y-3">
          <Label htmlFor="requirements" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Requirements / Details
          </Label>
          <Textarea 
            id="requirements" 
            value={formData.requirements} 
            onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} 
            placeholder="Describe what the customer is looking for..."
            rows={5}
            className="resize-none focus:ring-primary shadow-inner"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="notes" className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Internal Notes (Private)
          </Label>
          <Textarea 
            id="notes" 
            value={formData.notes} 
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
            placeholder="Confidential notes for the sales team..."
            rows={5}
            className="resize-none bg-amber-50/20 dark:bg-amber-900/10 border-amber-200/50"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Auto-generating inquiry number upon save
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} className="w-24">Cancel</Button>
          <Button type="submit" disabled={loading} className="w-40 h-11 text-lg font-semibold">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            {initialData?.id ? "Update Lead" : "Save Lead"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// Add this to your lucide icons import if not present
function PlusCircle({ className, ...props }: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

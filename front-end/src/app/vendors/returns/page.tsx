"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchSupplierReturns, postPurchaseReturn, fetchSuppliers, fetchParts, fetchSupplier } from "@/lib/api";
import { calculateTaxes } from "@/lib/tax-calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, ArrowLeftRight, Plus, Loader2, Calendar, Trash2, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SupplierReturnsPage() {
  const { toast } = useToast();
  const [returns, setReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // New Return State
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newReturn, setNewReturn] = useState({
    supplier_id: "",
    return_date: new Date().toISOString().split('T')[0],
    reason: "",
    items: [] as any[]
  });
  const [supplierTaxes, setSupplierTaxes] = useState<any[]>([]);

  useEffect(() => {
    if (!newReturn.supplier_id) {
      setSupplierTaxes([]);
      return;
    }
    void (async () => {
      try {
        const s = await fetchSupplier(newReturn.supplier_id);
        setSupplierTaxes((s as any)?.taxes || []);
      } catch {
        setSupplierTaxes([]);
      }
    })();
  }, [newReturn.supplier_id]);

  const load = async () => {
    setLoading(true);
    try {
      const [rData, sData, pData] = await Promise.all([
        fetchSupplierReturns({ from_date: fromDate || undefined, to_date: toDate || undefined }),
        fetchSuppliers(),
        fetchParts()
      ]);
      setReturns(rData);
      setSuppliers(sData);
      setParts(pData);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [fromDate, toDate]);

  const filtered = returns.filter(r =>
    !search ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = () => {
    setNewReturn({
      ...newReturn,
      items: [...newReturn.items, { part_id: "", quantity: 1, unit_cost: 0, line_total: 0 }]
    });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...newReturn.items];
    updated[idx][field] = value;
    
    if (field === 'part_id') {
      const part = parts.find(p => p.id.toString() === value);
      if (part) updated[idx].unit_cost = Number(part.avg_cost_price || part.cost_price || 0);
    }
    
    updated[idx].line_total = Number(updated[idx].quantity) * Number(updated[idx].unit_cost);
    setNewReturn({ ...newReturn, items: updated });
  };

  const removeItem = (idx: number) => {
    setNewReturn({ ...newReturn, items: newReturn.items.filter((_, i) => i !== idx) });
  };

  const subtotal = newReturn.items.reduce((sum, i) => sum + i.line_total, 0);
  const taxCalc = calculateTaxes(subtotal, supplierTaxes);

  const handleSave = async () => {
    if (!newReturn.supplier_id || newReturn.items.length === 0) {
      toast({ title: "Validation", description: "Supplier and at least one item are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const tokenJson = (() => {
        try {
          const t = localStorage.getItem('auth_token');
          if (!t) return null;
          return JSON.parse(atob(t.split('.')[1]));
        } catch { return null; }
      })();

      await postPurchaseReturn({ 
        ...newReturn, 
        total_amount: taxCalc.grandTotal,
        subtotal: taxCalc.base,
        tax_total: taxCalc.totalTax,
        userId: tokenJson?.userId || 1
      });
      toast({ title: "Success", description: "Supplier return recorded successfully" });
      setOpen(false);
      setNewReturn({
        supplier_id: "",
        return_date: new Date().toISOString().split('T')[0],
        reason: "",
        items: []
      });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Supplier Returns</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage purchase returns and stock reversals</p>
          </div>
          <Button onClick={() => setOpen(true)} className="font-bold">
            <Plus className="w-4 h-4 mr-2" /> New Return
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by supplier or reason..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input type="date" className="w-38" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-muted-foreground">to</span>
                <Input type="date" className="w-38" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <ArrowLeftRight className="w-10 h-10 opacity-30" />
                <p className="text-sm">No returns record found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Supplier</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Items</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reason</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.return_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 font-bold text-primary">{r.supplier_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-mono">{r.item_count} items</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs italic">{r.reason || 'No reason provided'}</td>
                      <td className="px-4 py-3 text-right font-black tabular-nums">{Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Return Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New Supplier Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={newReturn.supplier_id} onValueChange={v => setNewReturn({...newReturn, supplier_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Return Date</Label>
                <Input type="date" value={newReturn.return_date} onChange={e => setNewReturn({...newReturn, return_date: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for Return</Label>
              <Input value={newReturn.reason} onChange={e => setNewReturn({...newReturn, reason: e.target.value})} placeholder="e.g. Damaged items, Wrong delivery..." />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-1">
                <Label className="font-bold flex items-center gap-2 italic">
                  <Package className="w-4 h-4" /> Returned Items
                </Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" /> Add Part
                </Button>
              </div>
              
              {newReturn.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/20 p-2 rounded-lg border border-border/50">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-[10px] uppercase">Part / Item</Label>
                    <Select value={item.part_id} onValueChange={v => updateItem(idx, 'part_id', v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        {parts.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.stock_quantity})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase">Qty</Label>
                    <Input type="number" className="h-8" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px] uppercase">Cost</Label>
                    <Input type="number" className="h-8" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} />
                  </div>
                  <div className="col-span-2 flex justify-end pb-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {newReturn.items.length > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="text-right space-y-1">
                    <div className="flex justify-between gap-8 text-xs text-muted-foreground">
                      <span>Return Subtotal</span>
                      <span className="font-mono">LKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {taxCalc.totalTax > 0 && (
                      <div className="flex justify-between gap-8 text-xs text-muted-foreground">
                        <span>Tax Reversal</span>
                        <span className="font-mono">LKR {taxCalc.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="pt-1 border-t">
                      <div className="text-[10px] uppercase text-muted-foreground font-bold">Final Return Value</div>
                      <div className="text-2xl font-black tabular-nums">LKR {taxCalc.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Process Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

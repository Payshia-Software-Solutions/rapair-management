"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchSupplierSummary, postSupplierPayment, fetchSuppliers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ArrowUpRight,
  Wallet,
  History,
  Info,
  Check,
  Printer,
  FileText
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";

export default function ProcessPaymentPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [onAccountAmount, setOnAccountAmount] = useState<string>("0");

  const paymentAmount = Object.entries(allocations).reduce((sum, [id, val]) => {
      if (id === 'on_account') return sum;
      return sum + Number(val || 0);
  }, 0) + Number(onAccountAmount || 0);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).finally(() => setLoadingSuppliers(false));
  }, []);

  const handleSupplierChange = async (id: string) => {
    setSelectedSupplierId(id);
    setLoading(true);
    try {
      const data = await fetchSupplierSummary(id);
      setSummary(data);
      // Reset payment form
      setAllocations({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleGrn = (grn: any) => {
    const id = grn.id.toString();
    const newAlloc = { ...allocations };
    if (newAlloc[id]) {
      delete newAlloc[id];
    } else {
      const remaining = Number(grn.total_amount) - Number(grn.paid_amount) - Number(grn.returned_amount);
      newAlloc[id] = remaining.toFixed(2);
    }
    setAllocations(newAlloc);
  };

  const updateAllocAmount = (id: string, amount: string) => {
    setAllocations(prev => ({ ...prev, [id]: amount }));
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId || paymentAmount <= 0) {
      toast({ title: "Validation", description: "Supplier and a valid amount are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Prepare backend allocations
      const backendAllocations = Object.entries(allocations)
        .filter(([id]) => id !== 'on_account')
        .map(([id, amt]) => ({
          grn_id: id,
          amount: amt
        }));

      // Add on-account amount if any
      if (Number(onAccountAmount) > 0) {
        backendAllocations.push({
          grn_id: null,
          amount: onAccountAmount
        });
      }

      const res = await postSupplierPayment({
        supplier_id: selectedSupplierId,
        amount: paymentMethod === 'Advance Settlement' ? 0 : paymentAmount,
        allocations: backendAllocations,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_no: referenceNo,
        notes: notes
      });

      toast({ title: "Success", description: "Payment recorded successfully" });
      
      // Setup print options
      if (res && res.id) {
        setLastCreatedId(res.id);
        setShowPrintModal(true);
      }

      // Refresh summary
      handleSupplierChange(selectedSupplierId);
      
      // Reset form
      setAllocations({});
      setReferenceNo("");
      setNotes("");
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
            <h1 className="text-3xl font-black tracking-tight">Process Vendor Payment</h1>
            <p className="text-muted-foreground text-sm mt-1">Settle multiple delivery notes in a single settlement</p>
          </div>
          <Link href="/vendors/payments">
            <Button variant="outline"><History className="w-4 h-4 mr-2" /> View History</Button>
          </Link>
        </div>

        {/* Supplier Selection */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2">
                <Label className="font-bold text-primary">Select Supplier to Pay</Label>
                <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                  <SelectTrigger className="h-12 text-lg bg-background border-primary/30">
                    <SelectValue placeholder={loadingSuppliers ? "Loading..." : "Choose a vendor..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name} {s.phone ? `(${s.phone})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {summary && (
                <div className="flex gap-6">
                  {summary.advance_balance > 0 && (
                    <div className="text-right border-r border-primary/20 pr-6">
                      <div className="text-[10px] text-primary/60 uppercase font-black tracking-widest mb-1">Available Advance</div>
                      <div className="text-2xl font-black text-primary">
                        LKR {Number(summary.advance_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Net Payable</div>
                    <div className={summary.total_payable > 0 ? "text-2xl font-black text-destructive" : "text-2xl font-black text-green-500"}>
                      LKR {Number(summary.total_payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">Fetching financial summary...</p>
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Payable GRNs */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-none shadow-xl bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-primary" /> Outstanding GRNs
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Select one or more GRNs to allocate this payment</p>
                </CardHeader>
                <CardContent>
                  {summary.outstanding_grns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-background rounded-xl border border-dashed">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-2 opacity-50" />
                      <p className="font-bold">No outstanding GRNs found</p>
                      <p className="text-xs text-muted-foreground">All receipt notes for this supplier are fully settled.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {summary.outstanding_grns.map((grn: any) => {
                        const balance = Number(grn.total_amount) - Number(grn.paid_amount) - Number(grn.returned_amount);
                        const isSelected = !!allocations[grn.id.toString()];
                        return (
                          <div 
                            key={grn.id} 
                            className={`p-4 rounded-xl border-2 transition-all group flex items-start gap-4 ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-background hover:border-primary/30'}`}
                            onClick={() => toggleGrn(grn)}
                          >
                            <div className="pt-1">
                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-black text-lg">#{grn.grn_number}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Received on {new Date(grn.received_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-muted-foreground uppercase opacity-70">Due Balance</div>
                                    <div className="font-mono font-bold text-lg">
                                    LKR {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                </div>
                                
                                {isSelected && (
                                    <div className="mt-3 p-3 bg-primary/10 rounded-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                                        <Label className="text-[10px] uppercase font-bold text-primary shrink-0">Paying This GRN:</Label>
                                        <Input 
                                            type="number" 
                                            className="h-9 bg-background border-primary/20 font-bold"
                                            value={allocations[grn.id.toString()]}
                                            max={balance}
                                            onChange={e => updateAllocAmount(grn.id.toString(), e.target.value)}
                                        />
                                    </div>
                                )}
                                
                                <div className="mt-2 flex items-center gap-4 text-[10px] font-bold text-muted-foreground/60 uppercase">
                                    <span>Total: {Number(grn.total_amount).toLocaleString()}</span>
                                    <span className="text-green-600/60">Paid: {Number(grn.paid_amount).toLocaleString()}</span>
                                    {Number(grn.returned_amount) > 0 && <span className="text-orange-500/60">Returns: {Number(grn.returned_amount).toLocaleString()}</span>}
                                </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-dashed border-2 bg-transparent">
                  <CardContent className="py-8 flex flex-col items-center text-center gap-2">
                      <div className="bg-primary/10 p-3 rounded-full">
                          <AlertCircle className="w-6 h-6 text-primary opacity-50" />
                      </div>
                      <p className="text-sm font-bold opacity-70">On-Account Payments</p>
                      <p className="text-xs text-muted-foreground max-w-xs">If you want to make a payment without allocating to a GRN, skip the selection and enter the amount directly on the right.</p>
                  </CardContent>
              </Card>
            </div>
 
            {/* Right Column: Payment Form */}
            <div className="lg:col-span-5">
              <Card className="sticky top-6 border-none shadow-2xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-black/10 rounded-full blur-xl" />
 
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Wallet className="w-6 h-6" /> Payment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 text-white">
                  <div className="space-y-1.5">
                    <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">Allocation Strategy</Label>
                    <div className="p-3 bg-white/10 rounded-lg border border-white/20 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                            {Object.keys(allocations).length === 0 ? "General / On-Account" : `${Object.keys(allocations).length} GRNs Selected`}
                        </span>
                        {Object.keys(allocations).length > 0 && (
                            <button onClick={() => setAllocations({})} className="text-[10px] underline hover:text-white">Clear All</button>
                        )}
                      </div>
                      <p className="text-[10px] text-white/50">{Object.keys(allocations).length > 0 ? "Funds will be distributed to specific invoices." : "Funds will be added to supplier balance as credit."}</p>
                    </div>
                  </div>
 
                  <div className="space-y-1.5">
                    <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">On-Account / Advance Amount (LKR)</Label>
                    <Input 
                      type="number" 
                      className="h-10 font-bold bg-white/20 border-white/30 text-white placeholder:text-white/40 focus:ring-white/50" 
                      placeholder="0.00"
                      value={onAccountAmount}
                      onChange={e => setOnAccountAmount(e.target.value)}
                    />
                    <p className="text-[10px] text-white/40 italic">Additional amount to be kept as supplier credit.</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">Total Payment Amount (LKR)</Label>
                    <div className="h-14 text-3xl font-black flex items-center">
                        {paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-[10px] text-white/40 italic">Allocated to GRNs + Advance Amount.</p>
                  </div>
 
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">Date</Label>
                      <Input 
                        type="date" 
                        className="bg-white/20 border-white/30 text-white h-10" 
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">Method</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-white/30 bg-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                      >
                        <option className="bg-primary text-white" value="Bank Transfer">Bank Transfer</option>
                        <option className="bg-primary text-white" value="Cash">Cash</option>
                        <option className="bg-primary text-white" value="Cheque">Cheque</option>
                        <option className="bg-primary text-white" value="TT">TT (Telegraphic Transfer)</option>
                        <option className="bg-primary text-white" value="Advance Settlement">Advance Settlement (Link existing credits)</option>
                        <option className="bg-primary text-white" value="Card">Card</option>
                      </select>
                    </div>
                  </div>
 
                  <div className="space-y-1.5">
                    <Label className="text-white/80 font-bold uppercase text-[10px] tracking-widest">Reference / Check #</Label>
                    <Input 
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/40" 
                      placeholder="Transaction reference..."
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                    />
                  </div>
 
                  <div className="pt-4">
                    <Button 
                      onClick={handleSubmit} 
                      disabled={saving}
                      className="w-full h-14 bg-white text-primary hover:bg-white/90 text-lg font-black shadow-xl border-none transition-all active:scale-95"
                    >
                      {saving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ArrowRight className="w-6 h-6 mr-2" />}
                      Finalize Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
            <Building2 className="w-12 h-12 mb-2 opacity-30" />
            <p className="font-medium uppercase tracking-widest text-xs">Please select a supplier to continue</p>
          </div>
        )}
      </div>
      {/* Post-Creation Print Options Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
            <div className="bg-emerald-600 p-8 text-white text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Payment Posted!</h2>
                <p className="text-emerald-50 font-medium mt-1">Vendor settlement recorded successfully.</p>
            </div>
            <div className="p-8 space-y-4">
                <p className="text-sm font-bold text-slate-500 text-center mb-4 italic">What would you like to print now?</p>
                <div className="grid grid-cols-1 gap-3">
                    <Button 
                        variant="outline" 
                        className="h-14 justify-start px-6 gap-4 border-slate-200 rounded-xl hover:bg-slate-50 text-slate-900"
                        onClick={() => {
                            window.open(`/vendors/payments/print/${lastCreatedId}?format=voucher&autoprint=1`, '_blank');
                        }}
                    >
                        <FileText className="w-5 h-5 text-primary" />
                        <div className="text-left">
                            <p className="font-black uppercase text-xs tracking-widest">Payment Voucher</p>
                            <p className="text-[10px] text-muted-foreground font-medium">Standard office copy for filing</p>
                        </div>
                    </Button>

                    {paymentMethod === 'Cheque' && (
                        <Button 
                            variant="outline" 
                            className="h-14 justify-start px-6 gap-4 border-rose-200 rounded-xl hover:bg-rose-50 text-slate-900"
                            onClick={() => {
                                window.open(`/vendors/payments/print/${lastCreatedId}?format=cheque&autoprint=1`, '_blank');
                            }}
                        >
                            <CreditCard className="w-5 h-5 text-rose-500" />
                            <div className="text-left">
                                <p className="font-black uppercase text-xs tracking-widest">Bank Cheque</p>
                                <p className="text-[10px] text-muted-foreground font-medium">Print directly on cheque leaf</p>
                            </div>
                        </Button>
                    )}

                    {paymentMethod === 'TT' && (
                        <Button 
                            variant="outline" 
                            className="h-14 justify-start px-6 gap-4 border-blue-200 rounded-xl hover:bg-blue-50 text-slate-900"
                            onClick={() => {
                                window.open(`/vendors/payments/print/${lastCreatedId}?format=tt&autoprint=1`, '_blank');
                            }}
                        >
                            <ArrowUpRight className="w-5 h-5 text-blue-500" />
                            <div className="text-left">
                                <p className="font-black uppercase text-xs tracking-widest">TT Instruction Letter</p>
                                <p className="text-[10px] text-muted-foreground font-medium">Bank letter for telegraphic transfer</p>
                            </div>
                        </Button>
                    )}
                </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
                <Button variant="ghost" onClick={() => setShowPrintModal(false)} className="w-full font-black uppercase text-[10px] tracking-widest">
                    Done / Close
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

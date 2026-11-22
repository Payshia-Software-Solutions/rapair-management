"use client";

import React, { useState } from "react";
import { 
  RotateCcw, 
  Banknote, 
  Loader2, 
  Check, 
  Printer, 
  Minus, 
  Plus, 
  Search, 
  Receipt, 
  AlertCircle, 
  ShieldCheck,
  History,
  Trash2,
  FileText,
  HelpCircle,
  Keyboard,
  MousePointer2,
  Zap,
  ArrowRight,
  LayoutGrid,
  Building2,
  Store,
  Calculator
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePOS } from "../../context/POSContext";
import { PosDialogHeader } from "./PosDialogHeader";
import { 
  fetchInvoiceForReturn, 
  fetchReturnDetails, 
  fetchPosDayLedger,
  fetchInvoices,
  addInvoicePayment, 
  addBulkInvoicePayments,
  api as apiHelper 
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { printPage } from "@/lib/api/silent-print";

/** POS documents go through the one print path: silent to the receipt printer, browser window only as fallback. */
const printPosDoc = async (url: string, name: string, toast?: (t: any) => void) => {
  const r = await printPage(url, 'Receipt', name);
  if (r.error && toast) toast({ title: 'Opened in browser', description: r.error, variant: 'destructive' });
};

import { ReservationSelectionDialog } from "./ReservationSelectionDialog";

export const ManagementModals: React.FC = () => {
  const { toast } = useToast();
  const {
    returnDialogOpen, setReturnDialogOpen,
    refundDialogOpen, setRefundDialogOpen,
    ledgerDialogOpen, setLedgerDialogOpen,
    guideModalOpen, setGuideModalOpen,
    dayLedger, setDayLedger,
    loadingLedger, setLoadingLedger,
    selectedLocation,
    inventory, customers: posCustomers,
    vKeyboardEnabled, setVKeyboardActiveInput,
    pendingInvoicesDialogOpen, setPendingInvoicesDialogOpen,
    banks, bankBranches, setBankBranches
  } = usePOS();

  // --- Returns States ---
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchingReturn, setSearchingReturn] = useState(false);
  const [returnInvoiceData, setReturnInvoiceData] = useState<any>(null);
  const [returnCart, setReturnCart] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [newReturnNo, setNewReturnNo] = useState<string | null>(null);
  const [newReturnId, setNewReturnId] = useState<number | null>(null);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // --- Manual Return States ---
  const [isManualReturn, setIsManualReturn] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedManualCustomer, setSelectedManualCustomer] = useState<any>(null);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [partResults, setPartResults] = useState<any[]>([]);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // --- Refunds States ---
  const [searchReturnNo, setSearchReturnNo] = useState("");
  const [searchingRefund, setSearchingRefund] = useState(false);
  const [refundReturnData, setRefundReturnData] = useState<any>(null);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<'Cash' | 'Bank Transfer'>('Cash');
  const [newRefundId, setNewRefundId] = useState<number | null>(null);
  const [newRefundNo, setNewRefundNo] = useState<string | null>(null);
  
  // --- Pending Invoices States ---
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [searchInvoice, setSearchInvoice] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Cheque' | 'Bank Transfer'>('Cash');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedCustomerForPending, setSelectedCustomerForPending] = useState<any>(null);
  const [activeTabMobile, setActiveTabMobile] = useState<'list' | 'checkout'>('list');

  const customerGroups = React.useMemo(() => {
     const groups: Record<string, { id: string | number, name: string, totalBalance: number, count: number, invoices: any[] }> = {};
     pendingInvoices.forEach(inv => {
        const key = inv.customer_id || "walk-in";
        const name = inv.customer_name || "Walk-in Customer";
        const bal = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount);
        if (bal <= 0) return;
        if (!groups[key]) {
           groups[key] = { id: key, name, totalBalance: 0, count: 0, invoices: [] };
        }
        groups[key].totalBalance += bal;
        groups[key].count += 1;
        groups[key].invoices.push(inv);
     });
     return Object.values(groups).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [pendingInvoices]);
  
  // Cheque Specifics
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeBranchId, setChequeBranchId] = useState("");
  const refreshPendingInvoices = async () => {
    setLoadingPending(true);
    try {
      const [unpaid, partial] = await Promise.all([
        fetchInvoices({ status: 'Unpaid' }),
        fetchInvoices({ status: 'Partial' })
      ]);
      setPendingInvoices([...unpaid, ...partial].sort((a, b) => b.id - a.id));
    } catch (err) {
      console.error("fetchInvoices error:", err);
      toast({ title: "Fetch Error", description: "Could not load pending invoices.", variant: "destructive" });
    } finally {
      setLoadingPending(false);
    }
  };

  React.useEffect(() => {
    if (pendingInvoicesDialogOpen) {
      refreshPendingInvoices();
    }
  }, [pendingInvoicesDialogOpen]);

  // Fetch branches when bank changes
  React.useEffect(() => {
    const loadBranches = async () => {
      if (chequeBank) {
        try {
          const { fetchBankBranches } = await import("@/lib/api");
          const branches = await fetchBankBranches(chequeBank);
          setBankBranches(branches);
        } catch (err) {
          console.error("Failed to load branches", err);
        }
      } else {
        setBankBranches([]);
      }
    };
    loadBranches();
  }, [chequeBank]);


  return (
    <>
      {/* 1. POS GUIDE MODAL */}
      <Dialog open={guideModalOpen} onOpenChange={setGuideModalOpen}>
        <DialogContent size="sm" className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-md"><HelpCircle className="w-6 h-6 text-white" /></div>
              POS Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border border-white/10 italic text-blue-200">
                <Zap className="w-5 h-5 mt-1 shrink-0" />
                <p className="text-sm">Power user tip: Use the numeric keypad and Enter key for the fastest retail checkout experience.</p>
             </div>
             <div className="grid gap-4">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-white/10 rounded-lg"><Keyboard className="w-5 h-5" /></div>
                   <div>
                      <p className="font-bold text-sm">Keyboard Shortcuts</p>
                      <p className="text-xs text-slate-400">Numeric keys for Qty/Payment, Enter to Process.</p>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-white/10 rounded-lg"><MousePointer2 className="w-5 h-5" /></div>
                   <div>
                      <p className="font-bold text-sm">Touch Friendly</p>
                      <p className="text-xs text-slate-400">Large buttons designed for POS terminals.</p>
                   </div>
                </div>
             </div>
          </div>
          <Button className="w-full h-11" onClick={() => setGuideModalOpen(false)}>Got it!</Button>
        </DialogContent>
      </Dialog>

      {/* 2. PENDING INVOICES DIALOG */}
      <Dialog open={pendingInvoicesDialogOpen} onOpenChange={(open) => {
          setPendingInvoicesDialogOpen(open);
          if(!open) {
              setSelectedInvoices([]);
              setAllocations({});
              setSearchInvoice("");
              setPaymentAmount("");
              setPaymentMethod('Cash');
              setChequeNo("");
              setChequeBank("");
              setChequeBranchId("");
              setSelectedCustomerForPending(null);
              setActiveTabMobile('list');
          }
      }}>
        <DialogContent size="lg" className="sm:h-[min(760px,calc(100dvh-2rem))] p-0 overflow-hidden sm:rounded-lg flex flex-col">
          <PosDialogHeader
            title="Pending invoices"
            description="Collect payments against unpaid or part-paid customer invoices."
          />

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white dark:bg-slate-950">
             {/* Left Panel: List & Search */}
             <div className={`w-full md:w-[350px] border-r border-slate-100 dark:border-slate-800 flex flex-col flex-1 md:flex-none overflow-hidden ${activeTabMobile === 'checkout' ? 'hidden md:flex' : 'flex'}`}>
                {selectedCustomerForPending === null ? (
                   <>
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="Search customer name..." 
                              value={searchInvoice}
                              onChange={e => setSearchInvoice(e.target.value)}
                              className="h-10 pl-9 bg-slate-50 dark:bg-slate-900 border-none rounded-md text-sm"
                            />
                         </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                         {loadingPending ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                               <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                               <p className="text-sm font-medium">Loading...</p>
                            </div>
                         ) : (
                            customerGroups
                              .filter(g => !searchInvoice || g.name.toLowerCase().includes(searchInvoice.toLowerCase()))
                              .map(g => (
                                 <button 
                                   key={g.id}
                                   onClick={() => {
                                      setSelectedCustomerForPending(g);
                                      setSelectedInvoices([]);
                                      setAllocations({});
                                      setPaymentAmount("");
                                   }}
                                   className="w-full p-3.5 rounded-md text-left transition-all border border-slate-100/60 dark:border-slate-800/40 bg-white dark:bg-slate-950 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 flex justify-between items-center shadow-sm"
                                 >
                                    <div>
                                       <span className="text-xs font-black tracking-tight text-slate-800 dark:text-slate-200">{g.name}</span>
                                       <p className="text-[9px] font-bold text-muted-foreground mt-0.5">{g.count} pending bill{g.count > 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="text-right">
                                       <span className="text-xs font-black text-rose-600">LKR {g.totalBalance.toLocaleString()}</span>
                                    </div>
                                 </button>
                              ))
                         )}
                         {customerGroups.length === 0 && !loadingPending && (
                            <div className="py-20 text-center text-muted-foreground opacity-30">
                               <Receipt className="w-12 h-12 mx-auto mb-4" />
                               <p className="text-xs font-semibold">No outstanding balances</p>
                            </div>
                         )}
                      </div>
                   </>
                ) : (
                   <>
                      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/30">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                              setSelectedCustomerForPending(null);
                              setSelectedInvoices([]);
                              setAllocations({});
                              setPaymentAmount("");
                           }}
                           className="text-[10px] font-bold uppercase tracking-tight gap-1 px-2 h-8"
                         >
                            ← Back
                         </Button>
                         <span className="text-xs font-medium text-slate-500 truncate max-w-[120px]">
                            {selectedCustomerForPending.name}
                         </span>
                         {selectedCustomerForPending.invoices.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[9px] uppercase font-bold shrink-0 h-8 rounded-lg px-2"
                              onClick={() => {
                                 const customerInvs = selectedCustomerForPending.invoices;
                                 const allSelected = customerInvs.every((inv: any) => selectedInvoices.some(i => i.id === inv.id));
                                 if (allSelected) {
                                    setSelectedInvoices(prev => prev.filter(p => !customerInvs.some((f: any) => f.id === p.id)));
                                    setAllocations(prev => {
                                       const next = { ...prev };
                                       customerInvs.forEach((f: any) => delete next[f.id]);
                                       return next;
                                    });
                                    setPaymentAmount("");
                                 } else {
                                    setSelectedInvoices(prev => {
                                       const next = [...prev];
                                       customerInvs.forEach((f: any) => {
                                          if (!next.some(n => n.id === f.id)) next.push(f);
                                       });
                                       return next;
                                    });
                                    setAllocations(prev => {
                                       const next = { ...prev };
                                       let total = 0;
                                       customerInvs.forEach((f: any) => {
                                          const maxBal = parseFloat(f.grand_total) - parseFloat(f.paid_amount);
                                          next[f.id] = String(maxBal.toFixed(2));
                                       });
                                       Object.values(next).forEach(v => total += parseFloat(v as string) || 0);
                                       setPaymentAmount(String(total.toFixed(2)));
                                       return next;
                                    });
                                 }
                              }}
                            >
                               All
                            </Button>
                         )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                         {selectedCustomerForPending.invoices.map((inv: any) => {
                            const isSelected = selectedInvoices.some(i => i.id === inv.id);
                            const maxBal = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount);
                            return (
                               <button 
                                 key={inv.id}
                                 onClick={() => {
                                    let newSelected: any[];
                                    if (isSelected) {
                                       newSelected = selectedInvoices.filter(i => i.id !== inv.id);
                                    } else {
                                       newSelected = [...selectedInvoices, inv];
                                    }
                                    setSelectedInvoices(newSelected);
                                    
                                    const newAllocations = { ...allocations };
                                    if (isSelected) {
                                       delete newAllocations[inv.id];
                                    } else {
                                       newAllocations[inv.id] = String(maxBal.toFixed(2));
                                    }
                                    setAllocations(newAllocations);
                                    
                                    let totalAlloc = 0;
                                    Object.values(newAllocations).forEach(v => {
                                       totalAlloc += parseFloat(v as string) || 0;
                                    });
                                    setPaymentAmount(String(totalAlloc.toFixed(2)));
                                 }}
                                 className={`w-full p-3 rounded-md text-left transition-all border flex gap-3 items-center ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white dark:bg-slate-950 border-transparent hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                               >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white'}`}>
                                     {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <div className="flex justify-between items-start mb-0.5">
                                        <span className="text-xs font-mono font-bold tracking-tight">{inv.invoice_no}</span>
                                        <Badge variant="outline" className={`text-[7px] tracking-widest uppercase h-4 px-1 ${inv.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{inv.status}</Badge>
                                     </div>
                                     <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wide mt-0.5">{inv.issue_date}</p>
                                     <div className="flex justify-between items-end mt-1.5">
                                        <div className="text-[8px] font-semibolder text-muted-foreground">Balance</div>
                                        <div className="text-xs font-black text-indigo-600">LKR {maxBal.toLocaleString()}</div>
                                     </div>
                                  </div>
                               </button>
                            );
                         })}
                      </div>
                   </>
                )}
                {selectedInvoices.length > 0 && (
                   <div className="p-3 border-t bg-white dark:bg-slate-950 md:hidden shrink-0">
                      <Button 
                         className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-tight text-xs rounded-md"
                         onClick={() => setActiveTabMobile('checkout')}
                      >
                         Settle Invoices ({selectedInvoices.length}) →
                      </Button>
                   </div>
                )}
             </div>

             {/* Right Panel: Payment Form */}
             <div className={`flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-6 overflow-y-auto custom-scrollbar ${activeTabMobile === 'list' ? 'hidden md:block' : 'block'}`}>
                {selectedInvoices.length > 0 ? (
                   <div className="space-y-6">
                      <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTabMobile('list')}
                          className="md:hidden text-xs font-bold uppercase tracking-tight gap-1 h-8 px-2"
                       >
                          ← Back to Invoices
                       </Button>
                      <div className="p-5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm space-y-4">
                         <div>
                            <p className="text-sm font-medium">Receiving Payment For</p>
                            <p className="text-lg font-black">{selectedInvoices.length} Selected Invoices</p>
                         </div>
                         
                         <div className="border border-slate-100 dark:border-slate-800 rounded-md p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-3 max-h-[160px] overflow-y-auto custom-scrollbar">
                            {selectedInvoices.map(inv => {
                               const maxBal = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount);
                               return (
                                  <div key={inv.id} className="flex justify-between items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                     <div className="text-left">
                                        <span className="font-mono text-xs font-bold">{inv.invoice_no}</span>
                                        <span className="text-[9px] text-muted-foreground ml-2">(Max: LKR {maxBal.toLocaleString()})</span>
                                     </div>
                                     <Input 
                                        type="number"
                                        step="0.01"
                                        className="w-28 h-8 font-bold text-right text-xs"
                                        value={allocations[inv.id] || ""}
                                        onChange={e => {
                                           const val = e.target.value;
                                           const newAllocations = { ...allocations, [inv.id]: val };
                                           setAllocations(newAllocations);
                                           
                                           let totalAlloc = 0;
                                           Object.values(newAllocations).forEach(v => {
                                              totalAlloc += parseFloat(v as string) || 0;
                                           });
                                           setPaymentAmount(String(totalAlloc.toFixed(2)));
                                        }}
                                     />
                                  </div>
                               );
                            })}
                         </div>

                         <div className="pt-2 flex justify-between items-center border-t border-slate-50 dark:border-slate-900">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Combined Balance Due</span>
                            <span className="text-lg font-black text-rose-600">LKR {selectedInvoices.reduce((acc, curr) => acc + (parseFloat(curr.grand_total) - parseFloat(curr.paid_amount)), 0).toLocaleString()}</span>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-sm font-medium">Payment Method</label>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {(['Cash', 'Card', 'Cheque', 'Bank Transfer'] as const).map(m => (
                               <Button 
                                 key={m}
                                 variant={paymentMethod === m ? 'default' : 'outline'}
                                 className={`h-12 font-bold text-[10px] uppercase rounded-md transition-all ${paymentMethod === m ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950'}`}
                                 onClick={() => setPaymentMethod(m)}
                               >
                                  {m}
                               </Button>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-sm font-medium">Total Payment Amount</label>
                         <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">LKR</span>
                            <Input 
                               type="number"
                               readOnly
                               value={paymentAmount}
                               className="h-16 pl-14 text-2xl font-black bg-slate-50 dark:bg-slate-900 cursor-not-allowed border-2 border-indigo-100 dark:border-indigo-900 rounded-lg shadow-inner focus-visible:ring-indigo-500 text-indigo-600"
                            />
                         </div>
                      </div>

                      {paymentMethod === 'Cheque' && (
                         <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg space-y-4 animate-in fade-in zoom-in-95">
                            <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                               <Receipt className="w-4 h-4" /> Cheque Documentation
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase">Cheque #</label>
                                  <Input placeholder="XXXXXX" value={chequeNo} onChange={e => setChequeNo(e.target.value)} className="h-10 font-bold bg-white dark:bg-slate-950" />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase">Cheque Date</label>
                                  <Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className="h-10 font-bold bg-white dark:bg-slate-950" />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase">Issuing Bank</label>
                                  <SearchableSelect 
                                     options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                                     value={chequeBank}
                                     onValueChange={(val) => setChequeBank(val)}
                                     placeholder="Select Bank"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase">Branch</label>
                                  <SearchableSelect 
                                     options={bankBranches.map(br => ({ value: br.branch_name, label: br.branch_name }))}
                                     value={chequeBranchId}
                                     onValueChange={(val) => setChequeBranchId(val)}
                                     placeholder="Select Branch"
                                     disabled={!chequeBank}
                                  />
                               </div>
                            </div>
                         </div>
                      )}

                      <Button 
                        className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all rounded-lg"
                        disabled={isRecordingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                        onClick={async () => {
                           setIsRecordingPayment(true);
                           try {
                              const paymentsPayload = selectedInvoices.map(inv => ({
                                 invoice_id: inv.id,
                                 amount: parseFloat(allocations[inv.id] || "0")
                              })).filter(p => p.amount > 0);

                              if (paymentsPayload.length === 0) {
                                 throw new Error("At least one invoice must have a payment amount allocated.");
                              }

                              const payload = {
                                 amount: parseFloat(paymentAmount),
                                 payment_method: paymentMethod,
                                 payment_date: new Date().toISOString().split('T')[0],
                                 notes: `POS bulk payment for ${paymentsPayload.length} invoices`,
                                 cheque: paymentMethod === 'Cheque' ? {
                                    cheque_no: chequeNo,
                                    cheque_date: chequeDate,
                                    bank_name: banks.find(b => String(b.id) === chequeBank)?.name || "",
                                    branch_name: chequeBranchId,
                                    payee_name: selectedInvoices[0]?.customer_name || 'Walk-in'
                                 } : null,
                                 bank_id: paymentMethod === 'Cheque' ? chequeBank : null,
                                 reference_no: paymentMethod === 'Cheque' ? chequeNo : null,
                                 payments: paymentsPayload
                              };

                              const res = await addBulkInvoicePayments(payload);
                              if (res.status === 'success') {
                                 toast({ title: "Bulk Payment Recorded", description: `LKR ${parseFloat(paymentAmount).toLocaleString()} collected successfully for ${paymentsPayload.length} invoices.` });
                                 setSelectedInvoices([]);
                                 setAllocations({});
                                 setPaymentAmount("");
                                 await refreshPendingInvoices();
                                 if (res.receipt_ids && Array.isArray(res.receipt_ids)) {
                                    res.receipt_ids.forEach((rcpId: string) => {
                                       void printPosDoc(`/cms/payment-receipts/${rcpId}/print`, `Payment receipt #${rcpId}`, toast);
                                    });
                                 }
                                 setSelectedCustomerForPending(null);
                              } else {
                                 throw new Error(res.message || "Failed to record payment");
                              }
                           } catch (err: any) {
                              toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
                           } finally {
                              setIsRecordingPayment(false);
                           }
                        }}
                      >
                         {isRecordingPayment ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <ShieldCheck className="w-5 h-5 mr-3" />}
                         Confirm & Collect Payment
                      </Button>
                   </div>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 text-center">
                      <Calculator className="w-16 h-16 mb-4" />
                      <p className="text-sm max-w-[240px]">Select one or more invoices on the left to collect a payment.</p>
                   </div>
                )}
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. RETURNS DIALOG */}
      <Dialog open={returnDialogOpen} onOpenChange={(open) => {
          setReturnDialogOpen(open);
           if(!open) {
               setReturnInvoiceData(null);
               setReturnCart([]);
               setNewReturnNo(null);
               setIsManualReturn(false);
               setSelectedManualCustomer(null);
               setCustomerSearchTerm("");
               setPartSearchTerm("");
               setVKeyboardActiveInput(null);
           }
      }}>
        <DialogContent size="lg" className="p-0 overflow-y-auto sm:rounded-lg flex flex-col">
          <PosDialogHeader
            title="Return items"
            description="Restock items from a previous sale and issue a return note."
          />

          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
             {!returnInvoiceData && !isManualReturn ? (
               <div className="space-y-4 sm:space-y-6">
                  <div className="space-y-3">
                     <div className="flex justify-between items-end px-1">
                        <label className="text-sm font-medium">Original invoice number</label>
                        <Button 
                           variant="link" 
                           className="h-auto p-0 text-sm"
                           onClick={() => setIsManualReturn(true)}
                        >
                           Manual Return (No Invoice)
                        </Button>
                     </div>
                     <div className="flex gap-2">
                        <Input 
                          placeholder="Enter Invoice Number (e.g. INV00001)" 
                          value={searchInvoiceNo}
                          onChange={e => setSearchInvoiceNo(e.target.value)}
                          onFocus={() => {
                             if (vKeyboardEnabled) {
                                setVKeyboardActiveInput({
                                   key: "Invoice Lookup",
                                   value: searchInvoiceNo,
                                   setter: (val: string) => setSearchInvoiceNo(val)
                                });
                             }
                          }}
                          className="h-11"
                          onKeyDown={async (e) => {
                             if (e.key === 'Enter' && searchInvoiceNo) {
                                setSearchingReturn(true);
                                try {
                                   const data = await fetchInvoiceForReturn(searchInvoiceNo);
                                   if (data) setReturnInvoiceData(data);
                                } catch (err: any) {
                                   toast({ title: "Not Found", description: err.message, variant: "destructive" });
                                } finally {
                                   setSearchingReturn(false);
                                }
                             }
                          }}
                        />
                        <Button 
                          className="h-11 px-5"
                          onClick={async () => {
                             if (!searchInvoiceNo) return;
                             setSearchingReturn(true);
                             try {
                                const data = await fetchInvoiceForReturn(searchInvoiceNo);
                                if (data) setReturnInvoiceData(data);
                             } catch (err: any) {
                                toast({ title: "Search Error", description: err.message, variant: "destructive" });
                             } finally {
                                setSearchingReturn(false);
                             }
                          }}
                          disabled={searchingReturn || !searchInvoiceNo}
                        >
                          {searchingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                        </Button>
                     </div>
                  </div>

                  {newReturnNo && (
                     <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center gap-4 animate-in zoom-in-95">
                        <div className="p-3 bg-emerald-600 text-white rounded-full"><Check className="w-5 h-5" /></div>
                        <div className="text-center">
                           <p className="text-xs font-semibold text-emerald-800">Return Created</p>
                           <p className="text-lg font-black text-emerald-950">No: {newReturnNo}</p>
                           <p className="text-[10px] text-emerald-700 max-w-[200px] mt-1">Stock restored. Proceed to the Refunds modal to release payment.</p>
                        </div>
                        <div className="flex gap-2 w-full">
                           <Button 
                             className="flex-1 h-11 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-[10px] rounded-md border border-slate-200 dark:border-slate-800"
                             onClick={() => void printPosDoc(`/cms/sales-returns/${newReturnId}/receipt`, `Return #${newReturnId}`, toast)}
                           >
                             <Printer className="w-4 h-4 mr-2" /> Print Note
                           </Button>
                           <Button 
                             className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] rounded-md shadow-lg shadow-rose-200 dark:shadow-rose-950/20"
                             onClick={async () => {
                                if (!newReturnNo) return;
                                setSearchReturnNo(newReturnNo);
                                setReturnDialogOpen(false);
                                setRefundDialogOpen(true);
                                
                                // Auto-trigger lookup to save the user a click
                                setSearchingRefund(true);
                                try {
                                   const data = await fetchReturnDetails(newReturnNo);
                                   if (data) setRefundReturnData(data);
                                } catch (err: any) {
                                   toast({ title: "Fetch Error", description: "Return created but could not auto-load for refund.", variant: "destructive" });
                                } finally {
                                   setSearchingRefund(false);
                                }
                             }}
                           >
                             <ArrowRight className="w-4 h-4 mr-2" /> Issue Refund
                           </Button>
                        </div>
                     </div>
                  )}
               </div>
             ) : isManualReturn && !selectedManualCustomer ? (
                <div className="space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between items-end px-1">
                         <label className="text-sm font-medium">Manual Return: Select Customer</label>
                         <Button 
                            variant="link" 
                            className="h-auto p-0 text-xs font-medium text-slate-500"
                            onClick={() => setIsManualReturn(false)}
                         >
                            Back to Invoice Lookup
                         </Button>
                      </div>
                      <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                         <Input 
                           placeholder="Search customer by name or phone..." 
                           value={customerSearchTerm}
                           onChange={e => setCustomerSearchTerm(e.target.value)}
                           onFocus={() => {
                              if (vKeyboardEnabled) {
                                 setVKeyboardActiveInput({
                                    key: "Customer Search",
                                    value: customerSearchTerm,
                                    setter: (val: string) => setCustomerSearchTerm(val)
                                 });
                              }
                           }}
                           className="h-12 pl-10 font-bold bg-white dark:bg-slate-950 rounded-md"
                         />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {posCustomers
                           .filter(c => !customerSearchTerm || c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || c.phone?.includes(customerSearchTerm))
                           .slice(0, 10)
                           .map(customer => (
                              <button 
                                key={customer.id}
                                className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-left hover:border-rose-500 transition-all flex justify-between items-center group"
                                onClick={() => setSelectedManualCustomer(customer)}
                              >
                                 <div>
                                    <p className="font-black text-sm">{customer.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">{customer.phone || "No phone"}</p>
                                 </div>
                                 <Plus className="w-4 h-4 text-rose-500 opacity-0 group-hover:opacity-100 transition-all" />
                              </button>
                           ))
                         }
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-lg">
                               {isManualReturn ? <Building2 className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                            </div>
                            <div>
                               <p className="text-sm font-medium">
                                  {isManualReturn ? "Return For Customer" : "Return From Invoice"}
                               </p>
                               <p className="text-sm font-black">
                                  {isManualReturn ? selectedManualCustomer?.name : returnInvoiceData?.invoice?.invoice_no}
                               </p>
                            </div>
                         </div>
                         <Button 
                            variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-tight text-rose-600"
                            onClick={() => {
                               if (isManualReturn) setSelectedManualCustomer(null);
                               else setReturnInvoiceData(null);
                               setReturnCart([]);
                            }}
                         >
                            Change
                         </Button>
                      </div>

                      {isManualReturn && (
                         <div className="space-y-3">
                            <label className="text-sm font-medium">Search & Add Items</label>
                            <div className="relative">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                               <Input 
                                 placeholder="Search items to return..." 
                                 value={partSearchTerm}
                                 onChange={e => setPartSearchTerm(e.target.value)}
                                 onFocus={() => {
                                    if (vKeyboardEnabled) {
                                       setVKeyboardActiveInput({
                                          key: "Item Search",
                                          value: partSearchTerm,
                                          setter: (val: string) => setPartSearchTerm(val)
                                       });
                                    }
                                 }}
                                 className="h-11 pl-10 text-xs font-bold bg-white dark:bg-slate-950 rounded-md"
                               />
                            </div>
                            {partSearchTerm && (
                               <div className="space-y-1 bg-slate-50 dark:bg-slate-900 rounded-md p-2 border border-slate-100 dark:border-slate-800 max-h-[200px] overflow-y-auto custom-scrollbar">
                                  {inventory
                                    .filter(p => p.part_name.toLowerCase().includes(partSearchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(partSearchTerm.toLowerCase()))
                                    .slice(0, 5)
                                    .map(part => (
                                       <button 
                                          key={part.id}
                                          className="w-full p-2 text-left hover:bg-white dark:hover:bg-slate-950 rounded-lg flex justify-between items-center transition-all group"
                                          onClick={() => {
                                             const existing = returnCart.find(ri => ri.item_id === part.id);
                                             if (existing) {
                                                setReturnCart(returnCart.map(ri => ri.item_id === part.id ? { ...ri, return_qty: ri.return_qty + 1 } : ri));
                                             } else {
                                                setReturnCart([...returnCart, {
                                                   id: `manual-${part.id}`,
                                                   item_id: part.id,
                                                   item_type: part.item_type === "Service" ? "Service" : "Part",
                                                   description: part.part_name,
                                                   unit_price: part.price || part.cost_price || 0,
                                                   return_qty: 1,
                                                   returned_qty: 0,
                                                   quantity: 99999 // Infinite for manual
                                                }]);
                                             }
                                             setPartSearchTerm("");
                                          }}
                                       >
                                          <div>
                                             <p className="text-xs font-bold">{part.part_name}</p>
                                             <p className="text-[10px] text-muted-foreground">SKU: {part.sku || 'N/A'} • Price: LKR {parseFloat(part.price || part.cost_price || 0).toLocaleString()}</p>
                                          </div>
                                          <Plus className="w-3 h-3 text-rose-500 opacity-0 group-hover:opacity-100" />
                                       </button>
                                    ))
                                  }
                               </div>
                            )}
                         </div>
                      )}

                      <label className="text-sm font-medium">
                         {isManualReturn ? "Items to Return" : "Step 2: Selection Items to Return"}
                      </label>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {(isManualReturn ? returnCart : returnInvoiceData?.items)?.map((item: any) => {
                            const currentInCart = isManualReturn ? item.return_qty : (returnCart.find(ri => ri.id === item.id)?.return_qty || 0);
                            const avail = isManualReturn ? 99999 : (parseFloat(item.quantity) - parseFloat(item.returned_qty));
                            const isDisabled = !isManualReturn && avail <= 0;

                            return (
                               <div key={item.id} className={`p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-md ${isDisabled ? "opacity-30 grayscale pointer-events-none" : ""}`}>
                                  <div className="flex justify-between items-start mb-2">
                                     <div>
                                        <p className="text-sm font-black">{item.description}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold">
                                           {isManualReturn ? `Manual Return` : `Bought: ${parseFloat(item.quantity).toFixed(0)} • Avail: ${Math.max(0, avail)}`} 
                                           • Price: LKR {parseFloat(item.unit_price).toLocaleString()}
                                        </p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-xs font-black text-rose-600">LKR {(currentInCart * parseFloat(item.unit_price)).toLocaleString()}</p>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                     <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                                        <Button 
                                          variant="ghost" size="icon" className="h-8 w-8 text-rose-600"
                                          onClick={() => {
                                             const searchId = isManualReturn ? item.item_id : item.id;
                                             const cartIdx = returnCart.findIndex(ri => (isManualReturn ? ri.item_id : ri.id) === searchId);
                                             if (cartIdx >= 0) {
                                                const newCart = [...returnCart];
                                                if (newCart[cartIdx].return_qty > 0) newCart[cartIdx].return_qty -= 1;
                                                if (newCart[cartIdx].return_qty === 0) newCart.splice(cartIdx, 1);
                                                setReturnCart(newCart);
                                             }
                                          }}
                                        >
                                          <Minus className="w-3 h-3" />
                                        </Button>
                                        <span className="flex-1 text-center text-xs font-black">
                                           {currentInCart}
                                        </span>
                                        <Button 
                                          variant="ghost" size="icon" className="h-8 w-8 text-rose-600"
                                          onClick={() => {
                                             const searchId = isManualReturn ? item.item_id : item.id;
                                             const cartIdx = returnCart.findIndex(ri => (isManualReturn ? ri.item_id : ri.id) === searchId);
                                             if (cartIdx >= 0) {
                                                const newCart = [...returnCart];
                                                if (newCart[cartIdx].return_qty < avail) {
                                                    newCart[cartIdx].return_qty += 1;
                                                    setReturnCart(newCart);
                                                }
                                             } else {
                                                setReturnCart([...returnCart, { ...item, return_qty: 1 }]);
                                             }
                                          }}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                        {isManualReturn && (
                                           <Button 
                                              variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 ml-auto"
                                              onClick={() => setReturnCart(returnCart.filter(ri => ri.item_id !== item.item_id))}
                                           >
                                              <Trash2 className="w-3 h-3" />
                                           </Button>
                                        )}
                                     </div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                   </div>

                  <div className="space-y-4">
                     <label className="text-sm font-medium">Return Reason</label>
                     <div className="flex flex-wrap gap-2">
                        {["Damage", "Exchange", "Mistake", "Expired"].map(r => (
                           <Button 
                             key={r}
                             variant={returnReason === r ? 'default' : 'outline'}
                             onClick={() => setReturnReason(r)}
                             className={`h-8 text-[10px] font-bold rounded-lg transition-all ${returnReason === r ? 'bg-rose-600 text-white' : ''}`}
                           >
                              {r}
                           </Button>
                        ))}
                     </div>
                     <Input 
                       placeholder="Additional notes..." 
                       value={returnReason} 
                       onChange={e => setReturnReason(e.target.value)}
                       className="h-10 text-xs font-bold"
                     />
                  </div>

                  <Button 
                    className="w-full h-14 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xl shadow-rose-200 active:scale-[0.98] transition-all rounded-md mt-2"
                    disabled={returnCart.length === 0 || isProcessingReturn}
                    onClick={async () => {
                       setIsProcessingReturn(true);
                       try {
                          const payload = {
                             invoice_id: isManualReturn ? null : returnInvoiceData.invoice.id,
                             customer_id: isManualReturn ? selectedManualCustomer.id : null,
                             total_amount: returnCart.reduce((sum, i) => sum + (i.return_qty * i.unit_price), 0),
                             reason: returnReason || "General Return",
                             location_id: selectedLocation,
                             items: returnCart.map(i => ({
                                item_id: i.item_id,
                                item_type: i.item_type,
                                description: i.description,
                                quantity: i.return_qty,
                                unit_price: i.unit_price,
                                line_total: i.return_qty * i.unit_price
                             }))
                          };

                          const res = await apiHelper('/api/salesreturn/create', { method: 'POST', body: JSON.stringify(payload) });
                          const data = await res.json();
                          if (data.status === 'success') {
                             setNewReturnNo(data.data.return_no); 
                             setNewReturnId(data.data.id);
                             setReturnInvoiceData(null);
                             setReturnCart([]);
                             setReturnReason("");
                              setIsManualReturn(false);
                              setSelectedManualCustomer(null);
                             toast({ title: "Return Saved", description: "Items have been returned to stock." });
                          } else {
                             throw new Error(data.message || "Failed to process return");
                          }
                       } catch (err: any) {
                          toast({ title: "Process Failed", description: err.message, variant: "destructive" });
                       } finally {
                          setIsProcessingReturn(false);
                       }
                    }}
                  >
                     {isProcessingReturn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                     Complete Return Process
                  </Button>
                  <Button variant="ghost" className="w-full h-10 font-bold" onClick={() => { setReturnInvoiceData(null); setIsManualReturn(false); setSelectedManualCustomer(null); setReturnCart([]); }}>
                     Cancel Selection
                  </Button>
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. REFUNDS DIALOG */}
      <Dialog open={refundDialogOpen} onOpenChange={(open) => {
          setRefundDialogOpen(open);
          if(!open) {
              setRefundReturnData(null);
              setNewRefundId(null);
              setVKeyboardActiveInput(null);
          }
      }}>
        <DialogContent size="lg" className="p-0 overflow-y-auto sm:rounded-lg flex flex-col">
          <PosDialogHeader
            title="Refund"
            description="Pay back cash or bank transfer for a completed return."
          />

          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
              {!refundReturnData ? (
                 <div className="space-y-4 sm:space-y-6">
                   <div className="space-y-3">
                      <label className="text-sm font-medium">Return number</label>
                      <div className="flex gap-2">
                         <Input 
                           placeholder="Enter SR Number (e.g. SR-00001)" 
                           value={searchReturnNo}
                           onChange={e => setSearchReturnNo(e.target.value)}
                           onFocus={() => {
                              if (vKeyboardEnabled) {
                                 setVKeyboardActiveInput({
                                    key: "Refund Lookup",
                                    value: searchReturnNo,
                                    setter: (val: string) => setSearchReturnNo(val)
                                 });
                              }
                           }}
                           className="h-11"
                           onKeyDown={async (e) => {
                              if (e.key === 'Enter' && searchReturnNo) {
                                 setSearchingRefund(true);
                                 try {
                                    const data = await fetchReturnDetails(searchReturnNo);
                                    if (data) setRefundReturnData(data);
                                    else toast({ title: "Not Found", description: "No return found with that number.", variant: "destructive" });
                                 } catch (err: any) {
                                    toast({ title: "Search Error", description: err.message, variant: "destructive" });
                                 } finally {
                                    setSearchingRefund(false);
                                 }
                              }
                           }}
                         />
                         <Button 
                           className="h-11 px-5"
                           onClick={async () => {
                              if (!searchReturnNo) return;
                              setSearchingRefund(true);
                              try {
                                 const data = await fetchReturnDetails(searchReturnNo);
                                 if (data) setRefundReturnData(data);
                                 else toast({ title: "Not Found", description: "No return found with that number.", variant: "destructive" });
                              } catch (err: any) {
                                 toast({ title: "Search Error", description: err.message, variant: "destructive" });
                              } finally {
                                 setSearchingRefund(false);
                              }
                           }}
                           disabled={searchingRefund || !searchReturnNo}
                         >
                           {searchingRefund ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                         </Button>
                      </div>
                   </div>
                   <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center opacity-40">
                      <Search className="w-12 h-12 mb-4" />
                      <p className="text-sm font-bold">Please search for a return document to proceed with financial refund.</p>
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-100 rounded-md">
                         <div className="p-3 bg-amber-600 text-white rounded-md"><Receipt className="w-5 h-5" /></div>
                                 <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-600">Releasing Payment For</p>
                            <p className="text-base font-black truncate">{refundReturnData.return.return_no}</p>
                            <p className="text-xs text-muted-foreground font-bold">{refundReturnData.return.customer_name} • Invoice #{refundReturnData.return.invoice_no}</p>
                         </div>
                      </div>

                      {refundReturnData.is_refunded ? (
                         <div className="p-4 bg-orange-100 border border-orange-200 rounded-md flex items-center gap-3 text-orange-900 animate-pulse">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-xs font-bold">This return has already been refunded. Check the Day Ledger to reprint the receipt.</p>
                         </div>
                      ) : (
                         <>
                            {!newRefundId && (
                               <>
                                  <div className="p-6 bg-amber-50/50 dark:bg-amber-950/10 border-2 border-dashed border-amber-200 dark:border-amber-900/50 rounded-lg flex flex-col items-center">
                                     <p className="text-[10px] font-semibolder text-muted-foreground mb-1">Payable Refund Amount</p>
                                     <p className="text-4xl font-black text-amber-600 tabular-nums">LKR {parseFloat(refundReturnData.return.total_amount).toLocaleString()}</p>
                                  </div>

                                  <div className="space-y-2">
                                     <label className="text-sm font-medium">Select Refund Method</label>
                                     <div className="grid grid-cols-2 gap-2">
                                        {['Cash', 'Bank Transfer'].map(m => (
                                          <Button 
                                            key={m} 
                                            variant={refundPaymentMethod === m ? 'default' : 'outline'}
                                            className={`h-11 font-medium transition-colors ${refundPaymentMethod === m ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-white dark:bg-slate-950'}`}
                                            onClick={() => setRefundPaymentMethod(m as any)}
                                          >
                                             {m === 'Cash' ? <Banknote className="w-4 h-4 mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                                             {m}
                                          </Button>
                                        ))}
                                     </div>
                                  </div>
                               </>
                            )}

                            {newRefundId ? (
                               <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
                                  <div className="p-3 bg-emerald-600 text-white rounded-full"><Check className="w-6 h-6" /></div>
                                  <div className="text-center">
                                     <p className="text-xs font-semibold text-emerald-800">Refund Successful</p>
                                     <p className="text-sm font-black text-emerald-950 mt-1">{newRefundNo}</p>
                                     <p className="text-[10px] font-bold text-emerald-950/60 mt-1 text-center">Cash flow updated successfully.</p>
                                  </div>
                                  <Button 
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-lg shadow-emerald-200"
                                    onClick={() => void printPosDoc(`/cms/refunds/${newRefundId}/receipt`, `Refund #${newRefundId}`, toast)}
                                  >
                                    <Printer className="w-4 h-4 mr-2" /> Print Refund Receipt
                                  </Button>
                               </div>
                            ) : (
                              <Button 
                                className="w-full h-12 transition-all rounded-md mt-4"
                                disabled={isProcessingReturn}
                                onClick={async () => {
                                   setIsProcessingReturn(true);
                                   try {
                                      const payload = {
                                         return_id: refundReturnData.return.id,
                                         invoice_id: refundReturnData.return.invoice_id,
                                         amount: refundReturnData.return.total_amount,
                                         payment_method: refundPaymentMethod,
                                         notes: `Refund for return ${refundReturnData.return.return_no}`
                                      };
                                      const res = await apiHelper('/api/refund/create', { method: 'POST', body: JSON.stringify(payload) });
                                      if (!res.ok) throw new Error("Refund processing failed");
                                      const data = await res.json();
                                      setNewRefundId(data.data.id);
                                      setNewRefundNo(data.data.refund_no);
                                      toast({ title: "Refund Success", description: `LKR ${parseFloat(refundReturnData.return.total_amount).toLocaleString()} refunded.` });
                                   } catch (err: any) {
                                      toast({ title: "Refund Failed", description: err.message, variant: "destructive" });
                                   } finally {
                                      setIsProcessingReturn(false);
                                   }
                                }}
                              >
                                 {isProcessingReturn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                 Confirm & Release Cash
                              </Button>
                            )}
                         </>
                      )}
                      <Button variant="ghost" className="w-full h-12 font-bold" onClick={() => setRefundReturnData(null)}>
                         {refundReturnData ? "Back to Search" : "Close"}
                      </Button>
                   </div>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. DAY LEDGER DIALOG — standard ERP layout: header / summary / payments / activity */}
      <Dialog open={ledgerDialogOpen} onOpenChange={setLedgerDialogOpen}>
         <DialogContent size="lg" className="p-0 gap-0 flex flex-col overflow-hidden">
            {(() => {
               const fmt = (n: any) => `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
               const reload = async () => {
                  setLoadingLedger(true);
                  try { setDayLedger(await fetchPosDayLedger(selectedLocation)); } finally { setLoadingLedger(false); }
               };
               const TYPE: Record<string, { label: string; plural: string; icon: any; out?: boolean }> = {
                  Invoice: { label: 'Sale', plural: 'sales', icon: FileText },
                  Receipt: { label: 'Payment', plural: 'payments', icon: Receipt },
                  Return: { label: 'Return', plural: 'returns', icon: RotateCcw, out: true },
                  Refund: { label: 'Refund', plural: 'refunds', icon: Banknote, out: true },
               };
               const events: any[] = dayLedger?.events || [];
               const count = (t: string) => events.filter((e: any) => e.type === t).length;
               const methods = dayLedger?.summary?.methods || {};
               return (
                  <>
                     {/* Header */}
                     <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3 pr-12 shrink-0">
                        <div>
                           <DialogTitle>Day summary</DialogTitle>
                           <DialogDescription>
                              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                           </DialogDescription>
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <Button variant="outline" size="sm" className="h-9" onClick={reload} disabled={loadingLedger} aria-label="Refresh figures">
                              <RotateCcw className={`w-4 h-4 ${loadingLedger ? 'animate-spin' : ''}`} />
                           </Button>
                           <Button size="sm" className="h-9 gap-2" onClick={() => void printPosDoc(`/cms/pos/day-end?location_id=${selectedLocation}`, 'Day end summary', toast)}>
                              <Printer className="w-4 h-4" aria-hidden="true" /> Print day-end
                           </Button>
                        </div>
                     </div>

                     <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                        {loadingLedger && !dayLedger ? (
                           <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                              <Loader2 className="w-5 h-5 animate-spin" /> Loading today's figures…
                           </div>
                        ) : !dayLedger ? (
                           <div className="py-16 text-center space-y-3">
                              <p className="text-sm text-muted-foreground">Couldn't load today's figures.</p>
                              <Button variant="outline" size="sm" onClick={reload}>Try again</Button>
                           </div>
                        ) : (
                           <>
                              {/* Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 rounded-lg border border-border divide-x divide-y md:divide-y-0 divide-border overflow-hidden">
                                 {[
                                    { label: 'Sales', value: dayLedger.summary.sales },
                                    { label: 'Returns', value: dayLedger.summary.returns, out: true },
                                    { label: 'Refunds', value: dayLedger.summary.refunds, out: true },
                                    { label: 'Net intake', value: dayLedger.summary.net, strong: true },
                                 ].map((k: any) => (
                                    <div key={k.label} className={`px-4 py-3 ${k.strong ? 'bg-primary/5' : ''}`}>
                                       <div className="text-xs text-muted-foreground">{k.label}</div>
                                       <div className={`mt-0.5 tabular-nums ${k.strong ? 'text-lg font-semibold' : 'text-base font-medium'} ${k.out && Number(k.value) > 0 ? 'text-destructive' : ''}`}>
                                          {k.out && Number(k.value) > 0 ? '− ' : ''}{fmt(k.value)}
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              {/* Collected by payment method */}
                              <div>
                                 <h3 className="text-sm font-medium mb-2">Collected by payment method</h3>
                                 <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                    {[['Cash', 'Cash'], ['Card', 'Card'], ['Bank Transfer', 'Transfer'], ['Cheque', 'Cheque']].map(([key, label]) => (
                                       <div key={key} className="rounded-md border border-border px-3 py-2">
                                          <dt className="text-xs text-muted-foreground">{label}</dt>
                                          <dd className="font-medium tabular-nums">{fmt(methods[key])}</dd>
                                       </div>
                                    ))}
                                 </dl>
                              </div>

                              {/* Activity (searchable, paged) */}
                              <LedgerActivity events={events} TYPE={TYPE} fmt={fmt} />
                           </>
                        )}
                     </div>
                  </>
               );
            })()}
         </DialogContent>
        </Dialog>

        <ReservationSelectionDialog />
      </>
    );
};

/**
 * Day activity list built for busy days (50–500+ documents):
 *  - search by document no, customer, payment method or amount
 *  - type tabs with counts
 *  - newest first, 25 rows at a time with "Show more" (no giant DOM, no nested scroll box)
 */
const PAGE = 25;
function LedgerActivity({ events, TYPE, fmt }: { events: any[]; TYPE: Record<string, any>; fmt: (n: any) => string }) {
  const [tab, setTab] = React.useState<string>('all');
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE);

  React.useEffect(() => { setLimit(PAGE); }, [tab, q]);

  const sorted = React.useMemo(
    () => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  );
  const query = q.trim().toLowerCase();
  const matches = (ev: any) => !query || [ev.doc_no, ev.customer_name, ev.payment_method, String(ev.amount)]
    .some((v) => String(v || '').toLowerCase().includes(query));
  const inTab = (ev: any) => tab === 'all' || ev.type === tab;
  const searched = sorted.filter(matches);
  const rows = searched.filter(inTab);
  const count = (t: string) => searched.filter((e) => t === 'all' || e.type === t).length;
  const shown = rows.slice(0, limit);
  const rowsTotal = rows.reduce((s, e) => s + (TYPE[e.type]?.out ? -1 : 1) * Number(e.amount || 0), 0);

  const tabs: Array<[string, string]> = [['all', 'All'], ['Invoice', 'Sales'], ['Receipt', 'Payments'], ['Return', 'Returns'], ['Refund', 'Refunds']];

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <h3 className="text-sm font-medium">Activity</h3>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search no., customer, amount"
            aria-label="Search today's activity"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div role="tablist" aria-label="Activity type" className="grid grid-cols-5 gap-1 p-1 rounded-md bg-muted">
        {tabs.map(([val, label]) => (
          <button
            key={val}
            type="button"
            role="tab"
            aria-selected={tab === val}
            onClick={() => setTab(val)}
            className={`h-8 rounded-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label} ({count(val)})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {query ? `Nothing matches "${q}".` : `No ${tab === 'all' ? 'activity' : TYPE[tab]?.plural} today yet.`}
        </div>
      ) : (
        <>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {shown.map((ev: any, idx: number) => {
              const t = TYPE[ev.type] || { label: ev.type, icon: FileText };
              const Icon = t.icon;
              const url =
                ev.type === 'Invoice' ? `/cms/invoices/${ev.id}/receipt` :
                ev.type === 'Return' ? `/cms/sales-returns/${ev.id}/receipt` :
                ev.type === 'Refund' ? `/cms/refunds/${ev.id}/receipt` :
                ev.type === 'Receipt' ? `/cms/invoices/${ev.invoice_id}/receipt` : '';
              return (
                <li key={`${ev.type}-${ev.id}-${idx}`} className="flex items-center gap-3 px-3 py-2">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{ev.doc_no}</span>
                      <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground shrink-0">{t.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ev.customer_name || 'Walk-in customer'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-medium tabular-nums ${t.out ? 'text-destructive' : ''}`}>{t.out ? '− ' : ''}{fmt(ev.amount)}</div>
                    <div className="text-xs text-muted-foreground">{ev.payment_method || (ev.type === 'Invoice' ? 'POS sale' : '')}</div>
                  </div>
                  {url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Print ${ev.doc_no}`} onClick={() => void printPosDoc(url, ev.doc_no)}>
                      <Printer className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Showing {shown.length} of {rows.length}
              {tab !== 'all' && <> · total <span className="font-medium text-foreground tabular-nums">{fmt(Math.abs(rowsTotal))}</span></>}
            </span>
            {rows.length > limit && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, rows.length - limit)} more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

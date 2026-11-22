"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Calculator, 
  Banknote, 
  CreditCard, 
  Receipt, 
  Store, 
  Trash2, 
  Plus, 
  AlertCircle, 
  ShieldCheck, 
  Loader2, 
  Printer, 
  User 
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePOS } from "../../context/POSContext";
import { fetchBankBranches } from "@/lib/api";

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Likely cash amounts for a bill: next 100 / 500 / 1,000 / 5,000 note boundary. */
function quickCashOptions(total: number): number[] {
  if (!(total > 0)) return [];
  const opts = new Set<number>();
  for (const step of [100, 500, 1000, 5000]) {
    opts.add(Math.ceil(total / step) * step);
  }
  opts.add(Math.ceil(total / 5000) * 5000 + 5000);
  return [...opts].filter(v => v >= total).sort((a, b) => a - b).slice(0, 4);
}

export const CheckoutDialog: React.FC = () => {
  const {
    checkoutOpen,
    setCheckoutOpen,
    cart,
    totals,
    submitting,
    handleCheckoutProcess,
    selectedCustomer,
    customers,
    banks,
    bankBranches,
    setBankBranches,
    vKeyboardEnabled,
    setVKeyboardActiveInput,
    selectedBankId,
    setSelectedBankId,
    selectedCardCategory,
    setSelectedCardCategory
  } = usePOS();

  // --- Single Payment States ---
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Cheque' | 'Bank Transfer' | 'Credit'>('Cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  
  // Details for Single Payment
  const [cardType, setCardType] = useState('Visa');
  const [cardLast4, setCardLast4] = useState('');
  const [cardAuthCode, setCardAuthCode] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeBranchName, setChequeBranchName] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequePayee, setChequePayee] = useState('');

  // --- Split Payment States ---
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<any[]>([
    { id: '1', method: 'Cash', amount: 0, cardType: 'Visa', cardLast4: '', cardAuthCode: '', chequeNo: '', chequeBankName: '', chequeBranchName: '', chequeDate: new Date().toISOString().split('T')[0], chequePayee: '' }
  ]);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null);

  // Sub-dialogs visibility
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const [chequeDetailsOpen, setChequeDetailsOpen] = useState(false);

  // Initialize amount when opening
  useEffect(() => {
    if (checkoutOpen) {
       setAmountReceived(totals.grandTotal);
       setIsSplitPayment(false);
       setPaymentMethod('Cash');
       setSplitPayments([{ id: '1', method: 'Cash', amount: totals.grandTotal, cardType: 'Visa', cardLast4: '', cardAuthCode: '', chequeNo: '', chequeBankName: '', chequeBranchName: '', chequeDate: new Date().toISOString().split('T')[0], chequePayee: '' }]);
    }
  }, [checkoutOpen, totals.grandTotal]);

  const onConfirmCheckout = async () => {
    const paymentData = {
      isSplit: isSplitPayment,
      splitPayments: splitPayments,
      method: paymentMethod,
      amount: Math.min(amountReceived, totals.grandTotal),
      cardType, cardLast4, cardAuthCode,
      chequeNo, chequeBankName, chequeBranchName, chequeDate, chequePayee
    };
    await handleCheckoutProcess(paymentData);
    setCheckoutOpen(false);
  };

  // Global Key Listener for Amount received (only when single cash payment)
  useEffect(() => {
    if (!checkoutOpen || isSplitPayment || (paymentMethod !== 'Cash' && paymentMethod !== 'Bank Transfer')) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      if (/^[0-9]$/.test(e.key) || e.key === '.') {
        e.preventDefault();
        const current = String(amountReceived || '');
        if (e.key === '.' && current.includes('.')) return;
        const next = current + e.key;
        setAmountReceived(Number(next));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const str = String(amountReceived || '');
        setAmountReceived(Number(str.slice(0, -1)) || 0);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setAmountReceived(0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!submitting) onConfirmCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkoutOpen, isSplitPayment, paymentMethod, amountReceived, submitting, onConfirmCheckout]);

  const totalPaid = isSplitPayment ? splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0) : amountReceived;

  return (
    <>
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent size="lg" className={`transition-all duration-300 flex flex-col sm:rounded-lg p-0 overflow-hidden`}>
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            {/* Main Payment Section */}
            <div className="flex-1 min-h-0 p-4 flex flex-col space-y-3 bg-background overflow-hidden">
              <DialogHeader className="relative pr-12">
                <div className="flex justify-between items-center w-full">
                  <DialogTitle className="flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-primary"/> POS Checkout
                  </DialogTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                    className={`font-bold transition-all h-8 text-[10px] ${isSplitPayment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : ''}`}
                  >
                    {isSplitPayment ? '⚡ Split: ON' : '⚡ Split?'}
                  </Button>
                </div>
              </DialogHeader>
              
              {/* Total and Balance */}
              <div className="space-y-3">
                <div className="bg-muted px-4 py-2.5 rounded-md flex justify-between items-center">
                  <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Total Due</span>
                  <span className="font-semibold text-xl tabular-nums text-foreground">LKR {money(totals.grandTotal)}</span>
                </div>
                
                {isSplitPayment && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex justify-between items-center border border-blue-100 dark:border-blue-900/30 min-w-0">
                      <span className="text-[10px] font-bold text-blue-700 uppercase whitespace-nowrap mr-2">Paid</span>
                      <span className="font-black text-lg tabular-nums text-blue-800 dark:text-blue-400 truncate">LKR {totalPaid.toLocaleString()}</span>
                    </div>
                    <div className={`flex-1 p-3 rounded-lg flex justify-between items-center border min-w-0 ${totalPaid >= totals.grandTotal ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30 text-emerald-700' : 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/30 text-rose-700'}`}>
                      <span className="text-[10px] font-bold uppercase whitespace-nowrap mr-2">Balance</span>
                      <span className="font-black text-lg tabular-nums truncate">LKR {Math.max(0, totals.grandTotal - totalPaid).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4 custom-scrollbar">
                {isSplitPayment ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {splitPayments.map((payment, idx) => (
                      <div key={payment.id} className="p-4 rounded-md border-2 border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-4 relative group">
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex-1">
                            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                              {(['Cash', 'Card', 'Cheque', 'Bank Transfer'] as const).map(m => {
                                const active = payment.method === m;
                                return (
                                  <button 
                                    key={m} 
                                    onClick={() => {
                                      const next = [...splitPayments];
                                      next[idx].method = m;
                                      setSplitPayments(next);
                                    }}
                                    className={`px-3 h-8 rounded-full border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${active ? 'bg-primary border-primary text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-primary/50'}`}
                                  >
                                    {m === 'Cash' && <Banknote className="w-3 h-3"/>}
                                    {m === 'Card' && <CreditCard className="w-3 h-3"/>}
                                    {m === 'Cheque' && <Receipt className="w-3 h-3"/>}
                                    {m === 'Bank Transfer' && <Store className="w-3 h-3"/>}
                                    {m}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {idx > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                              onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                             <Input 
                              type="number" 
                              placeholder="Amount" 
                              value={payment.amount || ''}
                              onChange={(e) => {
                                const next = [...splitPayments];
                                next[idx].amount = Number(e.target.value);
                                setSplitPayments(next);
                              }}
                              onFocus={() => {
                                if (vKeyboardEnabled) {
                                  setVKeyboardActiveInput({
                                    key: `Split Amount #${idx + 1}`,
                                    value: String(payment.amount || ''),
                                    type: 'numeric',
                                    setter: (val: string) => {
                                      const next = [...splitPayments];
                                      next[idx].amount = Number(val);
                                      setSplitPayments(next);
                                    }
                                  });
                                }
                              }}
                              className="h-11 font-black text-xl bg-white dark:bg-slate-900 focus:ring-primary shadow-sm"
                            />
                          </div>
                          {(payment.method === 'Card' || payment.method === 'Cheque') && (
                            <Button 
                              variant="outline" 
                              className={`h-11 font-bold gap-2 ${((payment.method === 'Card' && payment.cardLast4) || (payment.method === 'Cheque' && payment.chequeNo)) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-indigo-200 text-indigo-700'}`}
                              onClick={() => setEditingPaymentIndex(idx)}
                            >
                              {payment.method === 'Card' ? <CreditCard className="w-4 h-4"/> : <Receipt className="w-4 h-4"/>}
                              {((payment.method === 'Card' && payment.cardLast4) || (payment.method === 'Cheque' && payment.chequeNo)) ? 'Saved' : 'Details'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-dashed border-2 font-bold text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5"
                      onClick={() => setSplitPayments([...splitPayments, {
                        id: Math.random().toString(),
                        method: 'Cash',
                        amount: 0,
                        cardType: 'Visa', cardLast4: '', cardAuthCode: '',
                        chequeNo: '', chequeBankName: '', chequeBranchName: '', chequeDate: new Date().toISOString().split('T')[0], chequePayee: ''
                      }])}
                    >
                       <Plus className="w-4 h-4 mr-2" /> Add Payment Method
                    </Button>
                  </div>
                ) : (
                  /* Standard Single Payment View */
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment method</label>
                      <div className="grid grid-cols-2 gap-2">
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
                              className={`h-10 text-sm font-medium transition-colors ${active ? '' : 'hover:border-primary/50'}`}
                              onClick={() => { setPaymentMethod(m); if (amountReceived === 0) setAmountReceived(totals.grandTotal); }}
                            >
                              {icons[m]} {m}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        type="button"
                        variant={paymentMethod === 'Credit' ? 'destructive' : 'outline'}
                        className={`w-full h-9 text-sm font-medium transition-colors ${paymentMethod === 'Credit' ? '' : 'border-dashed border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10'}`}
                        onClick={() => { setPaymentMethod('Credit'); setAmountReceived(0); }}
                      >
                        Credit sale (pay later)
                      </Button>
                    </div>

                    {(paymentMethod === 'Cheque' || paymentMethod === 'Card') && (
                      <div className="lg:hidden">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className={`w-full h-12 border-2 font-bold gap-2 ${paymentMethod === 'Cheque' ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          onClick={() => paymentMethod === 'Cheque' ? setChequeDetailsOpen(true) : setCardDetailsOpen(true)}
                        >
                          {paymentMethod === 'Cheque' ? (
                              <>
                                  <Receipt className="w-4 h-4" />
                                  {chequeNo ? `Cheque: ${chequeNo}` : 'Enter Cheque Details'}
                              </>
                          ) : (
                              <>
                                  <CreditCard className="w-4 h-4" />
                                  {cardLast4 ? `Card ending in ${cardLast4}` : 'Enter Card Details'}
                              </>
                          )}
                        </Button>
                      </div>
                    )}

                    {paymentMethod !== 'Credit' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount received</label>
                        <Input 
                          type="number"
                          value={amountReceived || ''} 
                          onChange={(e) => setAmountReceived(Number(e.target.value))}
                          onFocus={() => {
                            if (vKeyboardEnabled) {
                              setVKeyboardActiveInput({
                                key: "Cash Amount Received",
                                value: String(amountReceived || ''),
                                type: 'numeric',
                                setter: (val: string) => setAmountReceived(Number(val))
                              });
                            }
                          }}
                          className="text-right font-semibold text-2xl h-12 tabular-nums rounded-md"
                        />
                        {/* Quick cash: the notes a customer is most likely to hand over */}
                        <div className="grid grid-cols-4 gap-2">
                          {quickCashOptions(totals.grandTotal).map(amt => (
                            <Button key={amt} variant="secondary" size="sm" onClick={() => setAmountReceived(amt)} className={`font-medium tabular-nums h-9 rounded-md ${amountReceived === amt ? 'ring-2 ring-primary' : ''}`}>
                              {amt.toLocaleString()}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod !== 'Credit' && amountReceived - totals.grandTotal > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-md border border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2">
                        <span className="text-sm font-medium">Change</span>
                        <span className="font-semibold text-lg tabular-nums">LKR {money(amountReceived - totals.grandTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-3 gap-2 shrink-0">
                <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="h-11">Cancel</Button>
                <Button 
                    onClick={onConfirmCheckout} 
                    disabled={submitting || 
                        (isSplitPayment && totalPaid < totals.grandTotal) || 
                        (!isSplitPayment && ((paymentMethod === 'Cheque' && !chequeNo) || (paymentMethod === 'Card' && !cardLast4)))
                    } 
                    className="flex-1 h-11 rounded-md"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" aria-hidden="true" />}
                  Process & Print Invoice
                </Button>
              </DialogFooter>
            </div>

            {/* Right Side Detail Panels (Desktop) */}
            {!isSplitPayment && (
              <div className="hidden lg:flex w-[360px] bg-muted/30 p-4 border-l border-border flex-col space-y-4 overflow-y-auto custom-scrollbar">
                
                {/* 1. Balanced Customer Header (Persistent) */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Customer
                  </p>
                  {(() => {
                    const cust = customers.find(c => String(c.id) === String(selectedCustomer));
                    return (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-md">
                        <div className="p-2.5 bg-primary/10 rounded-full">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate text-foreground">{cust?.name || 'Walk-In Customer'}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{cust?.phone || 'No Phone Attached'}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="h-px bg-border/50 shrink-0" />

                {/* 2. Context-Aware Action Panel */}
                {paymentMethod === 'Credit' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="pb-2">
                      <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Credit Audit
                      </p>
                    </div>
                    {(() => {
                       const cust = customers.find(c => String(c.id) === String(selectedCustomer));
                       if (!cust) return <div className="text-xs text-muted-foreground italic">Select a customer to view credit stats.</div>;
                       const limit = Number(cust.credit_limit) || 0;
                       const outstanding = Number(cust.total_outstanding) || 0;
                       const available = limit - outstanding;
                       const remainingAfterSale = available - totals.grandTotal;
                       const isOverLimit = remainingAfterSale < 0;
                       return (
                         <div className="space-y-4">
                            <div className={`p-5 border-2 rounded-lg shadow-md transition-all ${isOverLimit ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Remaining Trust Balance</p>
                              <p className={`text-3xl font-black tabular-nums ${isOverLimit ? 'text-rose-700' : 'text-emerald-700'}`}>LKR {available.toLocaleString()}</p>
                            </div>
                            {isOverLimit && (
                              <div className="p-4 bg-rose-600 text-white rounded-md flex items-start gap-3 shadow-lg shadow-rose-200 dark:shadow-none animate-pulse">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <div className="space-y-1">
                                  <p className="text-[11px] font-black uppercase">Credit Warning</p>
                                  <p className="text-[10px] leading-tight font-medium opacity-90">This transaction exceeds the customer&apos;s allowed credit limit.</p>
                                </div>
                              </div>
                            )}
                         </div>
                       );
                    })()}
                  </div>
                )}

                {paymentMethod === 'Cheque' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                    <p className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Cheque details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-muted-foreground">Cheque Serial Number</label>
                        <Input maxLength={10} placeholder="XXXXXX" value={chequeNo} onChange={e => setChequeNo(e.target.value.replace(/\D/g,''))} className="font-mono text-center h-10" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-xs text-muted-foreground">Payment Date</label>
                        <Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className="h-10" />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-xs text-muted-foreground">Issuing Bank</label>
                        <SearchableSelect
                          options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                          value={chequeBankName ? String(banks.find(b => b.name === chequeBankName)?.id || "") : ""}
                          onValueChange={async (val) => {
                            const b = banks.find(x => String(x.id) === val);
                            if (b) { setChequeBankName(b.name); setChequeBranchName(""); setBankBranches(await fetchBankBranches(val)); }
                          }}
                          placeholder="Select Bank"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-xs text-muted-foreground">Branch Name</label>
                        <SearchableSelect
                          options={bankBranches.map(br => ({ value: String(br.id), label: br.branch_name }))}
                          value={chequeBranchName ? String(bankBranches.find(br => br.branch_name === chequeBranchName)?.id || "") : ""}
                          onValueChange={(val) => setChequeBranchName(bankBranches.find(br => String(br.id) === val)?.branch_name || "")}
                          placeholder="Select Branch"
                          disabled={!bankBranches.length}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(paymentMethod === 'Cash' || paymentMethod === 'Bank Transfer') && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-right-4">
                    <p className="text-sm font-medium flex items-center gap-2"><Calculator className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Keypad</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '.'].map(val => (
                        <Button 
                          key={String(val)} 
                          variant="outline" 
                          className={`h-12 text-lg font-semibold tabular-nums rounded-md ${val === 'C' ? 'text-muted-foreground' : ''}`}
                          onClick={() => {
                            if (val === 'C') setAmountReceived(0);
                            else {
                               const current = String(amountReceived || '');
                               if (val === '.' && current.includes('.')) return;
                               const next = current + String(val);
                               if (next.length <= 12) setAmountReceived(Number(next) || 0);
                            }
                          }}
                        >
                          {val}
                        </Button>
                      ))}
                    </div>
                    <Button variant="default" className="w-full h-11 rounded-md" onClick={() => setAmountReceived(totals.grandTotal)}>Exact amount</Button>
                  </div>
                )}

                {paymentMethod === 'Card' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                    <p className="text-sm font-medium flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Card details</p>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Card type</div>
                      <div role="radiogroup" aria-label="Card type" className="grid grid-cols-4 gap-0.5 p-0.5 rounded-md bg-muted">
                        {['Visa', 'Mastercard', 'AMEX', 'Other'].map(type => (
                          <button key={type} type="button" role="radio" aria-checked={cardType === type} onClick={() => setCardType(type)} className={`h-9 rounded-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cardType === type ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {type === 'Mastercard' ? 'Master' : type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Credit or debit</div>
                      <div role="radiogroup" aria-label="Card category" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-md bg-muted">
                        {['Credit', 'Debit'].map(cat => (
                          <button key={cat} type="button" role="radio" aria-checked={selectedCardCategory === cat} onClick={() => setSelectedCardCategory(cat)} className={`h-9 rounded-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedCardCategory === cat ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Issuing bank</div>
                      <SearchableSelect
                        options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                        value={selectedBankId}
                        onValueChange={(val) => setSelectedBankId(val)}
                        placeholder="Select bank"
                        triggerClassName="h-10 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="card-last4" className="text-xs text-muted-foreground">Last 4 digits <span className="text-destructive">*</span></label>
                        <Input
                          id="card-last4"
                          inputMode="numeric"
                          maxLength={4} placeholder="0000"
                          value={cardLast4}
                          onChange={e => setCardLast4(e.target.value.replace(/\D/g,''))}
                          onFocus={() => {
                            if (vKeyboardEnabled) {
                              setVKeyboardActiveInput({
                                key: "Card Last 4",
                                value: cardLast4,
                                type: 'numeric',
                                setter: (val: string) => setCardLast4(val.replace(/\D/g,''))
                              });
                            }
                          }}
                          className="mt-1 h-10 font-mono text-center text-base tracking-[0.3em]"
                        />
                      </div>
                      <div>
                        <label htmlFor="card-auth" className="text-xs text-muted-foreground">Auth code</label>
                        <Input
                          id="card-auth"
                          placeholder="Optional"
                          value={cardAuthCode}
                          onChange={e => setCardAuthCode(e.target.value)}
                          onFocus={() => {
                            if (vKeyboardEnabled) {
                              setVKeyboardActiveInput({
                                key: "Auth Code",
                                value: cardAuthCode,
                                setter: (val: string) => setCardAuthCode(val)
                              });
                            }
                          }}
                          className="mt-1 h-10"
                        />
                      </div>
                    </div>
                    {!cardLast4 && <p className="text-xs text-muted-foreground">Enter the last 4 digits to finish the sale.</p>}
                  </div>
                )}

              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Payment Detail Sub-Modals (Card/Cheque) */}
      <Dialog open={editingPaymentIndex !== null} onOpenChange={(o) => !o && setEditingPaymentIndex(null)}>
        <DialogContent size="sm" className="overflow-y-auto rounded-lg p-6 animate-in zoom-in-95 duration-200">
           <DialogHeader className="mb-4">
             <DialogTitle className="flex items-center gap-2">
               {editingPaymentIndex !== null && splitPayments[editingPaymentIndex]?.method === 'Card' ? (
                 <><CreditCard className="w-5 h-5 text-indigo-500"/> Card Setup</>
               ) : (
                 <><Receipt className="w-5 h-5 text-amber-500"/> Cheque Setup</>
               )}
             </DialogTitle>
           </DialogHeader>
           {editingPaymentIndex !== null && (
             <div className="space-y-6">
                {splitPayments[editingPaymentIndex].method === 'Card' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-2">
                      {['Visa', 'Mastercard', 'AMEX', 'Other'].map(type => (
                        <Button 
                          key={type} 
                          size="sm" 
                          variant={splitPayments[editingPaymentIndex].cardType === type ? 'default' : 'outline'} 
                          onClick={() => {
                            const n = [...splitPayments]; n[editingPaymentIndex].cardType = type; setSplitPayments(n);
                          }} 
                          className={`font-black text-[10px] uppercase h-10 transition-all rounded-md ${splitPayments[editingPaymentIndex].cardType === type ? 'ring-2 ring-primary/20' : ''}`}
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Provider / Bank</label>
                        <select 
                          className="w-full h-11 px-4 text-sm font-bold bg-slate-50 dark:bg-slate-900 border-none rounded-md focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          value={splitPayments[editingPaymentIndex].bankId || ""}
                          onChange={e => {
                            const n = [...splitPayments]; n[editingPaymentIndex].bankId = e.target.value; setSplitPayments(n);
                          }}
                        >
                          <option value="">Select Bank</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Category</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg">
                          {['Credit', 'Debit'].map(cat => (
                            <Button
                              key={cat}
                              size="sm"
                              variant={splitPayments[editingPaymentIndex].cardCategory === cat ? 'default' : 'ghost'}
                              onClick={() => {
                                const n = [...splitPayments]; n[editingPaymentIndex].cardCategory = cat; setSplitPayments(n);
                              }}
                              className={`h-9 font-black text-[10px] uppercase rounded-md transition-all ${splitPayments[editingPaymentIndex].cardCategory === cat ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-muted-foreground'}`}
                            >
                              {cat} Card
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Number (Last 4)</label>
                          <Input 
                            maxLength={4} 
                            placeholder="0000" 
                            value={splitPayments[editingPaymentIndex].cardLast4 || ""} 
                            onChange={e => {
                              const n = [...splitPayments]; n[editingPaymentIndex].cardLast4 = e.target.value.replace(/\D/g,''); setSplitPayments(n);
                            }} 
                            className="font-mono text-center text-2xl h-12 font-black tracking-[0.2em] bg-slate-50 dark:bg-slate-900 border-none rounded-md" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Auth Code</label>
                          <Input 
                            placeholder="Verification" 
                            value={splitPayments[editingPaymentIndex].cardAuthCode || ""} 
                            onChange={e => {
                              const n = [...splitPayments]; n[editingPaymentIndex].cardAuthCode = e.target.value; setSplitPayments(n);
                            }} 
                            className="text-center font-bold h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-md placeholder:font-medium" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cheque #</label>
                         <Input 
                          placeholder="XXXXXX" 
                          value={splitPayments[editingPaymentIndex].chequeNo} 
                          onChange={e => {
                            const n = [...splitPayments]; n[editingPaymentIndex].chequeNo = e.target.value; setSplitPayments(n);
                          }} 
                          className="font-bold h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-md"
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Date</label>
                         <Input 
                          type="date" 
                          value={splitPayments[editingPaymentIndex].chequeDate} 
                          onChange={e => {
                            const n = [...splitPayments]; n[editingPaymentIndex].chequeDate = e.target.value; setSplitPayments(n);
                          }} 
                          className="font-bold h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-md"
                         />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Issuing Bank</label>
                      <SearchableSelect
                          options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                          value={splitPayments[editingPaymentIndex].chequeBankName ? String(banks.find(b => b.name === splitPayments[editingPaymentIndex].chequeBankName)?.id || "") : ""}
                          onValueChange={async (val) => {
                            const b = banks.find(x => String(x.id) === val);
                            if (b) {
                               const n = [...splitPayments]; n[editingPaymentIndex].chequeBankName = b.name; n[editingPaymentIndex].chequeBranchName = ""; setSplitPayments(n);
                               setBankBranches(await fetchBankBranches(val));
                            }
                          }}
                          placeholder="Select Bank"
                        />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Branch</label>
                      <SearchableSelect
                          options={bankBranches.map(br => ({ value: String(br.id), label: br.branch_name }))}
                          value={splitPayments[editingPaymentIndex].chequeBranchName ? String(bankBranches.find(br => br.branch_name === splitPayments[editingPaymentIndex].chequeBranchName)?.id || "") : ""}
                          onValueChange={(val) => {
                            const br = bankBranches.find(x => String(x.id) === val);
                            if (br) { const n = [...splitPayments]; n[editingPaymentIndex].chequeBranchName = br.branch_name; setSplitPayments(n); }
                          }}
                          placeholder="Select Branch"
                          disabled={!bankBranches.length}
                        />
                    </div>
                  </div>
                )}
                <Button onClick={() => setEditingPaymentIndex(null)} className="w-full h-14 font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20">
                  Save Changes
                </Button>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* Single Payment Detail Sub-Modals (Card) */}
      <Dialog open={cardDetailsOpen} onOpenChange={setCardDetailsOpen}>
        <DialogContent size="sm" className="overflow-y-auto rounded-lg p-6 animate-in zoom-in-95 duration-200">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500"/> Card Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2">
              {['Visa', 'Mastercard', 'AMEX', 'Other'].map(type => (
                <Button 
                  key={type} 
                  size="sm" 
                  variant={cardType === type ? 'default' : 'outline'} 
                  onClick={() => setCardType(type)} 
                  className={`font-black text-[10px] uppercase h-10 transition-all rounded-md ${cardType === type ? 'ring-2 ring-primary/20' : ''}`}
                >
                  {type}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Provider / Bank</label>
                  <SearchableSelect 
                      options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                      value={selectedBankId}
                      onValueChange={(val) => setSelectedBankId(val)}
                      placeholder="Select Bank..."
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Category</label>
                  <div className="grid grid-cols-2 gap-2">
                       {['Credit', 'Debit'].map(cat => (
                           <Button 
                              key={cat}
                              type="button"
                              variant={selectedCardCategory === cat ? 'default' : 'outline'}
                              onClick={() => setSelectedCardCategory(cat)}
                              className={`h-11 rounded-md font-black text-[10px] uppercase transition-all ${selectedCardCategory === cat ? 'ring-2 ring-primary/20 shadow-lg' : ''}`}
                           >
                              {cat} Card
                           </Button>
                       ))}
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Card Number (Last 4)</label>
              <Input 
                maxLength={4} 
                placeholder="0000" 
                value={cardLast4} 
                onChange={e => setCardLast4(e.target.value.replace(/\D/g,''))} 
                className="font-mono text-center text-3xl h-16 font-black tracking-[0.4em] bg-slate-50 dark:bg-slate-900 border-none rounded-lg shadow-inner" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Auth Code</label>
              <Input 
                placeholder="Verification Code" 
                value={cardAuthCode} 
                onChange={e => setCardAuthCode(e.target.value)} 
                className="h-12 border-none bg-slate-50 dark:bg-slate-900 rounded-md font-bold px-4" 
              />
            </div>
            <Button onClick={() => setCardDetailsOpen(false)} className="w-full h-14 font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-500/20">
              Save & Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Payment Detail Sub-Modals (Cheque) */}
      <Dialog open={chequeDetailsOpen} onOpenChange={setChequeDetailsOpen}>
        <DialogContent size="sm" className="overflow-y-auto rounded-lg p-6 animate-in zoom-in-95 duration-200">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-500"/> Cheque Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cheque #</label>
                <Input 
                  placeholder="XXXXXX" 
                  value={chequeNo} 
                  onChange={e => setChequeNo(e.target.value)} 
                  className="font-bold h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Date</label>
                <Input 
                  type="date" 
                  value={chequeDate} 
                  onChange={e => setChequeDate(e.target.value)} 
                  className="font-bold h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Issuing Bank</label>
              <SearchableSelect
                options={banks.map(b => ({ value: String(b.id), label: b.name }))}
                value={chequeBankName ? String(banks.find(b => b.name === chequeBankName)?.id || "") : ""}
                onValueChange={async (val) => {
                  const b = banks.find(x => String(x.id) === val);
                  if (b) { setChequeBankName(b.name); setChequeBranchName(""); setBankBranches(await fetchBankBranches(val)); }
                }}
                placeholder="Select Bank"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Branch</label>
              <SearchableSelect
                options={bankBranches.map(br => ({ value: String(br.id), label: br.branch_name }))}
                value={chequeBranchName ? String(bankBranches.find(br => br.branch_name === chequeBranchName)?.id || "") : ""}
                onValueChange={(val) => setChequeBranchName(bankBranches.find(br => String(br.id) === val)?.branch_name || "")}
                placeholder="Select Branch"
                disabled={!bankBranches.length}
              />
            </div>
            <Button onClick={() => setChequeDetailsOpen(false)} className="w-full h-14 font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/20 mt-4">
              Save & Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

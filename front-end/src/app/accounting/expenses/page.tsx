"use client";

import React, { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
    fetchExpenses, 
    fetchExpenseSummary,
    createExpense, 
    fetchAccounts, 
    fetchPayees,
    createPayee,
    cancelExpense,
    ExpenseRow,
    PayeeRow 
} from "@/lib/api";
import { 
    Plus, 
    Search, 
    Loader2, 
    Receipt, 
    Calendar, 
    User, 
    CreditCard, 
    FileText, 
    TrendingDown, 
    Filter,
    ArrowUpRight,
    Wallet,
    Info,
    CheckCircle2,
    Printer,
    MoreVertical,
    XCircle,
    AlertCircle
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";

export default function ExpensesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payees, setPayees] = useState<PayeeRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  const [formData, setFormData] = useState({
    payee_id: "",
    expense_account_id: "",
    payment_account_id: "",
    amount: "",
    payee_name: "",
    payment_method: "Cash" as "Cash" | "Cheque" | "TT" | "Bank Transfer",
    cheque_no: "",
    tt_ref_no: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    reference_no: "",
    notes: ""
  });

  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Cancellation State
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingItem, setCancellingItem] = useState<ExpenseRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, accData, sumData, payData] = await Promise.all([
        fetchExpenses(),
        fetchAccounts(),
        fetchExpenseSummary(),
        fetchPayees()
      ]);
      setItems(Array.isArray(expData) ? expData : []);
      setAccounts(Array.isArray(accData) ? accData : []);
      setPayees(Array.isArray(payData) ? payData : []);
      setSummary(sumData);
    } catch (e: any) {
      console.error("Expense Page Load Error:", e);
      toast({ title: "Sync Error", description: "Could not connect to financial ledger", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const expenseAccounts = useMemo(() => {
    if (!Array.isArray(accounts)) return [];
    return accounts.filter(a => 
      ["EXPENSE", "COST_OF_SALES"].includes(String(a.type).toUpperCase())
    );
  }, [accounts]);

  const paymentAccounts = useMemo(() => {
    if (!Array.isArray(accounts)) return [];
    return accounts.filter(a => 
      String(a.type).toUpperCase() === "ASSET" && 
      ["Cash", "Bank", "Petty"].some(s => 
        String(a.name).toLowerCase().includes(s.toLowerCase()) || 
        String(a.code).startsWith('10')
      )
    );
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => 
      i.voucher_no.toLowerCase().includes(q) || 
      i.payee_name.toLowerCase().includes(q) ||
      (i.expense_account_name || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.expense_account_id || !formData.payment_account_id || !formData.amount) {
      toast({ title: "Required", description: "Please fill all mandatory fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let activePayeeId = formData.payee_id;
      let activePayeeName = formData.payee_name;

      // If no ID but name exists, it's a new payee - create it first
      if (!activePayeeId && activePayeeName) {
        const newPayee = await createPayee({ name: activePayeeName });
        activePayeeId = String(newPayee.data.id);
      }

      const res = await createExpense({
        ...formData,
        payee_id: activePayeeId ? parseInt(activePayeeId) : null,
        payee_name: activePayeeName,
        amount: parseFloat(formData.amount),
        expense_account_id: parseInt(formData.expense_account_id),
        payment_account_id: parseInt(formData.payment_account_id)
      });
      toast({ title: "Success", description: "Expense voucher recorded successfully" });
      setIsDialogOpen(false);
      
      // Setup print options
      setLastCreatedId(res.id);
      setShowPrintModal(true);

      setFormData({
        payee_id: "",
        expense_account_id: "",
        payment_account_id: "",
        amount: "",
        payee_name: "",
        payment_method: "Cash",
        cheque_no: "",
        tt_ref_no: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        reference_no: "",
        notes: ""
      });
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to record expense", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelExpense = async () => {
    if (!cancellingItem || !cancelReason.trim()) {
        toast({ title: "Reason Required", description: "Please provide a reason for cancellation", variant: "destructive" });
        return;
    }

    setIsCancelling(true);
    try {
        await cancelExpense(cancellingItem.id, cancelReason);
        toast({ title: "Cancelled", description: `Voucher ${cancellingItem.voucher_no} has been cancelled.` });
        setIsCancelDialogOpen(false);
        setCancelReason("");
        setCancellingItem(null);
        await loadData();
    } catch (e: any) {
        toast({ title: "Cancellation Failed", description: e.message, variant: "destructive" });
    } finally {
        setIsCancelling(false);
    }
  };

  const totalThisMonth = summary?.monthly_trend?.length 
    ? summary.monthly_trend[summary.monthly_trend.length - 1].total 
    : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Receipt className="w-8 h-8 text-primary" />
            Expenses & Payments
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage utility bills, service fees, and operational vouchers</p>
          <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400">
            <span>Accounts: {accounts.length}</span>
            <span>Expenses: {expenseAccounts.length}</span>
            <span>Payment: {paymentAccounts.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button className="h-12 px-6 gap-2 bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-5 h-5" />
            Record Payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-sm bg-primary/5 dark:bg-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total This Month</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">LKR {Number(totalThisMonth).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vouchers Paid</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{items.length} Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Category</p>
                <p className="text-lg font-black text-slate-900 dark:text-white truncate">
                    {summary?.top_categories?.[0]?.category || "None Yet"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by voucher #, payee, or account..." 
              className="pl-9 h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl font-medium" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 px-5 gap-2 font-bold border-slate-200 dark:border-slate-800 rounded-xl">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-bold italic tracking-tight">Syncing payment records...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
                  <Receipt className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">No expense records found</h3>
                <p className="text-muted-foreground max-w-sm mt-2 font-medium">Record your first payment voucher to start tracking your operational spending.</p>
                <Button variant="link" className="mt-4 font-bold text-primary" onClick={() => setIsDialogOpen(true)}>
                    Record a payment now <ArrowUpRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-5">Voucher / Date</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-5">Payee & Details</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-5">Expense Category</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-5 text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all border-slate-100 dark:border-slate-800">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                            <span className="font-black text-primary text-sm tracking-tight">{item.voucher_no}</span>
                            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="w-3 h-3" /> {format(new Date(item.payment_date), "MMM dd, yyyy")}
                            </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" /> {item.payee_name}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground mt-1 italic">
                                {item.reference_no ? `Ref: ${item.reference_no}` : 'No reference'}
                            </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-tighter bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                            {item.expense_account_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex flex-col items-end">
                            <span className="font-black text-slate-900 dark:text-white">
                                LKR {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 rounded uppercase mt-1">
                                Paid via {item.payment_account_name?.split(' ')[0]}
                            </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Printer className="w-4 h-4 text-slate-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl border-slate-200">
                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Print Options</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    className="gap-2 font-bold text-xs"
                                    onClick={() => {
                                        window.open(`/accounting/expenses/print/${item.id}?format=voucher`, '_blank');
                                    }}
                                >
                                    <FileText className="w-4 h-4 text-primary" /> Payment Voucher
                                </DropdownMenuItem>
                                {item.payment_method === 'Cheque' && (
                                    <DropdownMenuItem 
                                        className="gap-2 font-bold text-xs"
                                        onClick={() => {
                                            window.open(`/accounting/expenses/print/${item.id}?format=cheque`, '_blank');
                                        }}
                                    >
                                        <CreditCard className="w-4 h-4 text-rose-500" /> Bank Cheque
                                    </DropdownMenuItem>
                                )}
                                {item.payment_method === 'TT' && (
                                    <DropdownMenuItem 
                                        className="gap-2 font-bold text-xs"
                                        onClick={() => {
                                            window.open(`/accounting/expenses/print/${item.id}?format=tt`, '_blank');
                                        }}
                                    >
                                        <ArrowUpRight className="w-4 h-4 text-blue-500" /> TT Instruction Letter
                                    </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <form onSubmit={handleSubmit}>
            <div className="bg-primary p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Receipt className="w-24 h-24 rotate-12" />
                </div>
                <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter">New Payment Voucher</DialogTitle>
                <DialogDescription className="text-primary-foreground/80 font-medium mt-1 italic">
                    Record a service payment or utility bill settlement.
                </DialogDescription>
            </div>

            <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Date</Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                type="date" 
                                className="pl-10 h-12 font-bold rounded-xl bg-slate-50 border-slate-200" 
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Voucher Amount (LKR)</Label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                className="pl-10 h-12 font-black text-lg rounded-xl bg-slate-50 border-slate-200" 
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payee Name / Service Provider</Label>
                    <SearchableSelect
                        options={payees.map(p => ({ label: p.name, value: String(p.id) }))}
                        value={formData.payee_id}
                        onValueChange={(val) => {
                            const match = payees.find(p => String(p.id) === val);
                            setFormData({ 
                                ...formData, 
                                payee_id: val, 
                                payee_name: match ? match.name : formData.payee_name 
                            });
                        }}
                        onSearchChange={(s) => {
                            // If user is searching/typing something that doesn't exist, we track it as the name
                            const match = payees.find(p => p.name.toLowerCase() === s.toLowerCase());
                            if (match) {
                                setFormData({ ...formData, payee_id: String(match.id), payee_name: match.name });
                            } else {
                                setFormData({ ...formData, payee_id: "", payee_name: s });
                            }
                        }}
                        placeholder="Search or type a new payee..."
                        className="h-12 font-bold rounded-xl"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expense Account</Label>
                        <Select onValueChange={(v) => setFormData({ ...formData, expense_account_id: v })} value={formData.expense_account_id}>
                            <SelectTrigger className="h-12 font-bold rounded-xl bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {expenseAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={String(acc.id)} className="font-bold">
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Paid From</Label>
                        <Select onValueChange={(v) => setFormData({ ...formData, payment_account_id: v })} value={formData.payment_account_id}>
                            <SelectTrigger className="h-12 font-bold rounded-xl bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Select bank/cash..." />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={String(acc.id)} className="font-bold text-primary">
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Method</Label>
                        <Select onValueChange={(v: any) => setFormData({ ...formData, payment_method: v })} value={formData.payment_method}>
                            <SelectTrigger className="h-12 font-bold rounded-xl bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash" className="font-bold">Cash Payment</SelectItem>
                                <SelectItem value="Cheque" className="font-bold">Bank Cheque</SelectItem>
                                <SelectItem value="TT" className="font-bold">TT (Telegraphic Transfer)</SelectItem>
                                <SelectItem value="Bank Transfer" className="font-bold">Bank Direct Transfer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.payment_method === 'Cheque' && (
                        <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-rose-600 ml-1">Cheque Number</Label>
                            <Input 
                                placeholder="Enter cheque #" 
                                className="h-12 font-bold rounded-xl border-rose-200 bg-rose-50/30" 
                                value={formData.cheque_no}
                                onChange={(e) => setFormData({ ...formData, cheque_no: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {formData.payment_method === 'TT' && (
                        <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">TT Ref / Switft Code</Label>
                            <Input 
                                placeholder="e.g. TT-987654" 
                                className="h-12 font-bold rounded-xl border-blue-200 bg-blue-50/30" 
                                value={formData.tt_ref_no}
                                onChange={(e) => setFormData({ ...formData, tt_ref_no: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {(formData.payment_method === 'Cash' || formData.payment_method === 'Bank Transfer') && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reference / Bill No (Optional)</Label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    placeholder="e.g., Bill #987654321" 
                                    className="pl-10 h-12 font-bold rounded-xl" 
                                    value={formData.reference_no}
                                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                        Recording this voucher will automatically post a journal entry and reduce your selected bank/cash balance.
                    </p>
                </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50/50 dark:bg-slate-900/50 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 font-bold rounded-xl">
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-12 px-10 font-black italic uppercase tracking-tight bg-primary shadow-xl shadow-primary/20 rounded-xl">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                    Confirm & Post Payment
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post-Creation Print Options Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
            <div className="bg-emerald-600 p-8 text-white text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Voucher Posted!</h2>
                <p className="text-emerald-50 font-medium mt-1">Transaction recorded in general ledger.</p>
            </div>
            <div className="p-8 space-y-4">
                <p className="text-sm font-bold text-slate-500 text-center mb-4 italic">What would you like to print now?</p>
                <div className="grid grid-cols-1 gap-3">
                    <Button 
                        variant="outline" 
                        className="h-14 justify-start px-6 gap-4 border-slate-200 rounded-xl hover:bg-slate-50 text-slate-900"
                        onClick={() => {
                            const token = window.localStorage.getItem('auth_token');
                            window.open(`/accounting/expenses/print/${lastCreatedId}?format=voucher&autoprint=1`, '_blank');
                        }}
                    >
                        <FileText className="w-5 h-5 text-primary" />
                        <div className="text-left">
                            <p className="font-black uppercase text-xs tracking-widest">Payment Voucher</p>
                            <p className="text-[10px] text-muted-foreground font-medium">Standard office copy for filing</p>
                        </div>
                    </Button>

                    {formData.payment_method === 'Cheque' && (
                        <Button 
                            variant="outline" 
                            className="h-14 justify-start px-6 gap-4 border-rose-200 rounded-xl hover:rose-50 text-slate-900"
                            onClick={() => {
                                window.open(`/accounting/expenses/print/${lastCreatedId}?format=cheque&autoprint=1`, '_blank');
                            }}
                        >
                            <CreditCard className="w-5 h-5 text-rose-500" />
                            <div className="text-left">
                                <p className="font-black uppercase text-xs tracking-widest">Bank Cheque</p>
                                <p className="text-[10px] text-muted-foreground font-medium">Print directly on cheque leaf</p>
                            </div>
                        </Button>
                    )}

                    {formData.payment_method === 'TT' && (
                        <Button 
                            variant="outline" 
                            className="h-14 justify-start px-6 gap-4 border-blue-200 rounded-xl hover:bg-blue-50 text-slate-900"
                            onClick={() => {
                                window.open(`/accounting/expenses/print/${lastCreatedId}?format=tt&autoprint=1`, '_blank');
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

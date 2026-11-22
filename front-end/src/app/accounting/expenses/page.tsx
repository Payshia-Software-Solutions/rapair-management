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
    AlertCircle,
    RefreshCw
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/accounting/page-shell";
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
      toast(res.approval === "Pending"
        ? { title: "Sent for approval", description: `${res.message}. It is posted to the accounts once approved.` }
        : { title: "Success", description: "Expense voucher recorded successfully" });
      if (res.approval === "Pending") window.dispatchEvent(new Event("approvals:changed"));
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

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openPrint = (id: number | string | null, f: string, auto = false) =>
    window.open(`/accounting/expenses/print/${id}?format=${f}${auto ? "&autoprint=1" : ""}`, "_blank");

  return (
    <DashboardLayout title="Expenses">
      <div className="space-y-5">
        <PageHeader
          title="Expenses"
          description="Utility bills, service fees and other operational payment vouchers."
          actions={<>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Record payment</Button>
          </>}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="This month (LKR)" value={fmt(totalThisMonth)} icon={<Wallet />} />
          <StatCard label="Vouchers" value={items.length} icon={<Receipt />} />
          <StatCard label="Top category" value={<span className="block truncate">{summary?.top_categories?.[0]?.category || "—"}</span>} icon={<TrendingDown />} />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9 h-9" placeholder="Search by voucher #, payee or account…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search expenses" />
            </div>
          </div>

          {loading ? <LoadingState /> : filtered.length === 0 ? (
            <EmptyState
              title={query ? "No matching expenses" : "No expenses yet"}
              description={query ? "Try a different search." : "Record your first payment voucher to start tracking spending."}
              action={!query && <Button size="sm" onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Record payment</Button>}
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Voucher</TableHead>
                  <TableHead className="text-xs">Payee</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Paid from</TableHead>
                  <TableHead className="text-xs text-right">Amount (LKR)</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const cancelled = item.status === "Cancelled";
                  return (
                    <TableRow key={item.id} className={cancelled ? "text-muted-foreground" : undefined}>
                      <TableCell>
                        <p className="font-medium">{item.voucher_no}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{format(new Date(item.payment_date), "MMM dd, yyyy")}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{item.payee_name}</p>
                        <p className="text-xs text-muted-foreground">{item.reference_no ? `Ref: ${item.reference_no}` : item.payment_method}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{item.expense_account_name}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{item.payment_account_name}</TableCell>
                      <TableCell className="text-right">
                        <p className={`tabular-nums font-medium ${cancelled ? "line-through" : ""}`}>{fmt(item.amount)}</p>
                        {cancelled && <Badge variant="destructive" className="mt-1 font-normal">Cancelled</Badge>}
                        {item.status === "Pending" && <Badge variant="outline" className="mt-1 font-normal">Awaiting approval</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${item.voucher_no}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Print</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openPrint(item.id, "voucher")}><FileText className="h-4 w-4 mr-2" /> Payment voucher</DropdownMenuItem>
                            {item.payment_method === "Cheque" && (
                              <DropdownMenuItem onClick={() => openPrint(item.id, "cheque")}><CreditCard className="h-4 w-4 mr-2" /> Cheque</DropdownMenuItem>
                            )}
                            {item.payment_method === "TT" && (
                              <DropdownMenuItem onClick={() => openPrint(item.id, "tt")}><Printer className="h-4 w-4 mr-2" /> TT instruction letter</DropdownMenuItem>
                            )}
                            {!cancelled && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setCancellingItem(item); setCancelReason(""); setIsCancelDialogOpen(true); }}>
                                  <XCircle className="h-4 w-4 mr-2" /> Cancel voucher
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>Posts a journal entry and reduces the selected bank or cash balance.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-date">Payment date</Label>
                <Input id="e-date" type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-amount">Amount (LKR)</Label>
                <Input id="e-amount" type="number" step="0.01" placeholder="0.00" className="tabular-nums" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payee</Label>
              <SearchableSelect
                options={payees.map(p => ({ label: p.name, value: String(p.id) }))}
                value={formData.payee_id}
                onValueChange={(val) => {
                  const match = payees.find(p => String(p.id) === val);
                  setFormData({ ...formData, payee_id: val, payee_name: match ? match.name : formData.payee_name });
                }}
                onSearchChange={(s) => {
                  // Typing a name that doesn't exist yet keeps it as a new payee name.
                  const match = payees.find(p => p.name.toLowerCase() === s.toLowerCase());
                  if (match) setFormData({ ...formData, payee_id: String(match.id), payee_name: match.name });
                  else setFormData({ ...formData, payee_id: "", payee_name: s });
                }}
                placeholder="Search or type a new payee…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-exp">Expense account</Label>
                <Select onValueChange={(v) => setFormData({ ...formData, expense_account_id: v })} value={formData.expense_account_id}>
                  <SelectTrigger id="e-exp"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map(acc => <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-pay">Paid from</Label>
                <Select onValueChange={(v) => setFormData({ ...formData, payment_account_id: v })} value={formData.payment_account_id}>
                  <SelectTrigger id="e-pay"><SelectValue placeholder="Select bank or cash" /></SelectTrigger>
                  <SelectContent>
                    {paymentAccounts.map(acc => <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-method">Payment method</Label>
                <Select onValueChange={(v: any) => setFormData({ ...formData, payment_method: v })} value={formData.payment_method}>
                  <SelectTrigger id="e-method"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="TT">TT (telegraphic transfer)</SelectItem>
                    <SelectItem value="Bank Transfer">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_method === "Cheque" && (
                <div className="space-y-1.5">
                  <Label htmlFor="e-cheque">Cheque number</Label>
                  <Input id="e-cheque" placeholder="Cheque #" value={formData.cheque_no} onChange={(e) => setFormData({ ...formData, cheque_no: e.target.value })} required />
                </div>
              )}
              {formData.payment_method === "TT" && (
                <div className="space-y-1.5">
                  <Label htmlFor="e-tt">TT reference / SWIFT</Label>
                  <Input id="e-tt" placeholder="e.g. TT-987654" value={formData.tt_ref_no} onChange={(e) => setFormData({ ...formData, tt_ref_no: e.target.value })} required />
                </div>
              )}
              {(formData.payment_method === "Cash" || formData.payment_method === "Bank Transfer") && (
                <div className="space-y-1.5">
                  <Label htmlFor="e-ref">Reference / bill no. <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="e-ref" placeholder="e.g. Bill #987654321" value={formData.reference_no} onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Post payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Payment posted</DialogTitle>
            <DialogDescription>The voucher was recorded in the general ledger. Print a copy?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={() => openPrint(lastCreatedId, "voucher", true)}>
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" /> Payment voucher
            </Button>
            {formData.payment_method === "Cheque" && (
              <Button variant="outline" className="justify-start" onClick={() => openPrint(lastCreatedId, "cheque", true)}>
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" /> Cheque
              </Button>
            )}
            {formData.payment_method === "TT" && (
              <Button variant="outline" className="justify-start" onClick={() => openPrint(lastCreatedId, "tt", true)}>
                <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> TT instruction letter
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPrintModal(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelDialogOpen} onOpenChange={(v) => { setIsCancelDialogOpen(v); if (!v) setCancellingItem(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Cancel voucher {cancellingItem?.voucher_no}?</DialogTitle>
            <DialogDescription>A reversing journal entry is posted. The voucher stays on record as cancelled.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="e-cancel">Reason</Label>
            <Textarea id="e-cancel" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this voucher being cancelled?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>Keep voucher</Button>
            <Button variant="destructive" onClick={handleCancelExpense} disabled={isCancelling || !cancelReason.trim()}>
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Cancel voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Landmark, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft,
  Calendar,
  Wallet,
  Coins,
  ShieldCheck,
  History,
  FileSearch,
  Check,
  Loader2
} from "lucide-react";
import { 
  fetchAccounts, 
  fetchUnreconciledTransactions, 
  finalizeReconciliation,
  fetchReconciliationHistory 
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, LoadingState, EmptyState } from "@/components/accounting/page-shell";

export default function BankReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Reconciliation parameters
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState<string>("0");
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  // Calculations
  const selectedAccData = bankAccounts.find(a => String(a.id) === selectedAccount);
  const currentSystemBalance = Number(selectedAccData?.balance || 0);
  
  const clearedTotal = transactions
    .filter(t => checkedIds.includes(t.id))
    .reduce((sum, t) => sum + (Number(t.debit) - Number(t.credit)), 0);
    
  const difference = Number(statementBalance) - (currentSystemBalance + clearedTotal); // Simple logic: Statement should match System + Cleared Diff? 
  // Actually, standard logic: System Balance = (Statement Balance - Uncleared Items).
  // Better: Cleared Balance (System + Ticked) vs Statement Balance.
  // We'll use: Diff = Statement Balance - (Adjusted System Balance).
  // Standard Recon: 
  // Adjusted Bank = Statement + Deposits in Transit - Outstanding Checks
  // Adjusted Book = System Balance + Cleared Corrected
  // Let's keep it simple: We are "ticking" off what IS in the statement.
  // The "Statement Balance" must equal the "Balance of Ticked Items in the system".
  
  // Revised Logic for this module:
  // "Balance as of Statement Date" = (Sum of all reconciled items up to now) + (Sum of items we just ticked).
  // So: Difference = Statement Balance - (Running Total of Ticked Transactions + Previous Reconciled Balance).
  // But wait, our 'balance' in acc_accounts is already the current total.
  // Let's use: Difference = Statement Balance - (sum of all items already reconciled + sum of items currently checked).
  
  const loadInitialData = async () => {
    try {
      const accounts = await fetchAccounts({ type: 'ASSET' });
      // Only ledgers tagged as Bank (set in Chart of Accounts) are reconciled against a statement.
      const banks = accounts.filter((a: any) => a.category === 'Bank' && !Number(a.is_group));
      setBankAccounts(banks);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load bank accounts", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadTransactions = async (accountId: string) => {
    setLoading(true);
    setLoadError(null);
    setCheckedIds([]);
    try {
      const [txs, hist] = await Promise.all([
        fetchUnreconciledTransactions(Number(accountId), statementDate),
        fetchReconciliationHistory(Number(accountId))
      ]);
      setTransactions(txs);
      setHistory(hist);
    } catch (error: any) {
      setTransactions([]);
      setHistory([]);
      setLoadError(error?.message || "Failed to load transactions");
      toast({ title: "Error", description: "Failed to load transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Re-load when the statement date changes, so only items up to that date are listed.
  useEffect(() => {
    if (selectedAccount) void loadTransactions(selectedAccount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementDate]);

  const handleAccountChange = (val: string) => {
    setSelectedAccount(val);
    loadTransactions(val);
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFinalize = async () => {
    if (Math.abs(difference) > 0.01) {
      toast({ title: "Warning", description: "Reconciliation not balanced. Difference must be zero.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await finalizeReconciliation({
        account_id: selectedAccount,
        statement_date: statementDate,
        statement_balance: Number(statementBalance),
        cleared_balance: currentSystemBalance + clearedTotal,
        difference: difference,
        cleared_item_ids: checkedIds,
        userId: 1 // TODO: Get from session
      });
      
      toast({ title: "Success", description: "Reconciliation finalized successfully!" });
      loadTransactions(selectedAccount);
    } catch (error) {
      toast({ title: "Error", description: "Finalization failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balanced = Math.abs(difference) < 0.01;

  return (
    <DashboardLayout title="Bank Reconciliation">
      <div className="space-y-5">
        <PageHeader
          title="Bank Reconciliation"
          description="Match ledger transactions against your bank statement."
          actions={selectedAccount ? (
            <Button variant="outline" onClick={() => loadTransactions(selectedAccount)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
          ) : undefined}
        />

        <Tabs defaultValue="reconcile" className="w-full">
          <TabsList>
            <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="reconcile" className="mt-4">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5">
                <Card className="p-4 space-y-4">
                  <h2 className="font-semibold">Statement</h2>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-acc">Bank account</Label>
                    <Select value={selectedAccount} onValueChange={handleAccountChange}>
                      <SelectTrigger id="r-acc" disabled={!bankAccounts.length}>
                        <SelectValue placeholder={bankAccounts.length ? "Select an account" : "No bank accounts yet"} />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={String(acc.id)}>{acc.code} · {acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!bankAccounts.length && (
                      <p className="text-xs text-muted-foreground">
                        Add a bank ledger under Cash &amp; Bank in the <Link href="/accounting/accounts" className="underline underline-offset-2">Chart of Accounts</Link>.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-date">Statement end date</Label>
                    <Input id="r-date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-bal">Statement end balance (LKR)</Label>
                    <Input id="r-bal" type="number" step="0.01" className="tabular-nums" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
                  </div>
                </Card>

                <Card className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ledger balance</span>
                    <span className="tabular-nums">{fmt(currentSystemBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cleared items</span>
                    <span className="tabular-nums">{clearedTotal >= 0 ? "+" : ""}{fmt(clearedTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="font-medium">Difference</span>
                    <div className="text-right">
                      <p className={`font-semibold tabular-nums ${balanced ? "text-emerald-600" : "text-destructive"}`}>LKR {fmt(difference)}</p>
                      {selectedAccount && <Badge variant={balanced ? "secondary" : "destructive"} className="font-normal">{balanced ? "Balanced" : "Out of balance"}</Badge>}
                    </div>
                  </div>
                  <Button onClick={handleFinalize} disabled={submitting || !selectedAccount || !balanced} className="w-full">
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />}
                    Finalize reconciliation
                  </Button>
                </Card>
              </div>

              <Card className="overflow-hidden lg:col-span-2">
                <div className="flex items-center justify-between gap-2 border-b p-3">
                  <div>
                    <h2 className="font-semibold">Unreconciled transactions</h2>
                    <p className="text-xs text-muted-foreground">Tick the items that appear on your bank statement.</p>
                  </div>
                  <p className="text-sm tabular-nums text-muted-foreground"><span className="font-medium text-foreground">{checkedIds.length}</span> / {transactions.length} selected</p>
                </div>
                {!selectedAccount ? (
                  <EmptyState title="No account selected" description="Pick a bank account to load its unreconciled transactions." />
                ) : loading ? <LoadingState /> : loadError ? (
                  <EmptyState
                    title="Couldn't load transactions"
                    description={loadError}
                    action={<Button size="sm" variant="outline" onClick={() => loadTransactions(selectedAccount)}>Try again</Button>}
                  />
                ) : transactions.length === 0 ? (
                  <EmptyState title="All caught up" description="Every transaction on this account is reconciled." />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10"><span className="sr-only">Cleared</span></TableHead>
                        <TableHead className="text-xs w-28">Date</TableHead>
                        <TableHead className="text-xs">Details</TableHead>
                        <TableHead className="text-xs text-right w-32">Debit</TableHead>
                        <TableHead className="text-xs text-right w-32">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => {
                        const on = checkedIds.includes(t.id);
                        return (
                          <TableRow key={t.id} data-state={on ? "selected" : undefined} className="cursor-pointer" onClick={() => toggleCheck(t.id)}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={on} onCheckedChange={() => toggleCheck(t.id)} aria-label={`Mark ${t.entry_description} as cleared`} />
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">{new Date(t.entry_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <p className="font-medium">{t.entry_description}</p>
                              <p className="text-xs text-muted-foreground">{[t.notes, t.ref_type && `${t.ref_type} #${t.ref_id}`].filter(Boolean).join(" · ") || "—"}</p>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{Number(t.debit) > 0 ? fmt(t.debit) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(t.credit) > 0 ? fmt(t.credit) : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="overflow-hidden">
              {!selectedAccount ? (
                <EmptyState title="No account selected" description="Pick a bank account on the Reconcile tab to see its history." />
              ) : history.length === 0 ? (
                <EmptyState title="No reconciliations yet" description="Finalized reconciliations for this account appear here." />
              ) : (
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Reconciled on</TableHead>
                      <TableHead className="text-xs">Statement date</TableHead>
                      <TableHead className="text-xs text-right">Book balance</TableHead>
                      <TableHead className="text-xs text-right">Statement balance</TableHead>
                      <TableHead className="text-xs text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{new Date(h.created_at).toLocaleString()}</TableCell>
                        <TableCell className="tabular-nums">{new Date(h.statement_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(h.cleared_balance)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(h.statement_balance)}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary" className="font-normal">Finalized</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

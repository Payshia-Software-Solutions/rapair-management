"use client";

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
import { Button } from "@/components/ui/button";
import { RefreshCw, Printer, ShieldCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, LoadingState, EmptyState } from "@/components/accounting/page-shell";
import { fetchAccounts, fetchCompany, type CompanyRow, fetchAccountingSettings, contentUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function TrialBalancePage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState("");
  const { toast } = useToast();

  const totalDebits = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance) || 0;
    return sum + (bal > 0 ? bal : 0);
  }, 0);
  
  const totalCredits = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance) || 0;
    return sum + (bal < 0 ? Math.abs(bal) : 0);
  }, 0);

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const loadTrialBalance = async () => {
    if (!asOfDate) return;
    setLoading(true);
    try {
      const [accs, comp] = await Promise.all([
        fetchAccounts({ asOf: asOfDate }),
        fetchCompany().catch(() => null)
      ]);
      setAccounts(accs || []);
      setCompany(comp);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load Trial Balance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchAccountingSettings();
        setAsOfDate(settings.fy_end || new Date().toISOString().split('T')[0]);
      } catch (err) {
        setAsOfDate(new Date().toISOString().split('T')[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (asOfDate) {
      loadTrialBalance();
    }
  }, [asOfDate]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = accounts.filter(a => (Number(a.balance) || 0) !== 0);

  return (
    <DashboardLayout title="Trial Balance">
      <div className="space-y-5">
        <PageHeader
          title="Trial Balance"
          description={<>Ledger balances as of <span className="font-medium text-foreground tabular-nums">{asOfDate || "—"}</span></>}
          actions={<>
            <div className="flex items-center gap-2">
              <Label htmlFor="tb-asof" className="text-xs text-muted-foreground whitespace-nowrap">As of</Label>
              <Input id="tb-asof" type="date" className="h-9 w-40" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={loadTrialBalance} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button onClick={() => window.open(`/accounting/trial-balance/print?asOf=${asOfDate}`, "_blank")}>
              <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print
            </Button>
          </>}
        />

        {!loading && accounts.length > 0 && (
          <div className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${isBalanced ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            {isBalanced
              ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              : <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />}
            <div>
              <p className="font-medium">{isBalanced ? "Ledger is balanced" : "Out of balance"}</p>
              <p className="text-muted-foreground">
                {isBalanced ? "Total debits equal total credits." : `Difference of LKR ${fmt(Math.abs(totalDebits - totalCredits))}. Check for unposted or one-sided journals.`}
              </p>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          {loading ? <LoadingState /> : rows.length === 0 ? (
            <EmptyState title="No balances" description="No ledger entries found up to this date." />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-32">Code</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs text-right w-44">Debit (LKR)</TableHead>
                  <TableHead className="text-xs text-right w-44">Credit (LKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((acc) => {
                  const bal = Number(acc.balance) || 0;
                  return (
                    <TableRow key={acc.id}>
                      <TableCell className="tabular-nums text-muted-foreground">{acc.code}</TableCell>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{bal > 0 ? fmt(bal) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{bal < 0 ? fmt(Math.abs(bal)) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell colSpan={2} className="text-right">Total</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totalDebits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totalCredits)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

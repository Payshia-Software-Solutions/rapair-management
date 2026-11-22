"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchFiscalPeriods, 
  createFiscalYear, 
  activateFiscalYear,
  fetchFiscalSummary,
  postFiscalClose 
} from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarDays, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  Lock,
  History,
  Info,
  Play,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/accounting/page-shell";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";

export default function FiscalManagementPage() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  
  // Closing Wizard State
  const [closingRecord, setClosingRecord] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [newYear, setNewYear] = useState({
    name: `FY ${new Date().getFullYear() + 1}`,
    start_date: `${new Date().getFullYear() + 1}-01-01`,
    end_date: `${new Date().getFullYear() + 1}-12-31`
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchFiscalPeriods();
      setPeriods(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!newYear.name || !newYear.start_date || !newYear.end_date) return;
    setCreating(true);
    try {
      await createFiscalYear(newYear);
      toast({ title: "Success", description: "New Fiscal Year created." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActivatingId(id);
    try {
      await activateFiscalYear(id);
      toast({ title: "Year Activated", description: "Reports will now default to this period." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  const handleOpenClosing = async (record: any) => {
    setClosingRecord(record);
    setCalculating(true);
    try {
      const data = await fetchFiscalSummary(record.id);
      setSummary(data);
    } catch (err: any) {
      toast({ title: "Audit Error", description: err.message, variant: "destructive" });
      setClosingRecord(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleFinalizeClosing = async () => {
    if (!closingRecord || !summary) return;
    
    setProcessing(true);
    try {
      await postFiscalClose({
        id: closingRecord.id,
        name: `Final Closing: ${closingRecord.name}`
      });
      toast({ title: "Year Locked", description: "Permanent closing entries have been posted." });
      setClosingRecord(null);
      setSummary(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Closing Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <DashboardLayout title="Fiscal Years">
      <div className="space-y-5">
        <PageHeader
          title="Fiscal Years"
          description="Define, activate and close financial years. Transaction dates are validated against open periods."
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-4 space-y-4 h-fit">
            <div>
              <h2 className="font-semibold">New fiscal year</h2>
              <p className="text-sm text-muted-foreground">Plan an upcoming period.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fy-name">Name</Label>
              <Input id="fy-name" value={newYear.name} onChange={e => setNewYear({ ...newYear, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fy-start">Start date</Label>
                <Input id="fy-start" type="date" value={newYear.start_date} onChange={e => setNewYear({ ...newYear, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fy-end">End date</Label>
                <Input id="fy-end" type="date" value={newYear.end_date} onChange={e => setNewYear({ ...newYear, end_date: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 mr-2" aria-hidden="true" />}
              Create fiscal year
            </Button>
          </Card>

          <div className="space-y-5 lg:col-span-2">
            <Card className="overflow-hidden">
              {loading ? <LoadingState /> : periods.length === 0 ? (
                <EmptyState title="No fiscal years" description="Create your first fiscal year to start posting." />
              ) : (
                <div className="divide-y">
                  {periods.map((p) => (
                    <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{p.name}</p>
                          <Badge variant={p.is_closed ? "secondary" : p.is_active ? "default" : "outline"}>
                            {p.is_closed ? "Closed" : p.is_active ? "Active" : "Open"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground tabular-nums">{p.start_date} — {p.end_date}</p>
                        {p.is_closed && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <History className="h-3 w-3" aria-hidden="true" />
                            Closed {new Date(p.closed_at).toLocaleDateString()} · Entry #{p.closing_entry_id}
                          </p>
                        )}
                      </div>
                      {!p.is_closed && (
                        <div className="flex shrink-0 gap-2">
                          {!p.is_active && (
                            <Button variant="outline" size="sm" onClick={() => handleActivate(p.id)} disabled={activatingId === p.id}>
                              {activatingId === p.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 mr-1" aria-hidden="true" />}
                              Activate
                            </Button>
                          )}
                          <Button size="sm" onClick={() => handleOpenClosing(p)}>
                            <Lock className="h-4 w-4 mr-1" aria-hidden="true" /> Close year
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                The <span className="font-medium text-foreground">active</span> year is the default filter for reports.
                Once a year is <span className="font-medium text-foreground">closed</span>, no transactions can be posted or changed in its date range. Finish reconciliations before closing.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={!!closingRecord} onOpenChange={(open) => !open && setClosingRecord(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Close {closingRecord?.name}</SheetTitle>
            <SheetDescription>Post closing entries and lock this period.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {calculating ? <LoadingState label="Calculating balances…" /> : summary ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Income" value={fmt(summary.total_income)} />
                  <StatCard label="Expenses" value={fmt(summary.total_expense)} />
                  <StatCard label="Net profit" value={fmt(summary.net_profit)} />
                </div>

                <Card className="overflow-hidden">
                  <h3 className="border-b px-4 py-2 text-sm font-semibold">Accounts to be closed</h3>
                  <div className="divide-y text-sm">
                    {[...summary.income, ...summary.expenses].map((acc: any) => (
                      <div key={acc.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.code} · {acc.type}</p>
                        </div>
                        <p className="tabular-nums">{fmt(Math.abs(acc.period_balance))}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <p className="text-muted-foreground">
                    Net profit of <span className="font-medium text-foreground tabular-nums">LKR {fmt(summary.net_profit)}</span> moves to Retained Earnings and all income and expense accounts are zeroed.
                    This locks the year and <span className="font-medium text-foreground">cannot be undone</span> from the app.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <SheetFooter className="border-t p-4">
            <Button variant="outline" onClick={() => setClosingRecord(null)}>Cancel</Button>
            <Button variant="destructive" disabled={processing || calculating || !summary} onClick={handleFinalizeClosing}>
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4 mr-2" aria-hidden="true" />}
              Close and lock year
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
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
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  Save, 
  CheckCircle2,
  Info,
  Loader2
} from "lucide-react";
import { 
  fetchAccountMappings, 
  updateAccountMapping, 
  fetchAccounts,
  fetchAccountingSettings,
  updateAccountingSettings,
  fetchFiscalPeriods,
  activateFiscalYear
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, LoadingState } from "@/components/accounting/page-shell";

export default function AccountingSettingsPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYear, setFiscalYear] = useState({ fy_start: "", fy_end: "" });
  const [fiscalPeriods, setFiscalPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingData, accountData, settings, periods] = await Promise.all([
        fetchAccountMappings(),
        fetchAccounts(),
        fetchAccountingSettings(),
        fetchFiscalPeriods()
      ]);
      setMappings(mappingData || []);
      setAccounts(accountData || []);
      setFiscalPeriods(periods || []);
      setFiscalYear({
        fy_start: settings.fy_start || "",
        fy_end: settings.fy_end || ""
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load accounting configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateMapping = async (key: string, accountId: number) => {
    setSaving(key);
    try {
      await updateAccountMapping(key, accountId);
      toast({
        title: "Success",
        description: "Transaction mapping updated successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update mapping",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateFiscal = async (id: number) => {
    setSavingFiscal(true);
    try {
      await activateFiscalYear(id);
      toast({
        title: "Record Activated",
        description: "The selected Fiscal Year is now the operational default.",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate fiscal record",
        variant: "destructive",
      });
    } finally {
      setSavingFiscal(false);
    }
  };

  const categories = Array.from(new Set(mappings.map(m => m.category)));

  return (
    <DashboardLayout title="Accounting Settings">
      <div className="space-y-5">
        <PageHeader
          title="Accounting Settings"
          description="Active fiscal year and how business events map to your Chart of Accounts."
          actions={
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
          }
        />

        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Active fiscal year</h2>
              <p className="text-sm text-muted-foreground">Trial Balance and statements default to this period.</p>
            </div>
            <Button variant="outline" size="sm" asChild><Link href="/accounting/fiscal-years">Manage years</Link></Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-fy">Fiscal year</Label>
              <Select
                value={fiscalPeriods.find(p => p.is_active)?.id?.toString()}
                onValueChange={(val) => handleUpdateFiscal(parseInt(val))}
                disabled={savingFiscal}
              >
                <SelectTrigger id="s-fy"><SelectValue placeholder="Select fiscal year" /></SelectTrigger>
                <SelectContent>
                  {fiscalPeriods.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}{p.is_closed ? " (closed)" : ""} · <span className="text-muted-foreground tabular-nums">{p.start_date} → {p.end_date}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Enforced period</Label>
              <p className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums">
                {fiscalYear.fy_start || "—"} to {fiscalYear.fy_end || "—"}
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Changing a mapping affects future postings only.</span>{" "}
            Existing journal entries are not updated. Change mappings outside business hours to avoid reconciliation gaps.
            Need an account that isn't listed? Create it in the <Link href="/accounting/accounts" className="font-medium text-foreground underline underline-offset-2">Chart of Accounts</Link> first.
          </p>
        </div>

        {loading && !mappings.length ? <Card><LoadingState /></Card> : categories.map(category => (
          <Card key={category} className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">{category}</h2>
              <p className="text-xs text-muted-foreground">Accounts used for {String(category).toLowerCase()} transactions.</p>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Transaction</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Key</TableHead>
                  <TableHead className="text-xs w-[380px]">Linked account</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.filter(m => m.category === category).map((mapping) => (
                  <TableRow key={mapping.map_key}>
                    <TableCell className="font-medium">{mapping.label}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{mapping.map_key}</code>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={saving === mapping.map_key}
                        value={mapping.account_id.toString()}
                        onValueChange={(val) => handleUpdateMapping(mapping.map_key, parseInt(val))}
                      >
                        <SelectTrigger aria-label={`Account for ${mapping.label}`}><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>
                              <span className="tabular-nums text-muted-foreground">{acc.code}</span> {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {saving === mapping.map_key
                        ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" />
                        : <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="Saved" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

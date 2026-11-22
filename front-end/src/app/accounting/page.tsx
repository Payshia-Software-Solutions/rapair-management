"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  History,
  LayoutGrid,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileText,
  Receipt,
  Landmark,
  ChevronRight,
} from "lucide-react";
import { fetchAccounts } from "@/lib/api";
import { PageHeader, StatCard } from "@/components/accounting/page-shell";

const quickLinks = [
  { title: "Journal Entries", icon: History, href: "/accounting/journal", desc: "Audit trail of posted transactions" },
  { title: "Chart of Accounts", icon: LayoutGrid, href: "/accounting/accounts", desc: "Account structure and balances" },
  { title: "Trial Balance", icon: BarChart3, href: "/accounting/trial-balance", desc: "Check debits equal credits" },
  { title: "Financial Statements", icon: FileText, href: "/accounting/statements", desc: "P&L and balance sheet" },
  { title: "Expenses", icon: Receipt, href: "/accounting/expenses", desc: "Record payment vouchers" },
  { title: "Bank Reconciliation", icon: Landmark, href: "/accounting/reconciliation", desc: "Match against bank statements" },
];

const automated = [
  { title: "Sale invoices", desc: "Revenue and accounts receivable" },
  { title: "Customer payments", desc: "Cash and accounts receivable" },
  { title: "Goods receipts (GRN)", desc: "Inventory and accounts payable" },
];

export default function AccountingOverviewPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts()
      .then(data => setAccounts(data || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const totalIncome = accounts.filter(a => a.type === "INCOME").reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
  const totalExpense = accounts.filter(a => a.type === "EXPENSE").reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
  const netProfit = totalIncome - totalExpense;
  const fmt = (n: number) => (loading ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  return (
    <DashboardLayout title="Accounting">
      <div className="space-y-5">
        <PageHeader
          title="Accounting"
          description="Sales, payments and purchases post to the ledger automatically."
          actions={<>
            <Button variant="outline" asChild><Link href="/accounting/accounts">Chart of accounts</Link></Button>
            <Button asChild><Link href="/accounting/journal">Journal entries</Link></Button>
          </>}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total income (LKR)" value={fmt(totalIncome)} icon={<ArrowUpRight />} />
          <StatCard label="Total expenses (LKR)" value={fmt(totalExpense)} icon={<ArrowDownRight />} />
          <StatCard
            label="Net profit (LKR)"
            value={<span className={!loading && netProfit < 0 ? "text-destructive" : undefined}>{fmt(netProfit)}</span>}
            icon={<TrendingUp />}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="flex h-full items-center gap-3 p-4 transition-colors group-hover:bg-muted/40">
                <div className="rounded-md bg-muted p-2 text-muted-foreground"><link.icon className="h-4 w-4" aria-hidden="true" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{link.title}</p>
                  <p className="text-sm text-muted-foreground">{link.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Automatic postings</h2>
            <p className="text-xs text-muted-foreground">These business events create journal entries without manual input.</p>
          </div>
          <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {automated.map((a) => (
              <div key={a.title} className="p-4">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">Posts to {a.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

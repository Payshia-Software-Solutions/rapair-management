"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  History, 
  LayoutGrid, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  TrendingUp,
  Receipt,
  Package,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { fetchAccounts } from "@/lib/api";

export default function AccountingOverviewPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts().then(data => {
      setAccounts(data || []);
      setLoading(false);
    });
  }, []);

  const totalIncome = accounts.filter(a => a.type === 'INCOME').reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
  const totalExpense = accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
  const netProfit = totalIncome - totalExpense;

  const quickLinks = [
    { title: "Journal Entries", icon: History, href: "/accounting/journal", desc: "Audit transactional records", color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Chart of Accounts", icon: LayoutGrid, href: "/accounting/accounts", desc: "Manage financial structure", color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Trial Balance", icon: BarChart3, href: "/accounting/trial-balance", desc: "Verify ledger integrity", color: "text-green-500", bg: "bg-green-500/10" },
    { title: "Balance Sheet", icon: TrendingUp, href: "#", desc: "Statement of position", color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <DashboardLayout title="Accounting Overview">
      <div className="space-y-8 w-full p-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-12 text-primary-foreground shadow-2xl">
          <div className="relative z-10 space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight">Financial Command Center</h1>
            <p className="max-w-xl text-lg opacity-90">
              Your real-time double-entry engine is active. Every sale and purchase is being tracked automatically.
            </p>
            <div className="flex gap-4 pt-4">
               <Button asChild variant="secondary" size="lg" className="rounded-full shadow-lg">
                 <Link href="/accounting/journal">View Audit Trail</Link>
               </Button>
               <Button asChild variant="outline" size="lg" className="rounded-full bg-white/10 border-white/20 hover:bg-white/20">
                 <Link href="/accounting/accounts">Manage Accounts</Link>
               </Button>
            </div>
          </div>
          {/* Abstract background shapes */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-gradient-to-br from-green-500/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Income</CardTitle>
              <div className="rounded-full bg-green-500/20 p-2"><ArrowUpRight className="w-4 h-4 text-green-500" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">LKR {totalIncome.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Aggregated from all revenue streams</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-rose-500/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Expenses</CardTitle>
              <div className="rounded-full bg-rose-500/20 p-2"><ArrowDownRight className="w-4 h-4 text-rose-500" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">LKR {totalExpense.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Operating costs and COGS</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70">Net Profit</CardTitle>
              <div className="rounded-full bg-white/20 p-2"><TrendingUp className="w-4 h-4 text-white" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">LKR {netProfit.toLocaleString()}</div>
              <p className="text-xs opacity-70 mt-2">Financial health of your business</p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickLinks.map((link, i) => (
            <Link key={i} href={link.href}>
              <Card className="group h-full transition-all hover:scale-[1.02] hover:shadow-2xl cursor-pointer overflow-hidden border-none shadow-lg">
                <CardContent className="p-0">
                  <div className={`h-2 w-full ${link.bg}`} />
                  <div className="p-6 space-y-4">
                    <div className={`rounded-xl p-3 w-fit ${link.bg} ${link.color}`}>
                      <link.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      Navigate <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Automated Events Information */}
        <Card className="border-dashed border-2 bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-pulse h-2 w-2 rounded-full bg-green-500" />
              Real-time Automation Active
            </CardTitle>
            <CardDescription>
              The following business events are currently driving your ledger:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-background border">
                <Receipt className="w-8 h-8 text-blue-500 opacity-50" />
                <div>
                  <div className="font-bold text-sm">Sale Invoices</div>
                  <div className="text-[10px] text-muted-foreground">Posts to Revenue & AR</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-background border">
                <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
                <div>
                  <div className="font-bold text-sm">Customer Payments</div>
                  <div className="text-[10px] text-muted-foreground">Posts to Cash & AR</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-background border">
                <Package className="w-8 h-8 text-orange-500 opacity-50" />
                <div>
                  <div className="font-bold text-sm">Goods Receipts (GRN)</div>
                  <div className="text-[10px] text-muted-foreground">Posts to Inventory & AP</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

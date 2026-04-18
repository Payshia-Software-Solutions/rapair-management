"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchSupplierPayments, postSupplierPayment, fetchSuppliers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Receipt, Plus, Loader2, Banknote, CreditCard, Building2, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

const METHOD_ICON: Record<string, React.ReactNode> = {
  Cash: <Banknote className="w-3 h-3" />,
  Card: <CreditCard className="w-3 h-3" />,
  "Bank Transfer": <Building2 className="w-3 h-3" />,
  Cheque: <Receipt className="w-3 h-3" />,
};

export default function VendorPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSupplierPayments({ from_date: fromDate || undefined, to_date: toDate || undefined });
      setPayments(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [fromDate, toDate]);

  const filtered = payments.filter(p =>
    !search ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Vendor Payments</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage and track all payments made to suppliers</p>
          </div>
          <Link href="/vendors/payments/process">
            <Button className="font-bold">
              <Plus className="w-4 h-4 mr-2" /> Record Payment
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by supplier or reference..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input type="date" className="w-38" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-muted-foreground">to</span>
                <Input type="date" className="w-38" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <Receipt className="w-10 h-10 opacity-30" />
                <p className="text-sm">No payments recorded</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Supplier</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reference</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => (
                    <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 font-bold text-primary">{p.supplier_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                          {METHOD_ICON[p.payment_method]}
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{p.reference_no || '-'}</td>
                      <td className="px-4 py-3 text-right font-black tabular-nums">{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

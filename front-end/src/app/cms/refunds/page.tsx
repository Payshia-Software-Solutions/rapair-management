"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Banknote,
  Search,
  Loader2,
  Calendar,
  Printer,
  History,
  ArrowLeftRight,
  Receipt,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchRefunds } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

export default function RefundsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const data = await fetchRefunds();
      setRefunds(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load refunds",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRefunds = refunds.filter((ref) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ref.refund_no?.toLowerCase().includes(query) ||
      ref.invoice_no?.toLowerCase().includes(query) ||
      ref.return_no?.toLowerCase().includes(query) ||
      ref.customer_name?.toLowerCase().includes(query)
    );
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(Number(amount) || 0);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-amber-500 pl-4 uppercase tracking-tighter">Refund Ledger</h2>
            <p className="text-muted-foreground mt-1 text-sm font-medium pl-4">Track and monitor all financial releases and cash-back transactions.</p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10" onClick={loadRefunds} disabled={loading}>
                <RotateCcw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sync Data
             </Button>
             <Button className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 bg-slate-900 hover:bg-slate-800" onClick={() => router.push("/cms/pos")}>
               <Banknote className="w-3.5 h-3.5 mr-2" />
               New Refund
             </Button>
          </div>
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden border border-slate-100 bg-white/80 backdrop-blur-md">
          <CardContent className="p-0">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, Invoice, Return or Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 bg-white h-12 border-slate-200 rounded-2xl shadow-sm ring-offset-amber-500 focus-visible:ring-amber-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-slate-200/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px] font-black uppercase tracking-widest text-[10px] py-4 pl-6 text-slate-400">Refund Document</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-4 text-slate-400">Associations</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-4 text-slate-400">Customer Identity</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-4 text-slate-400">Method</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] py-4 text-slate-400">Value</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] py-4 pr-6 text-slate-400">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
                          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                          <span className="font-black uppercase tracking-widest text-xs">Fetching Financial Records...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredRefunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center shadow-inner">
                            <History className="w-8 h-8 text-slate-200" />
                          </div>
                          <div className="space-y-1">
                             <p className="font-black uppercase tracking-widest text-sm text-slate-400">No Transactions found</p>
                             <p className="text-[10px] font-bold opacity-60">Try adjusting your filters or checking different locations.</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRefunds.map((refund) => (
                      <TableRow key={refund.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 last:border-0 group h-20">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                             <div className="font-black text-amber-600 tracking-tighter text-base leading-tight uppercase">{refund.refund_no || `REF-${refund.id}`}</div>
                             <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                               <Calendar className="w-3 h-3" />
                               <span>{new Date(refund.refund_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-1.5">
                             <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 border-blue-600/20 text-[9px] font-black uppercase py-0.5 rounded-md px-2 shadow-none">
                                  <Receipt className="w-2.5 h-2.5 mr-1" /> {refund.invoice_no}
                                </Badge>
                             </div>
                             {refund.return_no && (
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                 <ArrowLeftRight className="w-3 h-3 text-amber-500/50" />
                                 <span>Doc: {refund.return_no}</span>
                               </div>
                             )}
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-black text-sm tracking-tight text-slate-900 group-hover:text-amber-600 transition-colors uppercase">{refund.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">General Consumer</div>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${refund.payment_method === 'Cash' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                              <span className="font-black uppercase text-[10px] tracking-widest text-slate-600 whitespace-nowrap">
                                 {refund.payment_method}
                              </span>
                           </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-black text-lg tracking-tighter text-slate-950 dark:text-white leading-none">{formatCurrency(refund.amount)}</div>
                          <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 opacity-60">LKR Net Release</div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="h-10 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-sm border-slate-200"
                             onClick={() => window.open(`/cms/refunds/${refund.id}/receipt?autoprint=1`, '_blank')}
                           >
                             <Printer className="w-3.5 h-3.5 mr-2" />
                             Re-Issue
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </DashboardLayout>
  );
}

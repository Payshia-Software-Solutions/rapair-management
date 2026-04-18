"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchAccountLedger, fetchCompany, fetchAccountingSettings, fetchFiscalPeriods } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Printer, 
  FileDown, 
  RefreshCw,
  ArrowLeft,
  Calendar,
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function AccountLedgerPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [account, setAccount] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  // Pagination State
  const [page, setPage] = useState(1);
  const limit = 50;
  
  const { toast } = useToast();

  const loadLedger = async () => {
    if (!id || !fromDate || !toDate) return;
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await fetchAccountLedger(id, { 
        from: fromDate, 
        to: toDate,
        limit: limit,
        offset: offset
      });
      
      setAccount(response.account);
      setItems(response.data || []);
      setTotalRows(response.total || 0);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Strictly load active accounting year dates as defaults
    void (async () => {
      try {
        const [settings, periods] = await Promise.all([
          fetchAccountingSettings(),
          fetchFiscalPeriods()
        ]);
        
        // 1. Try finding explicitly active period
        const activePeriod = periods.find((p: any) => p.is_active == 1 || p.is_active === true);
        
        if (activePeriod) {
          setFromDate(activePeriod.start_date);
          setToDate(activePeriod.end_date);
        } else if (settings.fy_start && settings.fy_end) {
          // 2. Fallback to settings
          setFromDate(settings.fy_start);
          setToDate(settings.fy_end);
        } else {
          // 3. Absolute fallback
          const now = new Date();
          setFromDate(`${now.getFullYear()}-01-01`);
          setToDate(`${now.getFullYear()}-12-31`);
        }
      } catch {
        const now = new Date();
        setFromDate(`${now.getFullYear()}-01-01`);
        setToDate(`${now.getFullYear()}-12-31`);
      }
    })();
  }, []);

  useEffect(() => {
    if (id && fromDate && toDate) loadLedger();
  }, [id, fromDate, toDate, page]);

  const totalPages = Math.ceil(totalRows / limit);

  // Note: Running balance on a paginated set is contextual to the current page view
  let runningBalance = 0; 

  return (
    <DashboardLayout title="Account Ledger">
      <div className="p-6 space-y-6 w-full mx-auto">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full print:hidden">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight">{account?.name || "Account Ledger"}</h1>
                {account && (
                  <Badge variant="outline" className="font-mono font-bold text-primary border-primary/20">
                    {account.code}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm font-medium">Detailed transaction history and audit trail</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 print:hidden">
             <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border border-muted-foreground/10 px-4">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
                />
                <span className="text-muted-foreground mx-1">→</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
                />
             </div>
             <Button 
               variant="outline" 
               size="sm" 
               onClick={() => window.open(`/accounting/accounts/${id}/ledger/print?from=${fromDate}&to=${toDate}`, '_blank')} 
               className="font-bold gap-2 rounded-xl h-10 px-4"
             >
               <Printer className="w-4 h-4" /> Print Full Ledger
             </Button>
             <Button variant="outline" size="icon" onClick={loadLedger} disabled={loading} className="rounded-xl h-10 w-10">
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
        </div>

        {/* Ledger Table */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30 border-b-2">
              <TableRow className="hover:bg-transparent uppercase tabular-nums">
                <TableHead className="w-[120px] font-black tracking-widest text-[10px] py-6 px-8">Date</TableHead>
                <TableHead className="w-[150px] font-black tracking-widest text-[10px]">Reference</TableHead>
                <TableHead className="font-black tracking-widest text-[10px]">Description / Notes</TableHead>
                <TableHead className="text-right w-[150px] font-black tracking-widest text-[10px]">Debit (LKR)</TableHead>
                <TableHead className="text-right w-[150px] font-black tracking-widest text-[10px]">Credit (LKR)</TableHead>
                <TableHead className="text-right w-[180px] font-black tracking-widest text-[10px] px-8">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <RefreshCw className="w-10 h-10 animate-spin mx-auto text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground mt-4 font-medium italic">Calculating ledger entries...</p>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground opacity-10" />
                    <p className="text-sm text-muted-foreground mt-4 font-medium italic">No transactions found for the selected accounting year.</p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const debit = Number(item.debit || 0);
                  const credit = Number(item.credit || 0);
                  
                  // Running balance logic (Current page context)
                  runningBalance += (debit - credit);

                  return (
                    <TableRow key={item.entry_id} className="hover:bg-muted/20 transition-colors group border-b border-muted/50">
                      <TableCell className="font-medium text-slate-500 text-[11px] px-8 font-mono">
                        {new Date(item.entry_date).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-black text-[9px] text-muted-foreground uppercase opacity-60 tracking-tighter">{item.ref_type || 'MANUAL'}</span>
                           <span className="font-bold text-primary text-xs flex items-center gap-1">
                             #{item.ref_id || 'ENTRY'}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-sm">{item.entry_desc}</span>
                            {item.line_notes && (
                              <span className="text-[10px] text-muted-foreground italic truncate max-w-[400px] opacity-70">
                                {item.line_notes}
                              </span>
                            )}
                         </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-blue-700">
                        {debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-rose-700">
                        {credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-900 bg-muted/5 group-hover:bg-muted/10 transition-colors px-8">
                        {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Footer */}
          {!loading && totalRows > 0 && (
            <div className="bg-muted/5 p-4 border-t-2 flex items-center justify-between px-8">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                  Page <span className="text-foreground">{page}</span> of <span className="text-foreground">{totalPages}</span> ({totalRows} Records)
               </p>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="rounded-xl font-bold h-9 shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="rounded-xl font-bold h-9 shadow-sm"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
               </div>
            </div>
          )}
        </Card>

        {/* Closing Summary */}
        <div className="flex justify-end px-8">
           <div className="flex items-center gap-6 border-t-2 border-slate-900 pt-4">
              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Selected Period Position</div>
              <div className="text-2xl font-black tracking-tight tabular-nums text-primary">
                LKR {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="w-[1px] h-6 bg-muted-foreground/20" />
              <p className="text-[9px] text-muted-foreground italic font-bold uppercase tracking-widest opacity-40">
                As of {toDate}
              </p>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

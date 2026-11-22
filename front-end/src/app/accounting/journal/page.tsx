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
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Eye, 
  Calendar,
  FileText,
  History,
  Info,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, LoadingState, EmptyState } from "@/components/accounting/page-shell";
import { fetchJournalEntries, fetchJournalItems } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [entryItems, setEntryItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Filtering & Pagination State
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;
  
  const { toast } = useToast();

  const loadEntries = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await fetchJournalEntries({ 
        from: fromDate, 
        to: toDate, 
        limit, 
        offset 
      });
      
      if (response.status === 'success') {
        setEntries(response.data || []);
        setTotalRows(response.total || 0);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load journal entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Default to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (fromDate && toDate) loadEntries();
  }, [fromDate, toDate, page]);

  const viewEntry = async (entry: any) => {
    setSelectedEntry(entry);
    setLoadingItems(true);
    try {
      const data = await fetchJournalItems(entry.id);
      setEntryItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load entry details",
        variant: "destructive",
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.ref_type && e.ref_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(totalRows / limit);

  const fmt = (n: any) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <DashboardLayout title="Journal Entries">
      <div className="space-y-5">
        <PageHeader
          title="Journal Entries"
          description="Audit log of all posted financial transactions."
          actions={<>
            <Button variant="outline" onClick={loadEntries} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => window.open(`/accounting/journal/print?from=${fromDate}&to=${toDate}`, "_blank")}>
              <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print
            </Button>
            <Button><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> New manual entry</Button>
          </>}
        />

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 items-end gap-3 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="j-from" className="text-xs text-muted-foreground">From</Label>
              <Input id="j-from" type="date" className="h-9" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-to" className="text-xs text-muted-foreground">To</Label>
              <Input id="j-to" type="date" className="h-9" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
            </div>
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9 h-9" placeholder="Search by description or reference…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search entries" />
            </div>
          </div>

          {loading ? <LoadingState /> : filteredEntries.length === 0 ? (
            <EmptyState title="No journal entries" description="Nothing was posted in the selected period." />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-32">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs text-right">Total (LKR)</TableHead>
                  <TableHead className="text-xs text-right w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>
                      {e.ref_type ? <Badge variant="secondary" className="font-normal">{e.ref_type} #{e.ref_id}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(e.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => viewEntry(e)}><Eye className="h-4 w-4 mr-1" aria-hidden="true" /> View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {(page - 1) * limit + 1}–{Math.min(page * limit, totalRows)} of {totalRows}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">Page {page} of {Math.max(1, totalPages)}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Journal entry #{selectedEntry?.id}</DialogTitle>
            <DialogDescription>{selectedEntry?.description}</DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Entry ID</p><p className="font-medium tabular-nums">#{selectedEntry.id}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium tabular-nums">{new Date(selectedEntry.entry_date).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Reference</p><p className="font-medium">{selectedEntry.ref_type || "Manual"} {selectedEntry.ref_id && `#${selectedEntry.ref_id}`}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="secondary">Posted</Badge></div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Account</TableHead>
                      <TableHead className="text-xs">Notes</TableHead>
                      <TableHead className="text-xs text-right w-36">Debit (LKR)</TableHead>
                      <TableHead className="text-xs text-right w-36">Credit (LKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingItems ? (
                      <TableRow><TableCell colSpan={4}><LoadingState /></TableCell></TableRow>
                    ) : (
                      <>
                        {entryItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="font-medium">{item.account_name}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">{item.account_code}</p>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.notes || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(item.debit) > 0 ? fmt(item.debit) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(item.credit) > 0 ? fmt(item.credit) : "—"}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                          <TableCell colSpan={2} className="text-right">Total</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(selectedEntry.total_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(selectedEntry.total_amount)}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(`/accounting/journal/${selectedEntry?.id}/print`, "_blank")}>
              <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchChequeInventory, updateChequeStatus, bulkUpdateChequeStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Building2, Layers } from "lucide-react";
import { PageHeader, LoadingState, EmptyState } from "@/components/page-shell";
import { DataTablePagination } from "@/components/data-table-pagination";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",   icon: <Clock className="w-3 h-3" /> },
  Deposited: { label: "Deposited", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",       icon: <Building2 className="w-3 h-3" /> },
  Cleared:   { label: "Cleared",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  Bounced:   { label: "Bounced",   color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",       icon: <XCircle className="w-3 h-3" /> },
  Cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",   icon: <AlertCircle className="w-3 h-3" /> },
};

export default function ChequesPage() {
  const { toast } = useToast();
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Update cheque status dialog
  const [updateOpen, setUpdateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("Cleared");
  const [clearedDate, setClearedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchChequeInventory(statusFilter || undefined);
      setCheques(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setSelectedIds([]); // Clear selection on reload
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = cheques.filter(c =>
    !search ||
    c.cheque_no_last6?.includes(search) ||
    c.bank_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.receipt_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(c => c.id));
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      if (selectedIds.length > 0) {
        await bulkUpdateChequeStatus(selectedIds, newStatus, newStatus === 'Cleared' ? clearedDate : undefined);
        toast({ title: "Bulk Update Success", description: `${selectedIds.length} cheques marked as ${newStatus}.` });
      } else if (selected) {
        await updateChequeStatus(selected.id, newStatus, newStatus === 'Cleared' ? clearedDate : undefined);
        toast({ title: "Updated", description: `Cheque marked as ${newStatus}.` });
      }
      setUpdateOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const pending = cheques.filter(c => c.status === 'Pending');
  const pendingTotal = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-5 w-full relative min-h-[calc(100vh-4rem)]">
        <PageHeader
          title="Cheques received"
          description="Cheques from customers. Tick them and mark Deposited, Cleared or Bounced as the bank processes them."
          actions={
            <Badge variant="outline" className="px-3 py-1.5 border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 tabular-nums">
              Not yet cleared: LKR {pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Badge>
          }
        />

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
            const count = cheques.filter(c => (c.status || "Pending") === status).length;
            const total = cheques.filter(c => (c.status || "Pending") === status).reduce((s, c) => s + Number(c.amount || 0), 0);
            return (
              <Card key={status} role="button" title={`Show ${cfg.label.toLowerCase()} only`} className={`cursor-pointer transition-all hover:bg-muted/40 ${statusFilter === status ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(statusFilter === status ? '' : status)}>
                <CardContent className="pt-4 pb-4">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold mb-2 ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{count}</div>
                  <div className="text-xs text-muted-foreground mt-1 tabular-nums">LKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by cheque no, bank, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {statusFilter && (
            <Button variant="outline" onClick={() => setStatusFilter("")}>Show all</Button>
          )}
        </div>

        {/* Table */}
        <Card className="z-0">
          <CardContent className="p-0 overflow-auto">
            {loading ? (
              <LoadingState label="Loading cheques…" />
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState title="No cheques" description={statusFilter || search ? "Nothing matches. Clear the filter or search." : "Cheque payments you record appear here."} /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 w-10">
                      <Checkbox 
                        checked={selectedIds.length === filtered.length && filtered.length > 0} 
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt No.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cheque (Last 6)</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bank / Branch</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cheque Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount (LKR)</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c, idx) => {
                    const currentStatus = c.status || 'Pending';
                    const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['Pending'];
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                        <td className="px-4 py-3">
                          <Checkbox 
                            checked={isSelected} 
                            onCheckedChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.receipt_no}</td>
                        <td className="px-4 py-3 font-mono font-medium">{c.cheque_no_last6}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.bank_name}</div>
                          <div className="text-xs text-muted-foreground">{c.branch_name}</div>
                        </td>
                        <td className="px-4 py-3">{c.customer_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(c.cheque_date).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(currentStatus === 'Pending' || currentStatus === 'Deposited') && (
                            <Button size="sm" variant="outline" className="text-xs"
                              onClick={() => { 
                                setSelectedIds([]); // Clear multi-select
                                setSelected(c); 
                                setNewStatus(currentStatus === 'Pending' ? 'Deposited' : 'Cleared'); 
                                setUpdateOpen(true); 
                              }}>
                              Update Status
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <DataTablePagination 
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>

        {/* Multi-Selection Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <Card className="bg-slate-900 text-white shadow-sm border-none p-4 flex items-center gap-6 min-w-[400px]">
              <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl">
                 <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-semibold text-white">
                   {selectedIds.length}
                 </div>
                 <span className="font-bold tracking-tight">Cheques Selected</span>
              </div>

              <div className="flex-1"></div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setSelectedIds([])}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90 font-bold" onClick={() => { 
                  setSelected(null); 
                  setNewStatus('Deposited'); 
                  setUpdateOpen(true); 
                }}>
                  <Layers className="w-4 h-4 mr-2" />
                  Bulk Update Status
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Update Status Dialog */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedIds.length > 0 ? `Bulk Update (${selectedIds.length} Cheques)` : "Update Cheque Status"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedIds.length > 0 ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                 <div className="p-3 bg-primary rounded-xl text-white shadow-lg shadow-primary/20">
                    <Layers className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="font-semibold text-slate-900">Multi-Update Mode</p>
                    <p className="text-xs text-muted-foreground font-medium">Applying changes to {selectedIds.length} records</p>
                 </div>
              </div>
            ) : selected && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div className="font-bold font-mono text-lg">#{selected.cheque_no_last6}</div>
                <div className="text-muted-foreground">{selected.bank_name} — {selected.branch_name}</div>
                <div className="font-bold">LKR {Number(selected.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label>New Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              >
                <option>Deposited</option>
                <option>Cleared</option>
                <option>Bounced</option>
                <option>Cancelled</option>
              </select>
            </div>
            {newStatus === 'Cleared' && (
              <div className="space-y-2">
                <Label>Cleared Date</Label>
                <Input type="date" value={clearedDate} onChange={e => setClearedDate(e.target.value)} />
              </div>
            )}
            
            {selectedIds.length > 0 && (
              <p className="text-xs text-muted-foreground italic px-1">
                * Note: The selected status and date will be applied to all {selectedIds.length} cheques.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpdateOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updating} className="font-bold">
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {selectedIds.length > 0 ? "Update All Selected" : "Confirm Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

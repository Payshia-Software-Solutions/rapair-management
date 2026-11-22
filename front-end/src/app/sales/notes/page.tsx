"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { 
  fetchCustomerNotes, 
  createCustomerNote, 
  CustomerNoteRow 
} from "@/lib/api/customer-notes";
import { fetchCustomers } from "@/lib/api/master-data";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/page-shell";

export default function CustomerNotesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerNoteRow[]>([]);
  const [customers, setCustomers] = useState<Array<{ value: string; label: string }>>([]);

  const [q, setQ] = useState("");
  const shown = data.filter(r => !q || [r.note_no, r.customer_name, r.customer_phone, r.reason].some(v => String(v || "").toLowerCase().includes(q.toLowerCase())));

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: "Credit Note" as "Credit Note" | "Debit Note",
    customer_id: "",
    date: new Date().toISOString().split("T")[0],
    amount: "",
    reason: ""
  });

  const loadCustomers = async () => {
    try {
      const custData = await fetchCustomers();
      setCustomers(custData.map((x: any) => ({ value: String(x.id), label: `${x.name} - ${x.phone || ''}` })));
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchCustomerNotes();
      setData(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadData();
  }, []);

  const handleSubmit = async () => {
    if (!form.customer_id) return toast({ title: "Validation Error", description: "Customer is required", variant: "destructive" });
    if (!form.amount || Number(form.amount) <= 0) return toast({ title: "Validation Error", description: "Valid amount is required", variant: "destructive" });

    try {
      setSubmitting(true);
      await createCustomerNote({
        type: form.type,
        customer_id: Number(form.customer_id),
        date: form.date,
        amount: Number(form.amount),
        reason: form.reason
      });
      toast({ title: "Success", description: "Note created successfully." });
      setIsDialogOpen(false);
      setForm({
        type: "Credit Note",
        customer_id: "",
        date: new Date().toISOString().split("T")[0],
        amount: "",
        reason: ""
      });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Customer Notes" fullWidth={true}>
      <div className="space-y-5">
        <PageHeader
          title="Credit & debit notes"
          description="Credit note lowers what a customer owes you. Debit note raises it."
          actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-primary">
              <Plus className="w-4 h-4 mr-2" />
              New note
            </Button>
          </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Notes" value={data.length} />
          <StatCard label="Credit notes (lower balance)" value={money(data.filter(d => d.type === "Credit Note").reduce((a, d) => a + Number(d.amount || 0), 0))} />
          <StatCard label="Debit notes (raise balance)" value={money(data.filter(d => d.type === "Debit Note").reduce((a, d) => a + Number(d.amount || 0), 0))} />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search note no., customer or reason" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Note No</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && data.length === 0 ? (
                  <tr><td colSpan={6}><LoadingState label="Loading notes…" /></td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={6} className="p-4">
                    <EmptyState title={q ? "No notes match" : "No notes yet"} description={q ? "Try another search." : "Use New note to adjust a customer's balance."} />
                  </td></tr>
                ) : (
                  shown.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.note_no}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.type === 'Credit Note' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.customer_name} {row.customer_phone ? `(${row.customer_phone})` : ''}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.reason || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credit / debit note</DialogTitle>
            <DialogDescription>Pick the type, the customer and the amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([["Credit Note", "Lowers balance", "Refund, discount, return"], ["Debit Note", "Raises balance", "Extra charge, correction"]] as const).map(([t, h, ex]) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                    className={`rounded-md border p-3 text-left transition-colors ${form.type === t ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}>
                    <div className="font-medium text-sm">{t}</div>
                    <div className="text-xs text-muted-foreground">{h} · {ex}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <SearchableSelect 
                options={customers} 
                value={form.customer_id} 
                onValueChange={(val) => setForm({ ...form, customer_id: val })} 
                placeholder="Search customer…" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input 
                  type="date" 
                  value={form.date} 
                  onChange={(e) => setForm({ ...form, date: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={form.amount} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason / Description</label>
              <Input 
                placeholder="E.g., Discount, Extra charge, Return adjustment..." 
                value={form.reason} 
                onChange={(e) => setForm({ ...form, reason: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}

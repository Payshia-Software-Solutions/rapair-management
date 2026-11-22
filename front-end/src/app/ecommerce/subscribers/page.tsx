"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Download, MailPlus, Search, Trash2, Users, UserCheck, UserX, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  addSubscriber, deleteSubscriber, downloadSubscribersCsv, fetchSubscribers, setSubscriberStatus,
  type Subscriber, type SubscriberStats, type SubscriberStatus,
} from "@/lib/api/subscribers";

const fmtDate = (v: string | null) => (v ? new Date(v.replace(" ", "T")).toLocaleDateString() : "—");

export default function SubscribersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SubscriberStatus | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSubscribers({ status: status === "all" ? "" : status, q: q.trim() });
      setRows(data.subscribers ?? []);
      setStats(data.stats ?? null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load subscribers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [status, q, toast]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (s: Subscriber) => {
    const next: SubscriberStatus = s.status === "Subscribed" ? "Unsubscribed" : "Subscribed";
    try {
      await setSubscriberStatus(s.id, next);
      toast({ title: "Updated", description: `${s.email} is now ${next.toLowerCase()}.` });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (s: Subscriber) => {
    if (!confirm(`Delete ${s.email}? This cannot be undone.`)) return;
    try {
      await deleteSubscriber(s.id);
      toast({ title: "Deleted", description: s.email });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const submitAdd = async () => {
    setSaving(true);
    try {
      const msg = await addSubscriber({ email: newEmail.trim(), name: newName.trim() || undefined });
      toast({ title: "Saved", description: msg });
      setAddOpen(false);
      setNewEmail("");
      setNewName("");
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    try {
      await downloadSubscribersCsv();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const statCards = [
    { label: "Total", value: stats?.total ?? 0, icon: Users },
    { label: "Subscribed", value: stats?.subscribed ?? 0, icon: UserCheck },
    { label: "Unsubscribed", value: stats?.unsubscribed ?? 0, icon: UserX },
    { label: "New (30 days)", value: stats?.last_30_days ?? 0, icon: TrendingUp },
  ];

  return (
    <DashboardLayout title="Newsletter Subscribers">
      <div className="flex flex-col gap-6 w-full pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            <span>E-commerce</span>
            <span className="opacity-20">/</span>
            <span className="text-foreground">Subscribers</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Newsletter Subscribers</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} className="h-10">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              <Button onClick={() => setAddOpen(true)} className="h-10">
                <MailPlus className="w-4 h-4 mr-2" /> Add Subscriber
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            People who signed up for the newsletter on the storefront (pop-up or contact form) or were added here.
            Send them a campaign from Email Marketing using the “Newsletter Subscribers” audience. Every email
            includes a one-click unsubscribe link.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold leading-none">{Number(value) || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by email or name..." className="pl-9 h-11" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Subscribed">Subscribed</SelectItem>
              <SelectItem value="Unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg">Subscriber List</CardTitle>
            <CardDescription>{rows.length} shown</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="py-4 font-bold">Subscriber</TableHead>
                  <TableHead className="font-bold">Source</TableHead>
                  <TableHead className="font-bold">Linked Customer</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Subscribed</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading subscribers...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No subscribers found.</TableCell></TableRow>
                ) : rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="py-3">
                      <div className="font-semibold">{s.email}</div>
                      {s.name && <div className="text-xs text-muted-foreground">{s.name}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.source}</Badge></TableCell>
                    <TableCell className="text-sm">{s.customer_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={s.status === "Subscribed"} onCheckedChange={() => toggle(s)} aria-label="Toggle subscription" />
                        <Badge variant={s.status === "Subscribed" ? "default" : "secondary"}>{s.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {fmtDate(s.subscribed_at)}
                      {s.status === "Unsubscribed" && (
                        <div className="text-[10px] text-muted-foreground">Left {fmtDate(s.unsubscribed_at)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label="Delete subscriber">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Subscriber</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="email" placeholder="Email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <p className="text-xs text-muted-foreground">Only add people who agreed to receive your newsletter.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={saving || !newEmail.trim()}>{saving ? "Saving..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

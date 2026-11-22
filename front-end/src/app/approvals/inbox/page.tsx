"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, History, Loader2, RefreshCcw, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, LoadingState, EmptyState } from "@/components/page-shell";
import {
  actOnApproval, fetchApprovalHistory, fetchApprovalInbox, fetchMyApprovalRequests, withdrawApproval, type ApprovalItem,
} from "@/lib/api/approvals";

const money = (n: number | null) => (n == null ? "—" : `LKR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const ago = (s: string) => { const d = new Date(s.replace(" ", "T")); return Number.isNaN(+d) ? s : formatDistanceToNow(d, { addSuffix: true }); };
const statusVariant = (s: string) => (s === "Approved" ? "secondary" : s === "Rejected" ? "destructive" : "outline") as "secondary" | "destructive" | "outline";

export default function MyApprovalsPage() {
  const { toast } = useToast();
  const [inbox, setInbox] = useState<ApprovalItem[] | null>(null);
  const [mine, setMine] = useState<ApprovalItem[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | "bulk" | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const [reason, setReason] = useState("");
  const [historyFor, setHistoryFor] = useState<ApprovalItem | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchApprovalHistory>>["actions"] | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetchApprovalInbox(), fetchMyApprovalRequests()]);
      setInbox(a); setMine(b);
      setPicked((p) => p.filter((id) => a.some((x) => x.id === id)));
      window.dispatchEvent(new Event("approvals:changed")); // refresh the header bell
    } catch (e: any) {
      toast({ title: "Couldn't load approvals", description: e?.message, variant: "destructive" });
      setInbox([]); setMine([]);
    }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const approve = async (item: ApprovalItem) => {
    setBusy(item.id);
    try {
      const r = await actOnApproval(item.id, "approve");
      toast({ title: r.message || "Approved", description: `${item.doc_type_label}: ${item.doc_no || `#${item.doc_id}`}` });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't approve", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const approveSelected = async () => {
    if (!inbox) return;
    const items = inbox.filter((i) => picked.includes(i.id));
    if (!items.length || !window.confirm(`Approve ${items.length} request(s)?`)) return;
    setBusy("bulk");
    let ok = 0; const failed: string[] = [];
    for (const it of items) {
      try { await actOnApproval(it.id, "approve"); ok++; }
      catch (e: any) { failed.push(`${it.doc_no || it.doc_id}: ${e?.message}`); }
    }
    toast({ title: `${ok} approved`, description: failed.length ? `${failed.length} failed: ${failed.join("; ")}` : undefined, variant: failed.length ? "destructive" : undefined });
    setPicked([]);
    await load();
    setBusy(null);
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusy(rejecting.id);
    try {
      await actOnApproval(rejecting.id, "reject", reason.trim());
      toast({ title: "Rejected", description: `${rejecting.doc_type_label}: ${rejecting.doc_no || `#${rejecting.doc_id}`}` });
      setRejecting(null); setReason("");
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't reject", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const withdraw = async (item: ApprovalItem) => {
    if (!window.confirm("Withdraw this request? The document goes back to draft.")) return;
    try { await withdrawApproval(item.id); toast({ title: "Withdrawn" }); await load(); }
    catch (e: any) { toast({ title: "Couldn't withdraw", description: e?.message, variant: "destructive" }); }
  };

  const openHistory = async (item: ApprovalItem) => {
    setHistoryFor(item); setHistory(null);
    try { setHistory((await fetchApprovalHistory(item.id)).actions); } catch { setHistory([]); }
  };

  const allPicked = !!inbox?.length && picked.length === inbox.length;

  return (
    <DashboardLayout title="My Approvals">
      <div className="space-y-5">
        <PageHeader
          title="My Approvals"
          description="Documents waiting for your approval, and requests you've sent."
          actions={<Button variant="outline" onClick={() => void load()}><RefreshCcw className="h-4 w-4 mr-2" aria-hidden="true" /> Refresh</Button>}
        />

        <Tabs defaultValue="waiting">
          <TabsList>
            <TabsTrigger value="waiting">Waiting for me{inbox?.length ? ` (${inbox.length})` : ""}</TabsTrigger>
            <TabsTrigger value="mine">Sent by me</TabsTrigger>
          </TabsList>

          <TabsContent value="waiting" className="mt-4">
            <Card className="overflow-hidden">
              {!inbox ? <LoadingState /> : inbox.length === 0 ? (
                <EmptyState title="Nothing waiting for you" description="New requests appear here and on the bell." />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox checked={allPicked} onCheckedChange={(v) => setPicked(v ? inbox.map((i) => i.id) : [])} aria-label="Select all" />
                      {picked.length ? `${picked.length} selected` : "Select all"}
                    </label>
                    <Button size="sm" disabled={!picked.length || busy !== null} onClick={approveSelected}>
                      {busy === "bulk" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Approve selected
                    </Button>
                  </div>
                  <ul className="divide-y">
                    {inbox.map((it) => (
                      <li key={it.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                        <Checkbox checked={picked.includes(it.id)} aria-label={`Select ${it.doc_no || it.doc_id}`}
                          onCheckedChange={(v) => setPicked((p) => (v ? [...p, it.id] : p.filter((x) => x !== it.id)))} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-normal">{it.doc_type_label}</Badge>
                            <span className="font-medium">{it.doc_no || `#${it.doc_id}`}</span>
                            <span className="tabular-nums font-medium">{money(it.amount)}</span>
                          </div>
                          {it.summary && <p className="mt-0.5 truncate text-sm text-muted-foreground">{it.summary}</p>}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            From {it.requested_by || "—"} · {ago(it.created_at)} · {it.level_label}{it.level_count && it.level_count > 1 ? ` of ${it.level_count}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button variant="ghost" size="sm" asChild><Link href={it.href}><ExternalLink className="h-4 w-4 mr-1" /> Open</Link></Button>
                          <Button variant="ghost" size="sm" onClick={() => void openHistory(it)}><History className="h-4 w-4 mr-1" /> History</Button>
                          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { setRejecting(it); setReason(""); }}>
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" disabled={busy !== null} onClick={() => void approve(it)}>
                            {busy === it.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Approve
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            <Card className="overflow-hidden">
              {!mine ? <LoadingState /> : mine.length === 0 ? <EmptyState title="You haven't sent anything for approval" /> : (
                <ul className="divide-y">
                  {mine.map((it) => (
                    <li key={it.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-normal">{it.doc_type_label}</Badge>
                          <span className="font-medium">{it.doc_no || `#${it.doc_id}`}</span>
                          <span className="tabular-nums">{money(it.amount)}</span>
                          <Badge variant={statusVariant(it.status)}>{it.status}{it.status === "Pending" && it.current_level ? ` · level ${it.current_level}` : ""}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Sent {ago(it.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void openHistory(it)}><History className="h-4 w-4 mr-1" /> History</Button>
                        {it.status === "Pending" && <Button variant="outline" size="sm" onClick={() => void withdraw(it)}>Withdraw</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejecting} onOpenChange={(v) => { if (!v) setRejecting(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.doc_no || `#${rejecting?.doc_id}`}?</DialogTitle>
            <DialogDescription>The person who sent it sees your reason, and the document goes back to them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rej-reason">Reason</Label>
            <Textarea id="rej-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim() || busy !== null} onClick={reject}>
              {busy === rejecting?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(v) => { if (!v) setHistoryFor(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>History · {historyFor?.doc_no || `#${historyFor?.doc_id}`}</DialogTitle>
            <DialogDescription>{historyFor?.doc_type_label} · {money(historyFor?.amount ?? null)}</DialogDescription>
          </DialogHeader>
          {!history ? <LoadingState /> : (
            <ol className="space-y-3 text-sm">
              {history.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <Badge variant={statusVariant(a.action)} className="h-fit shrink-0 font-normal">{a.action}</Badge>
                  <div>
                    <p>{a.user_name || "—"}{a.level_no ? ` · level ${a.level_no}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{ago(a.created_at)}</p>
                    {a.comment && <p className="mt-1 text-muted-foreground">“{a.comment}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

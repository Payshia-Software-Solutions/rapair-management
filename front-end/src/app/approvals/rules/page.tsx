"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, LoadingState, EmptyState } from "@/components/page-shell";
import { fetchApprovalRules, saveApprovalRule, type ApprovalLevel, type ApprovalTypeRule } from "@/lib/api/approvals";
import { cn } from "@/lib/utils";

type Lookups = Awaited<ReturnType<typeof fetchApprovalRules>>;

const blankLevel = (): ApprovalLevel => ({ label: "", approver_type: "role", role_id: null, user_id: null, min_amount: null, location_id: null });
const lkr = (n: number) => `LKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function ApprovalRulesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [draft, setDraft] = useState<ApprovalTypeRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("100000");

  const load = async (keep?: string) => {
    try {
      const d = await fetchApprovalRules();
      setData(d);
      const pick = keep || selected || d.types[0]?.doc_type || "";
      setSelected(pick);
      setDraft(structuredClone(d.types.find((t) => t.doc_type === pick) || null));
    } catch (e: any) {
      setError(e?.message || "Couldn't load approval rules");
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const original = data?.types.find((t) => t.doc_type === selected) || null;
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);

  const choose = (key: string) => {
    if (dirty && !window.confirm("Discard unsaved changes to this document type?")) return;
    setSelected(key);
    setDraft(structuredClone(data!.types.find((t) => t.doc_type === key) || null));
  };

  const setLevel = (i: number, patch: Partial<ApprovalLevel>) =>
    setDraft((d) => d && { ...d, levels: d.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const levels = [...d.levels];
      const j = i + dir;
      if (j < 0 || j >= levels.length) return d;
      [levels[i], levels[j]] = [levels[j], levels[i]];
      return { ...d, levels };
    });

  const nameFor = (l: ApprovalLevel) =>
    l.label?.trim() ||
    (l.approver_type === "user"
      ? data?.users.find((u) => u.id === l.user_id)?.name
      : data?.roles.find((r) => r.id === l.role_id)?.name) ||
    "approver not chosen yet";

  // Which levels a document of the preview amount would go through.
  const route = useMemo(() => {
    const amt = Number(preview || 0);
    return (draft?.levels || []).filter((l) => l.min_amount == null || amt >= l.min_amount);
  }, [draft, preview]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveApprovalRule({
        doc_type: draft.doc_type, enabled: draft.enabled, notify_email: draft.notify_email, notify_sms: draft.notify_sms,
        levels: draft.levels,
      });
      toast({ title: "Approval rules saved", description: `${draft.label}: ${draft.enabled ? `on, ${draft.levels.length} level(s)` : "off"}` });
      await load(draft.doc_type);
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const usersWithoutPhone = draft?.notify_sms
    ? draft.levels.filter((l) => l.approver_type === "user" && l.user_id && !data?.users.find((u) => u.id === l.user_id)?.phone).length
    : 0;

  return (
    <DashboardLayout title="Approval Rules">
      <div className="space-y-5">
        <PageHeader
          title="Approval Rules"
          description="Turn approval on per document type and set who approves, in what order, from what amount."
        />

        {error ? <Card><EmptyState title="Couldn't load approval rules" description={error} /></Card>
          : !data || !draft ? <Card><LoadingState /></Card> : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
            <Card className="h-fit overflow-hidden">
              <ul className="divide-y" role="listbox" aria-label="Document types">
                {data.types.map((t) => (
                  <li key={t.doc_type}>
                    <button
                      type="button" role="option" aria-selected={t.doc_type === selected}
                      onClick={() => choose(t.doc_type)}
                      className={cn("flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40",
                        t.doc_type === selected && "bg-muted/60 font-medium")}
                    >
                      <span>{t.label}</span>
                      <Badge variant={t.enabled ? "default" : "outline"} className="font-normal">
                        {t.enabled ? `On · ${t.levels.length}` : "Off"}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-5">
              <Card className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{draft.label}</h2>
                    <p className="text-sm text-muted-foreground">
                      {draft.enabled ? "Documents of this type wait for approval before they can go ahead." : "Approval is off: documents go ahead without approval."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ap-enabled" className="text-sm">Require approval</Label>
                    <Switch id="ap-enabled" checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Notify approvers by</span>
                  <label className="flex items-center gap-2"><Switch checked={draft.notify_email} onCheckedChange={(v) => setDraft({ ...draft, notify_email: v })} /> Email</label>
                  <label className="flex items-center gap-2"><Switch checked={draft.notify_sms} onCheckedChange={(v) => setDraft({ ...draft, notify_sms: v })} /> SMS</label>
                  <span className="text-muted-foreground">· always shown in My Approvals and the bell</span>
                </div>
                {usersWithoutPhone > 0 && (
                  <p className="text-xs text-amber-600">{usersWithoutPhone} chosen person(s) have no phone number, so they won't get SMS. Add it under Administration → Users.</p>
                )}
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h2 className="font-semibold">Approval levels</h2>
                    <p className="text-xs text-muted-foreground">Run top to bottom. A level with a minimum amount is skipped for smaller documents.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, levels: [...draft.levels, blankLevel()] })}>
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add level
                  </Button>
                </div>

                {draft.levels.length === 0 ? (
                  <EmptyState title="No levels yet" description="Add at least one level, then switch approval on."
                    action={<Button size="sm" onClick={() => setDraft({ ...draft, levels: [blankLevel()] })}><Plus className="h-4 w-4 mr-1" /> Add level 1</Button>} />
                ) : (
                  <ol className="divide-y">
                    {draft.levels.map((l, i) => (
                      <li key={i} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[auto_1fr_1fr_150px_160px_auto] md:items-end">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold" aria-label={`Level ${i + 1}`}>{i + 1}</div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Approver</Label>
                          <div className="flex gap-2">
                            <Select value={l.approver_type} onValueChange={(v) => setLevel(i, { approver_type: v as "role" | "user", role_id: null, user_id: null })}>
                              <SelectTrigger className="w-[110px]" aria-label="Approver type"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="role">Role</SelectItem>
                                <SelectItem value="user">Person</SelectItem>
                              </SelectContent>
                            </Select>
                            {l.approver_type === "role" ? (
                              <Select value={l.role_id ? String(l.role_id) : ""} onValueChange={(v) => setLevel(i, { role_id: Number(v) })}>
                                <SelectTrigger aria-label="Role"><SelectValue placeholder="Choose role" /></SelectTrigger>
                                <SelectContent>{data.roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <Select value={l.user_id ? String(l.user_id) : ""} onValueChange={(v) => setLevel(i, { user_id: Number(v) })}>
                                <SelectTrigger aria-label="Person"><SelectValue placeholder="Choose person" /></SelectTrigger>
                                <SelectContent>{data.users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.role ? ` · ${u.role}` : ""}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`lv-label-${i}`} className="text-xs text-muted-foreground">Name <span className="font-normal">(optional)</span></Label>
                          <Input id={`lv-label-${i}`} placeholder="e.g. Managing Director" value={l.label || ""} onChange={(e) => setLevel(i, { label: e.target.value })} />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`lv-min-${i}`} className="text-xs text-muted-foreground">From amount (LKR)</Label>
                          <Input id={`lv-min-${i}`} type="number" min={0} placeholder="Any amount" className="tabular-nums"
                            value={l.min_amount ?? ""} onChange={(e) => setLevel(i, { min_amount: e.target.value === "" ? null : Number(e.target.value) })} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Location</Label>
                          <Select value={l.location_id ? String(l.location_id) : "all"} onValueChange={(v) => setLevel(i, { location_id: v === "all" ? null : Number(v) })}>
                            <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All locations</SelectItem>
                              {data.locations.map((loc) => <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(i, 1)} disabled={i === draft.levels.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label={`Remove level ${i + 1}`}
                            onClick={() => setDraft({ ...draft, levels: draft.levels.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              {draft.levels.length > 0 && (
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">A document of</span>
                    <Input type="number" min={0} className="h-8 w-36 tabular-nums" value={preview} onChange={(e) => setPreview(e.target.value)} aria-label="Example amount" />
                    <span className="text-muted-foreground">LKR goes to:</span>
                  </div>
                  <p className="text-sm">
                    {!draft.enabled ? <span className="text-muted-foreground">No approval (switched off)</span>
                      : route.length === 0 ? <span className="text-muted-foreground">No level applies, so it is approved automatically.</span>
                      : route.map((l, i) => <span key={i}>{i > 0 && " → "}<span className="text-muted-foreground">Level {draft.levels.indexOf(l) + 1}: </span><span className="font-medium">{nameFor(l)}</span>{l.min_amount != null && <span className="text-muted-foreground"> (from {lkr(l.min_amount)})</span>}</span>)}
                  </p>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={!dirty || saving} onClick={() => setDraft(structuredClone(original))}>Discard changes</Button>
                <Button onClick={save} disabled={!dirty || saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />} Save {draft.label.toLowerCase()} rules
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

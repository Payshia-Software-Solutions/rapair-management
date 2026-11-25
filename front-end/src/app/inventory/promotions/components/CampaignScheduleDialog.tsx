"use client";

import React from "react";
import { CalendarClock, Loader2, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchPromotion, savePromotion } from "@/lib/api/promotions";
import { fetchCollections } from "@/lib/api/master-data";
import { MultiLocationSelector } from "./MultiLocationSelector";

const DAYS = [
  { n: 1, l: "Mon" }, { n: 2, l: "Tue" }, { n: 3, l: "Wed" }, { n: 4, l: "Thu" },
  { n: 5, l: "Fri" }, { n: 6, l: "Sat" }, { n: 7, l: "Sun" },
];

type Form = {
  name: string;
  description: string;
  percent: string;
  scope: "store" | "categories";
  categories: number[];
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  days: number[];
  promo_code: string;
  usage_limit: string;
  max_discount: string;
  priority: string;
  is_active: boolean;
  applicable_locations: number[];
};

const empty = (): Form => ({
  name: "", description: "", percent: "20", scope: "store", categories: [],
  start_date: new Date().toISOString().split("T")[0], end_date: "", start_time: "", end_time: "",
  days: [], promo_code: "", usage_limit: "", max_discount: "", priority: "20", is_active: true, applicable_locations: [],
});

const parseIds = (v: any): number[] => {
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  try { const j = JSON.parse(v || "[]"); return Array.isArray(j) ? j.map(Number).filter(Boolean) : []; } catch { return []; }
};

/**
 * Campaigns (Black Friday, weekend sale, happy hour) and the schedule / limits of any offer.
 * New: a % discount on the whole store or chosen categories, with dates, daily hours, weekdays,
 * an optional promo code, a usage limit and a cap per bill.
 * Existing offer: edits when and how often it runs; a simple % offer can also change its discount.
 */
export const CampaignScheduleDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotionId: number | null;
  onSuccess: () => void;
}> = ({ open, onOpenChange, promotionId, onSuccess }) => {
  const { toast } = useToast();
  const [form, setForm] = React.useState<Form>(empty());
  const [loaded, setLoaded] = React.useState<any>(null);
  const [collections, setCollections] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // A % offer with no item rules can be edited here in full; other offer types keep their rules
  const simplePct = (p: any) => {
    const b = p?.benefits || [];
    const c = (p?.conditions || []).filter((x: any) => x.condition_type !== "MinAmount");
    return b.length === 1 && b[0].benefit_type === "Percentage" && c.length === 0;
  };
  const offerEditable = !promotionId || simplePct(loaded);

  React.useEffect(() => {
    if (!open) return;
    fetchCollections().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => setCollections([]));
    if (!promotionId) { setLoaded(null); setForm(empty()); return; }
    setLoading(true);
    fetchPromotion(promotionId).then((p: any) => {
      setLoaded(p);
      const b = p.benefits?.[0] || {};
      const cats = parseIds(b.target_categories);
      setForm({
        name: p.name || "",
        description: p.description || "",
        percent: String(Number(b.benefit_value || 0)),
        scope: cats.length ? "categories" : "store",
        categories: cats,
        start_date: p.start_date || "",
        end_date: p.end_date || "",
        start_time: (p.start_time || "").slice(0, 5),
        end_time: (p.end_time || "").slice(0, 5),
        days: String(p.days_of_week || "").split(",").map(Number).filter(Boolean),
        promo_code: p.promo_code || "",
        usage_limit: Number(p.usage_limit) ? String(p.usage_limit) : "",
        max_discount: Number(p.max_discount) ? String(Number(p.max_discount)) : "",
        priority: String(p.priority ?? 0),
        is_active: Boolean(Number(p.is_active)),
        applicable_locations: parseIds(p.applicable_locations),
      });
    }).catch((e: any) => {
      toast({ title: "Could not load the offer", description: e.message, variant: "destructive" });
      onOpenChange(false);
    }).finally(() => setLoading(false));
  }, [open, promotionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleDay = (n: number) => set("days", form.days.includes(n) ? form.days.filter(d => d !== n) : [...form.days, n].sort());
  const toggleCat = (id: number) => set("categories", form.categories.includes(id) ? form.categories.filter(c => c !== id) : [...form.categories, id]);

  const save = async () => {
    if (!form.name.trim()) return toast({ title: "Give the campaign a name", variant: "destructive" });
    const pct = Number(form.percent);
    if (offerEditable && !(pct > 0 && pct <= 100)) return toast({ title: "Discount must be between 1 and 100%", variant: "destructive" });
    if (form.end_date && form.start_date && form.end_date < form.start_date) return toast({ title: "End date is before the start date", variant: "destructive" });
    if ((form.start_time && !form.end_time) || (!form.start_time && form.end_time)) return toast({ title: "Set both a start and an end time, or neither", variant: "destructive" });
    if (offerEditable && form.scope === "categories" && form.categories.length === 0) return toast({ title: "Pick at least one category", variant: "destructive" });

    const schedule = {
      name: form.name.trim(),
      description: form.description,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      days_of_week: form.days,
      promo_code: form.promo_code.trim().toUpperCase(),
      usage_limit: Number(form.usage_limit) || 0,
      max_discount: Number(form.max_discount) || 0,
      priority: Number(form.priority) || 0,
      is_active: form.is_active ? 1 : 0,
      applicable_locations: form.applicable_locations,
    };
    const pctBenefit = [{ benefit_type: "Percentage", benefit_value: pct, target_categories: form.scope === "categories" ? form.categories : [] }];

    let payload: any;
    if (!promotionId) {
      payload = { ...schedule, type: "Discount", conditions: [], benefits: pctBenefit };
    } else {
      payload = {
        ...loaded,
        ...schedule,
        conditions: loaded.conditions || [],
        benefits: offerEditable ? pctBenefit : (loaded.benefits || []),
      };
    }

    setSaving(true);
    try {
      await savePromotion(payload);
      toast({ title: promotionId ? "Offer updated" : "Campaign created", description: form.name });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" aria-hidden="true" />
            {promotionId ? "Schedule & limits" : "New campaign"}
          </DialogTitle>
          <DialogDescription>
            {promotionId
              ? "When this offer runs at the POS, and how much it can give."
              : "A timed discount such as Black Friday, a weekend sale or happy hour. The POS applies it by itself while it runs."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cp-name">Name</Label>
                <Input id="cp-name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Black Friday 2026" />
              </div>
              {offerEditable && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-pct">Discount</Label>
                    <div className="relative">
                      <Input id="cp-pct" type="number" min={1} max={100} value={form.percent} onChange={e => set("percent", e.target.value)} className="pr-8" />
                      <Percent className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Applies to</Label>
                    <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-muted">
                      {(["store", "categories"] as const).map(s => (
                        <button key={s} type="button" onClick={() => set("scope", s)} className={`h-9 rounded-sm text-sm ${form.scope === s ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                          {s === "store" ? "Whole store" : "Categories"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.scope === "categories" && (
                    <div className="sm:col-span-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border rounded-md">
                      {collections.length === 0 && <p className="text-xs text-muted-foreground">No categories yet. Create them under Master Data → Collections.</p>}
                      {collections.map((c: any) => {
                        const on = form.categories.includes(Number(c.id));
                        return (
                          <button key={c.id} type="button" onClick={() => toggleCat(Number(c.id))} aria-pressed={on}
                            className={`px-2.5 h-7 rounded-full border text-xs ${on ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/50"}`}>
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <fieldset className="space-y-3 border rounded-md p-3">
              <legend className="text-sm font-medium px-1">When it runs</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-sd">From date</Label>
                  <Input id="cp-sd" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-ed">To date</Label>
                  <Input id="cp-ed" type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-st">Daily from</Label>
                  <Input id="cp-st" type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-et">Daily until</Label>
                  <Input id="cp-et" type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Leave the hours empty for all day. An end time before the start time runs past midnight (22:00 to 02:00).</p>
              <div className="space-y-1.5">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(d => {
                    const on = form.days.includes(d.n);
                    return (
                      <button key={d.n} type="button" onClick={() => toggleDay(d.n)} aria-pressed={on}
                        className={`w-11 h-8 rounded-md border text-xs ${on ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/50"}`}>
                        {d.l}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{form.days.length ? "Only on the selected days." : "Every day."}</p>
              </div>
            </fieldset>

            <fieldset className="space-y-3 border rounded-md p-3">
              <legend className="text-sm font-medium px-1">Limits</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-code">Promo code</Label>
                  <Input id="cp-code" value={form.promo_code} onChange={e => set("promo_code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="Optional" className="font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-cap">Max discount per bill</Label>
                  <Input id="cp-cap" type="number" min={0} value={form.max_discount} onChange={e => set("max_discount", e.target.value)} placeholder="No cap" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-lim">Total uses</Label>
                  <Input id="cp-lim" type="number" min={0} value={form.usage_limit} onChange={e => set("usage_limit", e.target.value)} placeholder="Unlimited" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">With a promo code, the offer only applies when the cashier enters the code. Without one, it applies by itself.{loaded?.used_count ? ` Used ${loaded.used_count} time${Number(loaded.used_count) === 1 ? "" : "s"} so far.` : ""}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Locations</Label>
                  <MultiLocationSelector selectedIds={form.applicable_locations} onChange={(v: number[]) => set("applicable_locations", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-pri">Priority</Label>
                  <Input id="cp-pri" type="number" value={form.priority} onChange={e => set("priority", e.target.value)} />
                  <p className="text-xs text-muted-foreground">One offer per bill: the biggest saving wins.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} /> Active
              </label>
            </fieldset>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {promotionId ? "Save" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

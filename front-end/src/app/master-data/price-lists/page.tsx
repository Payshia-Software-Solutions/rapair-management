"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RotateCcw, Save, Search, Tags, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  deletePriceList, fetchPriceListItems, fetchPriceLists, savePriceList, setPriceListItems,
  type PriceList, type PriceListItem,
} from "@/lib/api/pricelists";
import { fetchStationItemFilters } from "@/lib/api/printqueue";

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ruleText = (l: Pick<PriceList, "parent_name" | "adjust_percent" | "round_to">) => {
  const adj = Number(l.adjust_percent || 0);
  const r = Number(l.round_to || 0);
  return [
    `From ${l.parent_name || "Standard"}`,
    adj ? `${adj > 0 ? "+" : ""}${adj}%` : "same price",
    r ? `round to ${r}` : null,
  ].filter(Boolean).join(" · ");
};

/**
 * Master Data -> Price Lists. "Standard" is the item master Selling Price. Each list inherits from a
 * parent (or Standard) with an optional +/-% and rounding; individual items can have their own price.
 * Locations pick a list in their settings; the POS sells at that list's prices.
 */
export default function PriceListsPage() {
  const { toast } = useToast();
  const [lists, setLists] = useState<PriceList[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<PriceList> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (selectId?: number) => {
    try {
      const l = await fetchPriceLists();
      setLists(l);
      setSelected(prev => selectId ?? (prev && l.some(x => x.id === prev) ? prev : l[0]?.id ?? null));
    } catch { setLists([]); }
  };
  useEffect(() => { void load(); }, []);

  const current = lists?.find(l => l.id === selected) || null;

  const saveList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit?.name?.trim()) return;
    setSaving(true);
    try {
      const r = await savePriceList({ ...edit, name: edit.name.trim() });
      setEdit(null);
      await load(r.id);
      toast({ title: "Price list saved" });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const removeList = async (l: PriceList) => {
    const where = l.locations ? ` ${l.locations} will go back to Standard prices.` : "";
    if (!window.confirm(`Delete "${l.name}" and its ${l.item_count} item price(s)?${where}`)) return;
    try { await deletePriceList(l.id); await load(); toast({ title: "Price list deleted" }); }
    catch (err: any) { toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" }); }
  };

  return (
    <DashboardLayout>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" aria-hidden="true" /> Price Lists
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Standard = the item&rsquo;s Selling Price. Other lists build on it. Choose a list per location in Locations.
          </p>
        </div>
        <Button onClick={() => setEdit({ name: "", parent_id: null, adjust_percent: 0, round_to: 0, is_active: 1 })}>
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" /> New price list
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] items-start">
        {/* Lists */}
        <Card>
          <CardContent className="p-2">
            <div className="rounded-md px-3 py-2.5 text-sm">
              <div className="font-medium">Standard</div>
              <div className="text-xs text-muted-foreground">Item master Selling Price · used when a location has no list</div>
            </div>
            {lists === null ? (
              <div className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : lists.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No price lists yet. Create one for outlets with different prices.</div>
            ) : lists.map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(l.id)}
                className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${selected === l.id ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60"}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate">{l.name}</span>
                  {!Number(l.is_active) && <Badge variant="outline" className="text-muted-foreground">Off</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{Number(l.item_count)} set</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{ruleText(l)}</div>
                {l.locations && <div className="text-xs text-primary truncate">Used by {l.locations}</div>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Items of the selected list */}
        {current ? (
          <ListItems
            key={current.id}
            list={current}
            onEdit={() => setEdit({ ...current })}
            onDelete={() => removeList(current)}
            onSaved={() => load(current.id)}
          />
        ) : (
          <Card><CardContent className="p-8 text-sm text-muted-foreground">Create a price list to set outlet prices.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={v => { if (!v) setEdit(null); }}>
        <DialogContent size="sm">
          <DialogHeader className="text-left">
            <DialogTitle>{edit?.id ? "Edit price list" : "New price list"}</DialogTitle>
            <DialogDescription>Prices come from the parent list, adjusted by the percentage. Items can still have their own price.</DialogDescription>
          </DialogHeader>
          {edit && (
            <form onSubmit={saveList} className="space-y-3">
              <div>
                <label htmlFor="pl-name" className="text-sm font-medium">Name</label>
                <Input id="pl-name" autoFocus value={edit.name || ""} placeholder="Airport outlet" className="mt-1.5 h-10"
                  onChange={e => setEdit({ ...edit, name: e.target.value.slice(0, 100) })} />
              </div>
              <div>
                <label htmlFor="pl-parent" className="text-sm font-medium">Based on</label>
                <select id="pl-parent" value={edit.parent_id || ""} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                  onChange={e => setEdit({ ...edit, parent_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Standard (item Selling Price)</option>
                  {(lists || []).filter(l => l.id !== edit.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="pl-adj" className="text-sm font-medium">Adjust by %</label>
                  <Input id="pl-adj" type="number" step="0.01" value={String(edit.adjust_percent ?? 0)} className="mt-1.5 h-10"
                    onChange={e => setEdit({ ...edit, adjust_percent: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="pl-round" className="text-sm font-medium">Round to</label>
                  <select id="pl-round" value={String(Number(edit.round_to || 0))} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                    onChange={e => setEdit({ ...edit, round_to: e.target.value })}>
                    <option value="0">No rounding</option>
                    <option value="1">1</option><option value="5">5</option><option value="10">10</option>
                    <option value="50">50</option><option value="100">100</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: 1,900 {Number(edit.adjust_percent || 0) >= 0 ? "+" : ""}{Number(edit.adjust_percent || 0)}%
                {" = "}{fmt((() => { const v = 1900 * (1 + Number(edit.adjust_percent || 0) / 100); const r = Number(edit.round_to || 0); return r > 0 ? Math.round(v / r) * r : v; })())}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!Number(edit.is_active ?? 1)} onCheckedChange={v => setEdit({ ...edit, is_active: v ? 1 : 0 })} />
                Active (off = locations using it sell at Standard prices)
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                <Button type="submit" disabled={saving || !edit.name?.trim()}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ListItems({ list, onEdit, onDelete, onSaved }: { list: PriceList; onEdit: () => void; onDelete: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState("");
  const [onlySet, setOnlySet] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: PriceListItem[]; total: number; per_page: number } | null>(null);
  const [filters, setFilters] = useState<{ categories: any[]; collections: any[] }>({ categories: [], collections: [] });
  // unsaved edits: part_id -> price string ('' = clear own price)
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys(draft).length;

  useEffect(() => { fetchStationItemFilters().then(setFilters).catch(() => {}); }, []);
  const reload = () => fetchPriceListItems({ list_id: list.id, q, category, collection, only_set: onlySet }, page)
    .then(setData).catch(() => setData({ items: [], total: 0, per_page: 50 }));
  useEffect(() => { const t = setTimeout(reload, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, category, collection, onlySet, page]);
  useEffect(() => { setPage(1); }, [q, category, collection, onlySet]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;

  const save = async () => {
    setBusy(true);
    try {
      await setPriceListItems(list.id, Object.entries(draft).map(([id, v]) => ({ part_id: Number(id), price: v.trim() === "" ? null : Number(v) })));
      setDraft({});
      await reload();
      onSaved();
      toast({ title: `${dirty} price(s) saved` });
    } catch (err: any) {
      toast({ title: "Couldn't save prices", description: err?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-lg truncate">{list.name}</CardTitle>
          <CardDescription>{ruleText(list)}{list.locations ? ` · used by ${list.locations}` : " · not used by any location yet"}</CardDescription>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit price list"><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete price list"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, SKU, barcode" className="h-10 pl-8" aria-label="Search items" />
          </div>
          {filters.categories.length > 0 && (
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category" className="h-10 max-w-[180px] rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All categories</option>
              {filters.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {filters.collections.length > 0 && (
            <select value={collection} onChange={e => setCollection(e.target.value)} aria-label="Collection" className="h-10 max-w-[180px] rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All collections</option>
              {filters.collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm px-1">
            <Checkbox checked={onlySet} onCheckedChange={v => setOnlySet(!!v)} /> Own prices only
          </label>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium text-right">Standard</th>
                <th className="px-3 py-2 font-medium text-right">From rule</th>
                <th className="px-3 py-2 font-medium w-[180px]">Price in {list.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data === null ? (
                <tr><td colSpan={4} className="px-3 py-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-muted-foreground">No items found.</td></tr>
              ) : data.items.map(it => {
                const v = draft[it.id] ?? (it.own_price !== null ? String(it.own_price) : "");
                const changed = draft[it.id] !== undefined;
                return (
                  <tr key={it.id} className={changed ? "bg-primary/5" : ""}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.part_name}</div>
                      {it.sku && <div className="text-xs text-muted-foreground">{it.sku}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(it.standard_price)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(it.inherited_price)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" step="0.01" min="0" inputMode="decimal"
                          value={v}
                          placeholder={fmt(it.inherited_price)}
                          aria-label={`Price of ${it.part_name} in ${list.name}`}
                          className="h-9 text-right tabular-nums"
                          onChange={e => setDraft(d => ({ ...d, [it.id]: e.target.value }))}
                        />
                        {(it.own_price !== null || changed) && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                            title="Use the rule price" aria-label={`Use the rule price for ${it.part_name}`}
                            onClick={() => setDraft(d => it.own_price === null ? (({ [it.id]: _, ...rest }) => rest)(d) : { ...d, [it.id]: "" })}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{data ? `${data.total} items` : ""}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs tabular-nums">{page} / {pages}</span>
            <Button variant="ghost" size="icon" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">Empty price = uses the rule. </p>
          <div className="ml-auto flex items-center gap-2">
            {dirty > 0 && <Button variant="outline" onClick={() => setDraft({})} disabled={busy}>Discard</Button>}
            <Button onClick={save} disabled={busy || dirty === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save {dirty > 0 ? `${dirty} change${dirty > 1 ? "s" : ""}` : "prices"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

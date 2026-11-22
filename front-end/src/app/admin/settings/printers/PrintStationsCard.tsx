"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ListChecks, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchLocations } from "@/lib/api";
import {
  assignItemsToStation, deletePrintStation, fetchPrintDevices, fetchPrintStations, fetchStationItems, fetchStationItemFilters, fetchStationItemIds,
  savePrintStation, type PrintDevice, type PrintStation, type StationItem,
} from "@/lib/api/printqueue";

type Loc = { id: number; name: string };
const EMPTY: Partial<PrintStation> = { name: "", ticket_label: "KOT", device_id: null, printer_name: "", paper_width: "80mm", is_default: 0, is_active: 1 };

/**
 * Print stations: Kitchen, Bar, Pastry… Each item is assigned to a station and each station
 * points to a printer, so moving the bar printer means editing one station, not every item.
 * Items without a station go to the location's default station.
 */
/**
 * mode "direct": this POS PC prints kitchen tickets itself, so printers come from the BizzFlow
 * Printer app on THIS PC and the kitchen-PC fields are hidden. mode "queue": tablets send tickets
 * to a kitchen PC, which picks the printer per station.
 */
export function PrintStationsCard({ mode = "queue" }: { mode?: "direct" | "queue" }) {
  const direct = mode === "direct";
  const { toast } = useToast();
  const [locations, setLocations] = useState<Loc[]>([]);
  const [stations, setStations] = useState<PrintStation[] | null>(null);
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [edit, setEdit] = useState<Partial<PrintStation> | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [localPrinters, setLocalPrinters] = useState<string[] | null>(null);
  useEffect(() => {
    if (!direct) return;
    fetch("http://127.0.0.1:5001/printers", { signal: AbortSignal.timeout(4000) })
      .then(r => r.json()).then(d => setLocalPrinters((d?.data || []).map((p: any) => String(p.name)).sort()))
      .catch(() => setLocalPrinters([]));
  }, [direct]);

  const load = () => fetchPrintStations().then(setStations).catch(() => setStations([]));

  useEffect(() => {
    void load();
    fetchPrintDevices().then(d => setDevices(d.filter(x => Number(x.is_active)))).catch(() => {});
    fetchLocations().then((rows: any) => setLocations((Array.isArray(rows) ? rows : []).map((l: any) => ({ id: Number(l.id), name: String(l.name) })))).catch(() => {});
  }, []);

  const locName = (id: number) => locations.find(l => l.id === Number(id))?.name || `Location ${id}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit?.name?.trim() || !edit.location_id) return;
    setSaving(true);
    try {
      await savePrintStation({ ...edit, name: edit.name.trim() });
      setEdit(null);
      void load();
    } catch (err: any) {
      toast({ title: "Couldn't save station", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: PrintStation) => {
    if (!window.confirm(`Delete "${s.name}"? Its ${s.item_count} item(s) will print at the default station.`)) return;
    try { await deletePrintStation(s.id); void load(); }
    catch (err: any) { toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" }); }
  };

  const locDevices = devices.filter(d => !edit?.location_id || Number(d.location_id) === Number(edit.location_id));
  // Printers the kitchen PC(s) reported: the chosen PC, or every PC at this location
  const printerOptions = useMemo(() => {
    if (direct) return localPrinters || [];
    const src = edit?.device_id ? locDevices.filter(d => Number(d.id) === Number(edit.device_id)) : locDevices;
    const names = new Set<string>();
    src.forEach(d => { try { (JSON.parse(d.printers_json || "[]") as string[]).forEach(n => names.add(n)); } catch {} });
    return Array.from(names).sort();
  }, [direct, localPrinters, locDevices, edit?.device_id]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">Print stations</CardTitle>
          <CardDescription>
            Split kitchen tickets by where items are made (Kitchen KOT, Bar BOT…). Items go to their station;
            items without one go to the default station.
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} disabled={!stations?.length}>
            <ListChecks className="w-4 h-4 mr-1.5" aria-hidden="true" /> Assign items
          </Button>
          <Button size="sm" onClick={() => setEdit({ ...EMPTY, location_id: locations[0]?.id })}>
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" /> Add station
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {stations === null ? (
          <div className="px-6 py-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : stations.length === 0 ? (
          <div className="px-6 py-6 text-sm text-muted-foreground">
            No stations yet, so every item prints on one KOT. Add &ldquo;Kitchen&rdquo; and &ldquo;Bar&rdquo; to split tickets.
          </div>
        ) : (
          <ul className="divide-y border-t">
            {stations.map((s) => (
              <li key={s.id} className="px-6 py-3 flex items-center gap-3">
                <span className="w-12 shrink-0 text-center rounded-md bg-muted py-1 text-xs font-semibold">{s.ticket_label}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{s.name}</span>
                    {Number(s.is_default) ? <Badge variant="outline">Default</Badge> : null}
                    {!Number(s.is_active) ? <Badge variant="outline" className="text-muted-foreground">Off</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {locName(s.location_id)} · {s.printer_name || "Kitchen (KOT) printer"} · {s.paper_width}
                    {direct ? "" : ` · ${s.device_name ? `PC: ${s.device_name}` : "any kitchen PC"}`} · {Number(s.item_count)} items
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => setEdit({ ...s })}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 className="w-4 h-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(v) => { if (!v) setEdit(null); }}>
        <DialogContent size="sm">
          <DialogHeader className="text-left">
            <DialogTitle>{edit?.id ? "Edit station" : "Add station"}</DialogTitle>
            <DialogDescription>Where these items are made, and which printer prints their tickets.</DialogDescription>
          </DialogHeader>
          {edit && (
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label htmlFor="st-name" className="text-sm font-medium">Name</label>
                  <Input id="st-name" value={edit.name || ""} placeholder="Bar" autoFocus className="mt-1.5 h-10"
                    onChange={(e) => setEdit({ ...edit, name: e.target.value.slice(0, 100) })} />
                </div>
                <div>
                  <label htmlFor="st-label" className="text-sm font-medium">Ticket title</label>
                  <Input id="st-label" value={edit.ticket_label || ""} placeholder="BOT" className="mt-1.5 h-10 uppercase"
                    onChange={(e) => setEdit({ ...edit, ticket_label: e.target.value.toUpperCase().slice(0, 20) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Ticket title is printed at the top: <b>{edit.ticket_label || "KOT"} #21</b>. Name is the place, e.g. Bar.
              </p>
              <div>
                <label htmlFor="st-loc" className="text-sm font-medium">Location</label>
                <select id="st-loc" value={edit.location_id || ""} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                  onChange={(e) => setEdit({ ...edit, location_id: Number(e.target.value), device_id: null })}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              {!direct && <div>
                <label htmlFor="st-dev" className="text-sm font-medium">Kitchen PC</label>
                <select id="st-dev" value={edit.device_id || ""} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                  onChange={(e) => setEdit({ ...edit, device_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Any kitchen PC at this location</option>
                  {locDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>}
              {/* Printer is chosen on the kitchen PC itself (BizzFlow Printer -> Kitchen stations).
                  Here it's only shown, or picked from the list that PC reported. */}
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Printer</span>
                  <span className="text-muted-foreground truncate">{edit.printer_name ? `${edit.printer_name} · ${edit.paper_width || '80mm'}` : 'Not chosen yet'}</span>
                </div>
                {printerOptions.length > 0 ? (
                  <select id="st-printer" aria-label="Printer" value={edit.printer_name || ""} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                    onChange={(e) => setEdit({ ...edit, printer_name: e.target.value })}>
                    <option value="">{direct ? "KOT printer from the list above" : "Kitchen PC's main printer"}</option>
                    {edit.printer_name && !printerOptions.includes(edit.printer_name) && <option value={edit.printer_name}>{edit.printer_name} (not on {direct ? "this" : "that"} PC)</option>}
                    {printerOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : null}
                {direct ? (
                  <p className="text-xs text-muted-foreground">
                    {localPrinters === null ? "Looking for printers on this PC…"
                      : localPrinters.length ? "Printers installed on this POS PC. Set up stations on the terminal that prints."
                      : "BizzFlow Printer isn't running on this PC, so its printers can't be listed. Open it and reopen this form."}
                  </p>
                ) : (
                <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-0.5">
                  <li>Save this station.</li>
                  <li>On the kitchen PC open <b>BizzFlow Printer</b> → <b>Kitchen stations</b>.</li>
                  <li>Pick the printer for <b>{edit.name || 'this station'}</b>. It saves here automatically.</li>
                </ol>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={!!Number(edit.is_default)} onCheckedChange={(v) => setEdit({ ...edit, is_default: v ? 1 : 0 })} />
                  Default station
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={!!Number(edit.is_active ?? 1)} onCheckedChange={(v) => setEdit({ ...edit, is_active: v ? 1 : 0 })} />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                <Button type="submit" disabled={saving || !edit.name?.trim() || !edit.location_id}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AssignItemsDialog open={assignOpen} onOpenChange={(v) => { setAssignOpen(v); if (!v) void load(); }} stations={stations || []} locName={locName} />
    </Card>
  );
}

/** Bulk: pick items (search / filter by station), then set their station in one go. */
function AssignItemsDialog({ open, onOpenChange, stations, locName }: {
  open: boolean; onOpenChange: (v: boolean) => void; stations: PrintStation[]; locName: (id: number) => string;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState("");
  const [lists, setLists] = useState<{ categories: Array<{ id: number; name: string }>; collections: Array<{ id: number; name: string }> }>({ categories: [], collections: [] });
  useEffect(() => { if (open && !lists.categories.length && !lists.collections.length) fetchStationItemFilters().then(setLists).catch(() => {}); }, [open]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: StationItem[]; total: number; per_page: number } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const stationName = useMemo(() => {
    const m = new Map<number, string>();
    stations.forEach(s => m.set(Number(s.id), stations.length > 1 && new Set(stations.map(x => x.location_id)).size > 1 ? `${s.name} (${locName(s.location_id)})` : s.name));
    return m;
  }, [stations, locName]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetchStationItems({ q, station: filter, category, collection }, page).then(setData).catch(() => setData({ items: [], total: 0, per_page: 50 }));
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, filter, category, collection, page]);

  useEffect(() => { setPage(1); }, [q, filter, category, collection]);
  useEffect(() => { if (!open) { setSel(new Set()); setQ(""); setFilter("all"); setCategory(""); setCollection(""); setTarget(""); } }, [open]);

  const items = data?.items || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;
  const allOnPage = items.length > 0 && items.every(i => sel.has(i.id));
  const toggle = (id: number) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePage = () => setSel(prev => { const n = new Set(prev); items.forEach(i => allOnPage ? n.delete(i.id) : n.add(i.id)); return n; });

  const apply = async () => {
    if (!sel.size || target === "") return;
    setBusy(true);
    try {
      await assignItemsToStation(target === "none" ? null : Number(target), Array.from(sel));
      toast({ title: `${sel.size} item(s) updated` });
      setSel(new Set());
      const fresh = await fetchStationItems({ q, station: filter, category, collection }, page);
      setData(fresh);
    } catch (err: any) {
      toast({ title: "Couldn't update items", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="flex flex-col gap-3 sm:h-[min(760px,calc(100dvh-2rem))]">
        <DialogHeader className="text-left pr-8">
          <DialogTitle>Assign items to stations</DialogTitle>
          <DialogDescription>Select items, choose a station, apply. Items left on &ldquo;Default&rdquo; print at the default station.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, barcode" className="h-10 pl-8" aria-label="Search items" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by station"
            className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">All items</option>
            <option value="none">Default (no station)</option>
            {stations.map(s => <option key={s.id} value={s.id}>{stationName.get(Number(s.id))}</option>)}
          </select>
          {lists.categories.length > 0 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"
              className="h-10 max-w-[180px] rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All categories</option>
              {lists.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {lists.collections.length > 0 && (
            <select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="Filter by collection"
              className="h-10 max-w-[180px] rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All collections</option>
              {lists.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"><Checkbox checked={allOnPage} onCheckedChange={togglePage} aria-label="Select page" /></th>
                <th className="px-2 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Station</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data === null ? (
                <tr><td colSpan={3} className="px-3 py-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-6 text-muted-foreground">No items found.</td></tr>
              ) : items.map(i => (
                <tr key={i.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => toggle(i.id)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(i.id)} onCheckedChange={() => toggle(i.id)} aria-label={`Select ${i.part_name}`} /></td>
                  <td className="px-2 py-2"><div className="font-medium">{i.part_name}</div>{i.sku ? <div className="text-xs text-muted-foreground">{i.sku}</div> : null}</td>
                  <td className="px-2 py-2 text-muted-foreground">{i.print_station_id ? (stationName.get(Number(i.print_station_id)) || "—") : "Default"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{data ? `${data.total} items` : ""}{sel.size ? ` · ${sel.size} selected` : ""}</span>
          {data && data.total > items.length && sel.size < data.total && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={async () => {
              try { const ids = await fetchStationItemIds({ q, station: filter, category, collection }); setSel(new Set(ids)); }
              catch (err: any) { toast({ title: "Couldn't select items", description: err?.message, variant: "destructive" }); }
            }}>Select all {data.total}</Button>
          )}
          {sel.size > 0 && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setSel(new Set())}>Clear</Button>}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs tabular-nums">{page} / {pages}</span>
            <Button variant="ghost" size="icon" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Station to assign"
              className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Move selected to…</option>
              <option value="none">Default station</option>
              {stations.map(s => <option key={s.id} value={s.id}>{stationName.get(Number(s.id))}</option>)}
            </select>
            <Button onClick={apply} disabled={busy || !sel.size || target === ""}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { fetchParts, fetchInventoryBatches, type PartRow } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Printer, Search, Plus, Trash2, Layers, Loader2, X, AlertTriangle, Copy } from "lucide-react";
import {
  DEFAULT_SETTINGS, TEMPLATES, SYMBOLOGY_INFO, labelHtml, cutWrap, makeBarcode, printDocument, labelWidth,
  type LabelData, type LabelSettings, type Symbology, type DateFormat,
} from "@/lib/barcode/label";

interface Batch { id: number; batch_number: string; mfg_date: string | null; expiry_date: string | null; quantity_on_hand: number }
interface Line {
  key: string;
  part: PartRow;
  qty: number;
  batches: Batch[] | null; // null while loading
  batchId: string;         // "" = no batch
  batch: string;
  mfg: string;
  exp: string;
  price: string;
}

const LS_SETTINGS = "barcode_label_settings_v2";
const SYM_GROUPS = ["Retail", "Industrial / logistics", "2D"] as const;
const symList = Object.entries(SYMBOLOGY_INFO) as Array<[Symbology, (typeof SYMBOLOGY_INFO)[Symbology]]>;
const ROLL_PRESETS: Array<[string, number, number]> = [
  ["38 × 25 mm", 38, 25], ["50 × 25 mm", 50, 25], ["50 × 30 mm", 50, 30], ["60 × 40 mm", 60, 40],
  ["75 × 50 mm", 75, 50], ["100 × 50 mm", 100, 50], ["100 × 150 mm (shipping)", 100, 150],
];

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: string, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const currentLocation = () => { try { return window.localStorage.getItem("location_id") || "1"; } catch { return "1"; } };

export default function BarcodePrinterPage() {
  const { toast } = useToast();
  const [s, setS] = useState<LabelSettings>(DEFAULT_SETTINGS);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Settings survive reloads on this PC.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_SETTINGS);
      if (raw) {
        const p = JSON.parse(raw);
        const merged = { ...DEFAULT_SETTINGS, ...p, show: { ...DEFAULT_SETTINGS.show, ...(p.show || {}) } };
        if (!SYMBOLOGY_INFO[merged.symbology as Symbology]) merged.symbology = "code128";
        setS(merged);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { window.localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  const set = (patch: Partial<LabelSettings>) => setS((p) => ({ ...p, ...patch }));
  const setShow = (k: keyof LabelSettings["show"], v: boolean) => setS((p) => ({ ...p, show: { ...p.show, [k]: v } }));

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await fetchParts(query); setResults(Array.isArray(r) ? r.slice(0, 30) : []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResultsOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const patchLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const applyBatch = (key: string, batches: Batch[], id: string) => {
    const b = batches.find((x) => String(x.id) === id);
    patchLine(key, b
      ? { batchId: id, batch: b.batch_number === "UNBATCHED" ? "" : b.batch_number, mfg: b.mfg_date?.slice(0, 10) || "", exp: b.expiry_date?.slice(0, 10) || "" }
      : { batchId: "", batch: "", mfg: "", exp: "" });
  };

  const addPart = async (part: PartRow) => {
    const key = `${part.id}-${Date.now()}`;
    setLines((ls) => [...ls, { key, part, qty: 1, batches: null, batchId: "", batch: "", mfg: "", exp: "", price: part.price != null ? String(part.price) : "" }]);
    setQuery(""); setResults([]); setResultsOpen(false);
    try {
      const raw = await fetchInventoryBatches(part.id, currentLocation());
      const batches: Batch[] = (Array.isArray(raw) ? raw : [])
        .filter((b: any) => Number(b.id) > 0)
        .map((b: any) => ({ id: Number(b.id), batch_number: String(b.batch_number ?? ""), mfg_date: b.mfg_date, expiry_date: b.expiry_date, quantity_on_hand: Number(b.quantity_on_hand ?? 0) }))
        .sort((a, b) => String(a.expiry_date || "9999").localeCompare(String(b.expiry_date || "9999"))); // first to expire first
      patchLine(key, { batches });
      if (batches.length) applyBatch(key, batches, String(batches[0].id));
    } catch {
      patchLine(key, { batches: [] });
    }
  };

  const toLabel = (l: Line): LabelData => ({
    name: l.part.part_name, sku: l.part.sku, barcode: (l.part as any).barcode_number || l.part.sku || `ITEM-${l.part.id}`,
    price: l.price === "" ? null : num(l.price), unit: l.part.unit, batch: l.batch || null, mfg: l.mfg || null, exp: l.exp || null,
  });

  const labels = useMemo(() => lines.flatMap((l) => Array(Math.max(0, l.qty)).fill(toLabel(l))), [lines]);
  const lineErrors = useMemo(() => Object.fromEntries(lines.map((l) => [l.key, makeBarcode(toLabel(l), s)])), [lines, s]);
  const badLines = lines.filter((l) => lineErrors[l.key]?.error).length;

  const symInfo = SYMBOLOGY_INFO[s.symbology] ?? SYMBOLOGY_INFO.code128;
  const sample: LabelData = { name: "Sample Product 500g", sku: "SKU-1001", barcode: symInfo.sample, price: 1250, batch: "B2611-07", mfg: today(), exp: "2027-05-31" };
  const previewData = lines[0] ? toLabel(lines[0]) : sample;
  const previewHtml = useMemo(() => cutWrap(labelHtml(previewData, s), s), [previewData, s]);
  const wMm = labelWidth(s);
  const scale = Math.min(2.4, 300 / (wMm * 3.78));

  const print = () => {
    if (labels.length === 0) { toast({ title: "Nothing to print", description: "Add items to the queue first.", variant: "destructive" }); return; }
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Popup blocked", description: "Allow popups for this site to print labels.", variant: "destructive" }); return; }
    w.document.open(); w.document.write(printDocument(labels, s)); w.document.close();
  };

  const fillFromStock = () => setLines((ls) => ls.map((l) => {
    const b = l.batches?.find((x) => String(x.id) === l.batchId);
    const q = b ? b.quantity_on_hand : Number(l.part.stock_quantity ?? 0);
    return { ...l, qty: Math.max(1, Math.round(q)) };
  }));

  const sw = (k: keyof LabelSettings["show"], label: string, disabled = false) => (
    <label className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      {label}<Switch checked={s.show[k]} onCheckedChange={(v) => setShow(k, v)} disabled={disabled} />
    </label>
  );
  const numField = (label: string, value: number, onChange: (n: number) => void, step = 1) => (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type="number" step={step} className="h-8 text-sm tabular-nums" value={value} onChange={(e) => onChange(num(e.target.value, value))} />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="w-full space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Barcode & Label Printer</h1>
            <p className="text-xs text-muted-foreground">Price tags and product labels with batch, manufacture and expiry dates · Code 128, GS1-128, EAN-13, QR</p>
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={print} disabled={labels.length === 0}>
            <Printer className="h-4 w-4" /> Print {labels.length} label{labels.length === 1 ? "" : "s"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          {/* LEFT: items */}
          <Card className="shadow-sm xl:col-span-7">
            <CardContent className="space-y-3 p-3">
              <div ref={searchRef} className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search item to add (name, SKU, barcode)…" className="h-9 pl-8 text-sm" value={query}
                  onChange={(e) => { setQuery(e.target.value); setResultsOpen(true); }} onFocus={() => setResultsOpen(true)} />
                {searching && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                {resultsOpen && query.trim().length >= 2 && !searching && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {results.length === 0 ? <div className="px-3 py-3 text-xs text-muted-foreground">No items found</div> : results.map((p) => (
                      <button key={p.id} type="button" onClick={() => void addPart(p)} className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-muted">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{p.part_name}</div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">{[(p as any).barcode_number, p.sku].filter(Boolean).join(" · ") || `#${p.id}`}</div>
                        </div>
                        <div className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          <div>{Number(p.stock_quantity ?? 0).toLocaleString()} {p.unit ?? ""}</div>
                          <div>{s.currency} {Number(p.price ?? 0).toFixed(2)}</div>
                        </div>
                        <Plus className="h-4 w-4 shrink-0 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Print queue · {lines.length} item{lines.length === 1 ? "" : "s"} · {labels.length} labels
                  {badLines > 0 && <span className="ml-2 normal-case text-destructive">· {badLines} can’t print as {symInfo.label}</span>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={fillFromStock} disabled={!lines.length}><Layers className="h-3.5 w-3.5" /> Qty = stock</Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => setLines([])} disabled={!lines.length}><Trash2 className="h-3.5 w-3.5" /> Clear</Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                  <Printer className="h-8 w-8" />
                  <p className="text-sm font-medium text-foreground">Queue is empty</p>
                  <p className="max-w-xs text-xs">Search an item above. Its batches load automatically, with the first to expire picked.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lines.map((l, idx) => {
                    const bc = lineErrors[l.key];
                    return (
                      <div key={l.key} className={`rounded-lg border p-2.5 ${bc?.error ? "border-destructive/50 bg-destructive/5" : ""}`}>
                        <div className="flex items-start gap-2">
                          <span className="mt-1 w-5 text-xs text-muted-foreground">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{l.part.part_name}</div>
                            <div className="truncate font-mono text-[11px] text-muted-foreground">{(l.part as any).barcode_number || l.part.sku || `ITEM-${l.part.id}`}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-[11px] text-muted-foreground">Labels</Label>
                            <Input type="number" min={1} className="h-8 w-16 text-center text-sm" value={l.qty}
                              onChange={(e) => patchLine(l.key, { qty: Math.max(0, parseInt(e.target.value) || 0) })} aria-label={`Label count for ${l.part.part_name}`} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Duplicate (e.g. another batch)"
                              onClick={() => setLines((ls) => { const i = ls.findIndex((x) => x.key === l.key); const c = { ...l, key: `${l.key}-c${Date.now()}` }; return [...ls.slice(0, i + 1), c, ...ls.slice(i + 1)]; })}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 pl-7 md:grid-cols-5">
                          <div className="col-span-2 space-y-1 md:col-span-1">
                            <Label className="text-[11px] text-muted-foreground">Batch</Label>
                            {l.batches === null ? (
                              <div className="flex h-8 items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading</div>
                            ) : (
                              <Select value={l.batchId || "none"} onValueChange={(v) => applyBatch(l.key, l.batches || [], v === "none" ? "" : v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{l.batches.length ? "No batch / type it" : "No batches"}</SelectItem>
                                  {l.batches.map((b) => (
                                    <SelectItem key={b.id} value={String(b.id)}>
                                      {b.batch_number} · {Number(b.quantity_on_hand).toLocaleString()}{b.expiry_date ? ` · exp ${b.expiry_date.slice(0, 10)}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Batch no</Label>
                            <Input className="h-8 text-xs" value={l.batch} onChange={(e) => patchLine(l.key, { batch: e.target.value })} placeholder="—" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">MFG date</Label>
                            <Input type="date" className="h-8 text-xs" value={l.mfg} onChange={(e) => patchLine(l.key, { mfg: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">EXP date</Label>
                            <Input type="date" className={`h-8 text-xs ${l.exp && l.mfg && l.exp < l.mfg ? "border-destructive" : ""}`} value={l.exp} onChange={(e) => patchLine(l.key, { exp: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Price ({s.currency})</Label>
                            <Input type="number" step="0.01" className="h-8 text-xs tabular-nums" value={l.price} onChange={(e) => patchLine(l.key, { price: e.target.value })} />
                          </div>
                        </div>
                        {(bc?.error || bc?.note || (l.exp && l.mfg && l.exp < l.mfg)) && (
                          <div className={`mt-1.5 flex items-center gap-1 pl-7 text-[11px] ${bc?.error || (l.exp && l.mfg && l.exp < l.mfg) ? "text-destructive" : "text-amber-600"}`}>
                            <AlertTriangle className="h-3 w-3" />
                            {bc?.error || (l.exp && l.mfg && l.exp < l.mfg ? "Expiry date is before the manufacture date" : bc?.note)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: design + preview */}
          <div className="space-y-3 xl:col-span-5">
            <Card className="shadow-sm">
              <CardContent className="space-y-3 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview {lines[0] ? `· ${lines[0].part.part_name}` : "· sample"}</div>
                <div className="flex justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#0000000a_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4">
                  <div style={{ width: wMm * 3.78 * scale, height: s.height * 3.78 * scale }}>
                    <div className="shadow-md ring-1 ring-black/10" style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${wMm}mm`, height: `${s.height}mm` }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">{wMm.toFixed(1)} × {s.height} mm · {s.layout === "roll" ? "one label per page (thermal roll)" : `A4 sheet, ${s.cols} across`}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="space-y-4 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Template</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(TEMPLATES).map(([k, t]) => (
                      <button key={k} type="button" onClick={() => setS((p) => ({ ...p, ...t.apply, show: { ...p.show, ...(t.apply.show || {}) } }))}
                        className="rounded-md border px-2.5 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5">
                        <div className="text-xs font-medium">{t.label}</div>
                        <div className="text-[10px] text-muted-foreground">{t.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Barcode type</Label>
                  <Select value={s.symbology} onValueChange={(v) => set({ symbology: v as Symbology })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SYM_GROUPS.map((g) => (
                        <SelectGroup key={g}>
                          <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{g}</SelectLabel>
                          {symList.filter(([, i]) => i.group === g).map(([k, i]) => <SelectItem key={k} value={k}>{i.label}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{symInfo.hint}</p>
                  {(s.symbology === "gs1128" || s.symbology === "gs1dm") && (
                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                      Put price in the barcode (AI 3922, for weighed items)
                      <Switch checked={s.gs1Price} onCheckedChange={(v) => set({ gs1Price: v })} />
                    </label>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Show on label</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {sw("name", "Item name")}
                    {sw("price", "Price")}
                    {sw("batch", "Batch no")}
                    {sw("mfg", "MFG date")}
                    {sw("exp", "EXP date")}
                    {sw("hri", "Code under barcode", !!symInfo.twoD)}
                    {sw("sku", "SKU")}
                    {sw("header", "Shop name")}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 space-y-1 sm:col-span-1">
                      <Label className="text-[11px] text-muted-foreground">Shop name</Label>
                      <Input className="h-8 text-xs" value={s.header} onChange={(e) => set({ header: e.target.value })} placeholder="Your shop" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Currency</Label>
                      <Input className="h-8 text-xs" value={s.currency} onChange={(e) => set({ currency: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Date format</Label>
                      <Select value={s.dateFormat} onValueChange={(v) => set({ dateFormat: v as DateFormat })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dd/mm/yyyy">31/05/2027</SelectItem>
                          <SelectItem value="yyyy-mm-dd">2027-05-31</SelectItem>
                          <SelectItem value="mm/yyyy">05/2027</SelectItem>
                          <SelectItem value="dd mmm yyyy">31 MAY 2027</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Paper</Label>
                  <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-0.5">
                    {(["roll", "grid"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => set({ layout: m })}
                        className={`rounded px-2 py-1 text-xs font-medium ${s.layout === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                        {m === "roll" ? "Thermal label roll" : "A4 sticker sheet"}
                      </button>
                    ))}
                  </div>
                  {s.layout === "roll" && (
                    <Select value={ROLL_PRESETS.find(([, w, h]) => w === s.width && h === s.height)?.[0] ?? "custom"}
                      onValueChange={(v) => { const p = ROLL_PRESETS.find(([n]) => n === v); if (p) set({ width: p[1], height: p[2] }); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLL_PRESETS.map(([n]) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        <SelectItem value="custom">Custom size</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {s.layout === "roll" && numField("Width (mm)", s.width, (n) => set({ width: Math.max(10, n) }), 0.1)}
                    {numField("Height (mm)", s.height, (n) => set({ height: Math.max(10, n) }), 0.1)}
                    {numField("Padding (mm)", s.padding, (n) => set({ padding: Math.max(0, n) }), 0.5)}
                    {s.layout === "grid" && numField("Columns", s.cols, (n) => set({ cols: Math.max(1, Math.round(n)) }))}
                    {s.layout === "grid" && numField("Gap (mm)", s.gap, (n) => set({ gap: Math.max(0, n) }), 0.5)}
                    {s.layout === "grid" && numField("Top margin", s.marginTop, (n) => set({ marginTop: Math.max(0, n) }), 0.5)}
                    {s.layout === "grid" && numField("Side margin", s.marginLeft, (n) => set({ marginLeft: Math.max(0, n) }), 0.5)}
                  </div>
                  {s.layout === "grid" && (
                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                      Cutting lines between labels
                      <Switch checked={s.cutLines !== false} onCheckedChange={(v) => set({ cutLines: v })} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground">Barcode height <span className="font-medium text-foreground">{s.barHeight} mm</span></div>
                    <Slider min={5} max={40} step={0.5} value={[s.barHeight]} onValueChange={(v) => set({ barHeight: v[0] })} disabled={!!symInfo.twoD} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground">Text size <span className="font-medium text-foreground">{s.fontSize} pt</span></div>
                    <Slider min={5} max={14} step={0.5} value={[s.fontSize]} onValueChange={(v) => set({ fontSize: v[0] })} />
                  </div>
                </div>

                <Button className="h-10 w-full gap-2" onClick={print} disabled={labels.length === 0}>
                  <Printer className="h-4 w-4" /> Print {labels.length} label{labels.length === 1 ? "" : "s"}
                </Button>
                {badLines > 0 && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive"><X className="h-3 w-3" /> {badLines} item(s) will print an error box instead of a barcode. Change the barcode type or fix their codes.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

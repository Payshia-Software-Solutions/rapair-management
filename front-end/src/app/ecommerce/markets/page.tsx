"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Download, Upload, Save, Globe } from "lucide-react";
import { marketApi } from "@/lib/api/markets";
import { BestSellersTab } from "./BestSellersTab";
import { countryOptions, getCountryPreset, getLanguageName, getLanguagePreset } from "@/lib/market-country";

const emptyMarket = {
  code: "", name: "", country_code: "", currency_code: "", language_code: "en", locale: "en",
  location_id: "", stock_location_id: "", uses_price_list: 1, is_default: 0, is_active: 1, sort_order: 0,
  checkout_mode: "quote", quote_notify_email: "", quote_message: "",
};

// "2026-11-14 09:00:00" (MySQL) <-> "2026-11-14T09:00" (datetime-local input)
const toInput = (v: any) => (v ? String(v).slice(0, 16).replace(" ", "T") : "");
const toApi = (v: string) => (v ? v.replace("T", " ") + ":00" : "");
const emptyCurrency = { code: "", name: "", symbol: "", decimals: "2", rate_to_base: "0", is_active: 1 };

export default function MarketsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"markets" | "currencies" | "prices" | "best-sellers">("markets");
  const [markets, setMarkets] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [mForm, setMForm] = useState<any>(null);
  const [cForm, setCForm] = useState<any>(null);
  const marketDialogOpen = !!mForm;

  const [priceMarket, setPriceMarket] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<number, { price: string; cmp: string; from: string; to: string }>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [loadedPriceMarket, setLoadedPriceMarket] = useState("");
  const priceRequest = useRef(0);
  const [usdMarketId, setUsdMarketId] = useState("");
  const [usdPrices, setUsdPrices] = useState<{ marketId: string; byPart: Record<number, string> } | null>(null);
  const [usdEntries, setUsdEntries] = useState<Record<number, string>>({});
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, c, l] = await Promise.all([marketApi.markets(), marketApi.currencies(), marketApi.locations()]);
      setMarkets(m || []);
      setCurrencies(c || []);
      setLocations(l || []);
      if (!priceMarket && m?.length) setPriceMarket(String(m[0].id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!marketDialogOpen) return;
    let active = true;
    marketApi.currencies()
      .then((rows) => { if (active) setCurrencies(rows ?? []); })
      .catch((error: Error) => {
        if (active) toast({ title: "Could not refresh ERP currencies", description: error.message, variant: "destructive" });
      });
    return () => { active = false; };
  }, [marketDialogOpen, toast]);

  const market = useMemo(() => markets.find((m) => String(m.id) === priceMarket), [markets, priceMarket]);

  const loadPrices = async () => {
    if (!priceMarket) return;
    const request = ++priceRequest.current;
    setPriceLoading(true);
    try {
      const r = await marketApi.prices(Number(priceMarket));
      if (request !== priceRequest.current) return;
      setItems(r.items || []);
      setLoadedPriceMarket(priceMarket);
      setEdits({});
    } catch (e: any) {
      if (request === priceRequest.current) toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      if (request === priceRequest.current) setPriceLoading(false);
    }
  };
  useEffect(() => { if (tab === "prices") loadPrices(); }, [tab, priceMarket]);

  useEffect(() => {
    if (tab !== "prices" || !usdMarketId) return;
    let active = true;
    marketApi.prices(Number(usdMarketId))
      .then((result) => {
        if (!active) return;
        const byPart = Object.fromEntries((result.items ?? [])
          .filter((item: { market_price: string | number | null }) => item.market_price != null)
          .map((item: { id: number; market_price: string | number }) => [item.id, String(item.market_price)]));
        setUsdPrices({ marketId: usdMarketId, byPart });
      })
      .catch((error: Error) => {
        if (active) toast({ title: "Could not load USD prices", description: error.message, variant: "destructive" });
      });
    return () => { active = false; };
  }, [tab, usdMarketId, toast]);

  const countryPreset = getCountryPreset(mForm?.country_code);
  const international = !!mForm?.country_code && mForm.country_code !== "LK";
  const checkoutMode = international ? "quote" : mForm?.checkout_mode || "quote";
  const suggestedCurrency = countryPreset?.currencies[0];
  const localCurrencyCodes = countryPreset?.currencies ?? [];
  const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
  const currencyOptions = [
    ...localCurrencyCodes.map((code) => ({
      value: code,
      label: `${code} - ${currencies.find((currency) => currency.code === code)?.name ?? currencyNames.of(code)}`,
    })),
    ...currencies
      .filter((currency) => !localCurrencyCodes.includes(currency.code))
      .map((currency) => ({ value: currency.code, label: `${currency.code} - ${currency.name}` })),
  ];

  const selectCountry = (code: string) => {
    const preset = getCountryPreset(code);
    if (!preset) return;

    setMForm((current: typeof emptyMarket) => ({
      ...current,
      country_code: code,
      ...(current.country_code === code ? { currency_code: current.currency_code || preset.currencies[0] || "" } : {
        code: code.toLowerCase(),
        name: preset.name,
        currency_code: preset.currencies[0] ?? "",
        ...getLanguagePreset("en", code),
        checkout_mode: code === "LK" ? "online" : "quote",
      }),
    }));
  };

  const saveMarket = async () => {
    try {
      await marketApi.save(mForm.id || null, {
        ...mForm,
        checkout_mode: checkoutMode,
        location_id: Number(mForm.location_id),
        stock_location_id: mForm.stock_location_id ? Number(mForm.stock_location_id) : null,
      });
      toast({ title: "Market saved" });
      setMForm(null);
      loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const deleteMarket = async (m: any) => {
    if (!confirm(`Delete market ${m.name}? Its price list is removed too.`)) return;
    try {
      await marketApi.remove(m.id);
      toast({ title: "Market deleted" });
      loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const saveCurrency = async () => {
    try {
      await marketApi.saveCurrency({ ...cForm, decimals: Number(cForm.decimals), rate_to_base: Number(cForm.rate_to_base) });
      toast({ title: "Currency saved" });
      setCForm(null);
      loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const valueOf = (it: any) => edits[it.id] ?? { price: it.market_price ?? "", cmp: it.compare_at_price ?? "", from: toInput(it.sale_from), to: toInput(it.sale_to) };
  const setEdit = (it: any, patch: Partial<{ price: string; cmp: string; from: string; to: string }>) =>
    setEdits((e) => ({ ...e, [it.id]: { ...valueOf(it), ...patch } }));
  const dirty = Object.keys(edits).length;

  const priceListReady = !!priceMarket && loadedPriceMarket === priceMarket && !priceLoading;
  const savePrices = async () => {
    if (!priceListReady || saving) return;
    setSaving(true);
    try {
      const payload = Object.entries(edits).map(([id, v]) => ({ part_id: Number(id), price: v.price, compare_at_price: v.cmp, sale_from: toApi(v.from), sale_to: toApi(v.to) }));
      const r = await marketApi.savePrices(Number(priceMarket), payload);
      toast({ title: `Saved ${r.saved}, removed ${r.removed}`, description: r.errors?.join("; ") || undefined });
      loadPrices();
      loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const q = (s: any) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    const rows = [
      "sku,name,price,compare_at_price",
      ...items.map((it) => {
        const v = valueOf(it);
        return [q(it.sku), q(it.name), v.price, v.cmp].join(",");
      }),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = `prices-${market?.code || "market"}.csv`;
    a.click();
  };

  const splitCsv = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const importCsv = async (file: File) => {
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast({ title: "CSV is empty", variant: "destructive" });
    const head = splitCsv(lines[0]).map((h) => h.toLowerCase());
    const iSku = head.indexOf("sku");
    const iPrice = head.indexOf("price");
    const iCmp = head.indexOf("compare_at_price");
    if (iSku < 0 || iPrice < 0) return toast({ title: "CSV needs sku and price columns", variant: "destructive" });
    const bySku = new Map(items.map((it) => [String(it.sku), it]));
    const next = { ...edits };
    let matched = 0;
    const unknown: string[] = [];
    for (const l of lines.slice(1)) {
      const c = splitCsv(l);
      const it = bySku.get(c[iSku]);
      if (!it) { unknown.push(c[iSku]); continue; }
      next[it.id] = { price: c[iPrice] ?? "", cmp: iCmp >= 0 ? c[iCmp] ?? "" : "", from: toInput(it.sale_from), to: toInput(it.sale_to) };
      matched++;
    }
    setEdits(next);
    toast({
      title: `Loaded ${matched} row(s). Review, then Save`,
      description: unknown.length ? `Unknown SKUs: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "..." : ""}` : undefined,
    });
  };

  const shown = items.filter((it) => !filter || `${it.sku} ${it.name}`.toLowerCase().includes(filter.toLowerCase()));
  const targetCurrency = market?.currency_code;
  const canConvertUsd = !!targetCurrency && targetCurrency !== "USD";
  const usdRateToBase = Number(currencies.find((currency) => currency.code === "USD")?.rate_to_base);
  const targetRateToBase = Number(currencies.find((currency) => currency.code === targetCurrency)?.rate_to_base);
  const savedRate = usdRateToBase > 0 && targetRateToBase > 0 ? usdRateToBase / targetRateToBase : 0;
  const rateValue = exchangeRate ?? (savedRate > 0 ? String(Number(savedRate.toPrecision(10))) : "");
  const conversionRate = Number(rateValue);
  // The ERP price-list columns store up to two fractional digits.
  const targetDecimals = Math.max(0, Math.min(2, Number(market?.currency_decimals ?? 2)));
  const priceFormatter = new Intl.NumberFormat("en", {
    useGrouping: false,
    minimumFractionDigits: targetDecimals,
    maximumFractionDigits: targetDecimals,
  });

  const usdAmount = (id: number) =>
    usdEntries[id] ?? (usdPrices?.marketId === usdMarketId ? usdPrices.byPart[id] : undefined) ?? "";

  const convertedPrice = (id: number) => {
    const amount = usdAmount(id);
    const converted = Number(amount) * conversionRate;
    if (!amount.trim() || !Number.isFinite(converted) || converted < 0 || converted >= 1e10 || !(conversionRate > 0)) return null;
    const rounded = priceFormatter.format(converted);
    return Number(rounded) < 1e10 ? rounded : null;
  };

  const fillableUsdPrices = canConvertUsd && priceListReady
    ? shown.filter((item) => valueOf(item).price === "" && convertedPrice(item.id) !== null)
    : [];

  const fillFromUsd = () => {
    const changes = Object.fromEntries(fillableUsdPrices.map((item) => [
      item.id,
      { ...valueOf(item), price: convertedPrice(item.id)! },
    ]));
    setEdits((current) => ({ ...current, ...changes }));
  };

  const changePriceMarket = (id: string) => {
    priceRequest.current++;
    setPriceMarket(id);
    setLoadedPriceMarket("");
    setEdits({});
    setUsdEntries({});
    setExchangeRate(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6" /> Markets and Price Lists</h1>
          <p className="text-sm text-muted-foreground">Countries the online store sells in, their currency and fixed prices.</p>
        </div>

        <div className="flex gap-2">
          {(["markets", "currencies", "prices", "best-sellers"] as const).map((t) => (
            <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
              {t === "markets" ? "Markets" : t === "currencies" ? "Currencies" : t === "prices" ? "Price lists" : "Best sellers"}
            </Button>
          ))}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : tab === "markets" ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Markets</CardTitle>
                <CardDescription>Add a country here and it appears on the website with no code change.</CardDescription>
              </div>
              <Button onClick={() => setMForm({ ...emptyMarket })}><Plus className="h-4 w-4 mr-1" /> Add market</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Currency</TableHead>
                    <TableHead>Language</TableHead><TableHead>ERP location</TableHead><TableHead>Priced items</TableHead>
                    <TableHead>Status</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markets.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">/{m.code}</TableCell>
                      <TableCell>{m.name} {m.is_default == 1 && <Badge className="ml-1">Home</Badge>}</TableCell>
                      <TableCell>{m.currency_code} ({m.currency_symbol})</TableCell>
                      <TableCell>{m.language_code} / {m.locale}</TableCell>
                      <TableCell>{m.location_name}</TableCell>
                      <TableCell>{m.uses_price_list == 1 ? m.priced_items : "uses base price"}</TableCell>
                      <TableCell className="whitespace-nowrap"><Badge variant={m.is_active == 1 ? "default" : "secondary"}>{m.is_active == 1 ? "Active" : "Off"}</Badge> {m.checkout_mode === "quote" && <Badge variant="outline" className="ml-1">Quote requests</Badge>}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => setMForm({ ...m, stock_location_id: m.stock_location_id ?? "" })}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMarket(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!markets.length && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No markets yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : tab === "currencies" ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Currencies</CardTitle>
                <CardDescription>Decimals control rounding (JPY uses 0). Rate to base is stored on each order for reporting.</CardDescription>
              </div>
              <Button onClick={() => setCForm({ ...emptyCurrency })}><Plus className="h-4 w-4 mr-1" /> Add currency</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Symbol</TableHead>
                    <TableHead>Decimals</TableHead><TableHead>Rate to base</TableHead><TableHead>Status</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono">{c.code}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.symbol}</TableCell>
                      <TableCell>{c.decimals}</TableCell>
                      <TableCell>{Number(c.rate_to_base)}</TableCell>
                      <TableCell><Badge variant={c.is_active == 1 ? "default" : "secondary"}>{c.is_active == 1 ? "Active" : "Off"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setCForm({ ...c, decimals: String(c.decimals), rate_to_base: String(Number(c.rate_to_base)) })}><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : tab === "best-sellers" ? (
          <BestSellersTab markets={markets} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Price list</CardTitle>
              <CardDescription>
                Price is what the customer pays. To run a sale, put the normal price in "Regular price" and the sale price in Price; set dates to limit it (blank = always on). Outside the dates the regular price is charged. Leave Price blank to not sell an item here.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Select value={priceMarket} onValueChange={changePriceMarket} disabled={saving}>
                  <SelectTrigger className="w-60"><SelectValue placeholder="Market" /></SelectTrigger>
                  <SelectContent>
                    {markets.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.currency_code})</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="w-56" placeholder="Search SKU or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <Button variant="outline" disabled={!priceListReady || saving} onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
                <Button variant="outline" disabled={!priceListReady || saving} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv(f);
                    e.target.value = "";
                  }}
                />
                <Button disabled={!dirty || saving || !priceListReady} onClick={savePrices}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save {dirty ? `(${dirty})` : ""}
                </Button>
              </div>
              {canConvertUsd && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="usd-price-list">USD source</Label>
                      <Select
                        value={usdMarketId || "manual"}
                        onValueChange={(value) => {
                          setUsdMarketId(value === "manual" ? "" : value);
                          setUsdPrices(null);
                          setUsdEntries({});
                        }}
                      >
                        <SelectTrigger id="usd-price-list" className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Enter USD prices manually</SelectItem>
                          {markets.filter((option) => option.currency_code === "USD").map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>{option.name} (USD)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="usd-exchange-rate">{targetCurrency} per 1 USD</Label>
                      <Input id="usd-exchange-rate" inputMode="decimal" className="w-44" value={rateValue}
                        onChange={(event) => setExchangeRate(event.target.value)} placeholder="Enter exchange rate" />
                    </div>
                    <Button type="button" variant="outline" disabled={saving || !fillableUsdPrices.length} onClick={fillFromUsd}>
                      Fill blank prices ({fillableUsdPrices.length})
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Converts USD amounts into blank prices in the current search results. Review the drafts and click Save to publish.
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {priceLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead><TableHead>Item</TableHead>
                      <TableHead className="text-right">Base price</TableHead>
                      {canConvertUsd && <TableHead className="w-32">Price USD</TableHead>}
                      <TableHead className="w-40">Price {market?.currency_code}</TableHead>
                      <TableHead className="w-40">Regular price (struck through)</TableHead>
                      <TableHead className="w-48">Sale from</TableHead>
                      <TableHead className="w-48">Sale until</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(priceListReady ? shown : []).map((it) => {
                      const v = valueOf(it);
                      return (
                        <TableRow key={it.id} className={edits[it.id] ? "bg-amber-50" : ""}>
                          <TableCell className="font-mono text-xs">{it.sku}</TableCell>
                          <TableCell>{it.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{Number(it.base_price).toFixed(2)}</TableCell>
                          {canConvertUsd && (
                            <TableCell>
                              <Input inputMode="decimal" aria-label={`USD price for ${it.name}`} value={usdAmount(it.id)}
                                onChange={(event) => setUsdEntries((current) => ({ ...current, [it.id]: event.target.value }))} />
                            </TableCell>
                          )}
                          <TableCell><Input inputMode="decimal" value={v.price} onChange={(e) => setEdit(it, { price: e.target.value })} /></TableCell>
                          <TableCell><Input inputMode="decimal" value={v.cmp} onChange={(e) => setEdit(it, { cmp: e.target.value })} /></TableCell>
                          <TableCell><Input type="datetime-local" disabled={!v.cmp} value={v.from} onChange={(e) => setEdit(it, { from: e.target.value })} /></TableCell>
                          <TableCell><Input type="datetime-local" disabled={!v.cmp} value={v.to} onChange={(e) => setEdit(it, { to: e.target.value })} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!mForm} onOpenChange={(o) => !o && setMForm(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{mForm?.id ? "Edit market" : "Add market"}</DialogTitle></DialogHeader>
          {mForm && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Country (ISO)</Label>
                <SearchableSelect
                  value={mForm.country_code}
                  options={countryOptions}
                  onValueChange={selectCountry}
                  placeholder="Select a country"
                  searchPlaceholder="Search country name or ISO code"
                  disablePortal
                />
              </div>
              <div><Label>Market code</Label><Input value={mForm.code} onChange={(e) => setMForm({ ...mForm, code: e.target.value })} placeholder="jp or en-jp" maxLength={5} /></div>
              <div><Label>Name</Label><Input value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="Japan" /></div>
              <div>
                <Label>Currency</Label>
                <SearchableSelect
                  value={mForm.currency_code}
                  onValueChange={(currencyCode) => setMForm({ ...mForm, currency_code: currencyCode })}
                  options={currencyOptions}
                  placeholder="Select currency"
                  searchPlaceholder="Search currency name or code"
                  disablePortal
                />
                {suggestedCurrency && <p className="mt-1 text-xs text-muted-foreground">Country default: {suggestedCurrency}</p>}
              </div>
              {countryPreset && (
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="market-language-preset">Language and locale preset</Label>
                  <Select
                    value={countryPreset.languages.find((language) => getLanguagePreset(language, mForm.country_code).locale === mForm.locale) ?? ""}
                    onValueChange={(language) => setMForm({ ...mForm, ...getLanguagePreset(language, mForm.country_code) })}
                  >
                    <SelectTrigger id="market-language-preset"><SelectValue placeholder="Choose a language preset" /></SelectTrigger>
                    <SelectContent>
                      {countryPreset.languages.map((language) => {
                        const preset = getLanguagePreset(language, mForm.country_code);
                        return <SelectItem key={language} value={language}>{getLanguageName(language)} ({preset.locale})</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Language</Label><Input value={mForm.language_code} onChange={(e) => setMForm({ ...mForm, language_code: e.target.value })} placeholder="ja" /></div>
              <div><Label>Locale</Label><Input value={mForm.locale} onChange={(e) => setMForm({ ...mForm, locale: e.target.value })} placeholder="ja-JP" /></div>
              <div>
                <Label>ERP location (tax, orders)</Label>
                <Select value={String(mForm.location_id || "")} onValueChange={(v) => setMForm({ ...mForm, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stock location (optional)</Label>
                <Select value={String(mForm.stock_location_id || "same")} onValueChange={(v) => setMForm({ ...mForm, stock_location_id: v === "same" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Same as ERP location</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Checkout mode</Label>
                <Select value={checkoutMode} disabled={international} onValueChange={(v) => setMForm({ ...mForm, checkout_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online checkout (pay now)</SelectItem>
                    <SelectItem value="quote">Order request (staff confirm shipping and payment)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Tea Jar takes international orders as quote requests. Staff confirm shipping and payment under Online Orders → Awaiting quote.</p>
              </div>
              {checkoutMode === "quote" && (
                <>
                  <div className="col-span-2"><Label>Notify staff email</Label><Input type="email" value={mForm.quote_notify_email || ""} onChange={(e) => setMForm({ ...mForm, quote_notify_email: e.target.value })} placeholder="orders@example.com" /></div>
                  <div className="col-span-2"><Label>Message shown to the customer after ordering</Label><Input value={mForm.quote_message || ""} onChange={(e) => setMForm({ ...mForm, quote_message: e.target.value })} placeholder="We will contact you within 24 hours with shipping and payment details." /></div>
                </>
              )}
              <div><Label>Sort order</Label><Input type="number" value={mForm.sort_order} onChange={(e) => setMForm({ ...mForm, sort_order: e.target.value })} /></div>
              <div className="col-span-2 space-y-2">
                <div className="flex items-center gap-2"><Switch checked={mForm.uses_price_list == 1} onCheckedChange={(v) => setMForm({ ...mForm, uses_price_list: v ? 1 : 0 })} /><span className="text-sm">Fixed price list (only priced items are sold)</span></div>
                <div className="flex items-center gap-2"><Switch checked={mForm.is_default == 1} onCheckedChange={(v) => setMForm({ ...mForm, is_default: v ? 1 : 0 })} /><span className="text-sm">Home market (site root)</span></div>
                <div className="flex items-center gap-2"><Switch checked={mForm.is_active == 1} onCheckedChange={(v) => setMForm({ ...mForm, is_active: v ? 1 : 0 })} /><span className="text-sm">Active</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMForm(null)}>Cancel</Button>
            <Button onClick={saveMarket} disabled={!mForm?.country_code || !mForm.currency_code || !mForm.location_id}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cForm} onOpenChange={(o) => !o && setCForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Currency</DialogTitle></DialogHeader>
          {cForm && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value.toUpperCase() })} maxLength={3} /></div>
              <div><Label>Symbol</Label><Input value={cForm.symbol} onChange={(e) => setCForm({ ...cForm, symbol: e.target.value })} /></div>
              <div className="col-span-2"><Label>Name</Label><Input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} /></div>
              <div><Label>Decimals</Label><Input type="number" min={0} max={4} value={cForm.decimals} onChange={(e) => setCForm({ ...cForm, decimals: e.target.value })} /></div>
              <div><Label>Rate to base</Label><Input type="number" step="any" value={cForm.rate_to_base} onChange={(e) => setCForm({ ...cForm, rate_to_base: e.target.value })} /></div>
              <div className="col-span-2 flex items-center gap-2"><Switch checked={cForm.is_active == 1} onCheckedChange={(v) => setCForm({ ...cForm, is_active: v ? 1 : 0 })} /><span className="text-sm">Active</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCForm(null)}>Cancel</Button>
            <Button onClick={saveCurrency}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

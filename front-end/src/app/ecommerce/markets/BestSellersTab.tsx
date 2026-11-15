"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Trash2, Save, Loader2, Star } from "lucide-react";
import { marketApi } from "@/lib/api/markets";

const LIMIT = 10;

/** A row from marketadmin/prices: every online item, with this market's price (null = not in its price list). */
type PriceRow = { id: number; sku: string | null; name: string; base_price: string | number; market_price: string | number | null };

/** Homepage "Shop Our Best Selling Products", chosen per market. */
export function BestSellersTab({ markets }: { markets: any[] }) {
  const { toast } = useToast();
  const [marketId, setMarketId] = useState<string>(() => {
    const home = markets.find((m) => Number(m.is_default) === 1) ?? markets[0];
    return home ? String(home.id) : "";
  });
  const [ids, setIds] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);
  const [parts, setParts] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!marketId) return;
    let ignore = false;
    setLoading(true);
    setDirty(false);
    (async () => {
      try {
        const [r, priceList] = await Promise.all([
          marketApi.bestSellers(Number(marketId)),
          marketApi.prices(Number(marketId)),
        ]);
        if (ignore) return;
        setIds(r.ids.map(String));
        setCustom(r.custom);
        setParts(Array.isArray(priceList?.items) ? priceList.items : []);
      } catch (e: any) {
        if (!ignore) toast({ title: "Error", description: e?.message || "Could not load best sellers.", variant: "destructive" });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [marketId]);

  const change = (next: string[]) => { setIds(next); setDirty(true); };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await marketApi.saveBestSellers(Number(marketId), ids.map(Number));
      setDirty(false);
      setCustom(true);
      toast({ title: "Saved", description: "Best sellers updated for this market." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not save best sellers.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const market = markets.find((m) => String(m.id) === marketId);
  // Price-list markets only sell items with a price set for them; others sell everything at the base price.
  const usesPriceList = Number(market?.uses_price_list) === 1;
  const symbol = market?.currency_symbol ?? "";
  const priceOf = (p: PriceRow) => (usesPriceList ? p.market_price : p.base_price);
  const sellable = (p: PriceRow) => priceOf(p) !== null && priceOf(p) !== "";
  const label = (p: PriceRow) =>
    `${p.name}${p.sku ? ` (${p.sku})` : ""} · ${symbol}${Number(priceOf(p)).toFixed(Number(market?.currency_decimals ?? 2))}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Shop Our Best Selling Products</CardTitle>
        <CardDescription>
          Pick up to {LIMIT} products for each market's homepage and set their order. Saving an empty list hides the section for that market.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Select value={marketId} onValueChange={setMarketId}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Market" /></SelectTrigger>
            <SelectContent>
              {markets.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} (/{m.code})</SelectItem>)}
            </SelectContent>
          </Select>
          {market && !loading && !custom && (
            <Badge variant="outline">Using {market.location_name || "location"} list. Save to set this market's own list.</Badge>
          )}
          <Button className="ml-auto" disabled={!dirty || saving || loading} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <SearchableSelect
              value={null}
              placeholder="Search products to add"
              disabled={ids.length >= LIMIT}
              options={parts
                .filter((p) => sellable(p) && !ids.includes(String(p.id)))
                .map((p) => ({ value: String(p.id), label: label(p) }))}
              onValueChange={(id) => id && change([...ids, String(id)])}
            />
            {ids.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products. Saving now hides the Best Sellers section for this market.</p>
            ) : (
              <ol className="divide-y rounded-lg border px-4">
                {ids.map((id, index) => {
                  const row = parts.find((p) => String(p.id) === id);
                  const name = row?.name ?? `Product #${id}`;
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 text-sm font-medium">
                        {index + 1}. {name}
                        {row && sellable(row) ? (
                          <span className="ml-2 font-normal text-muted-foreground">{symbol}{Number(priceOf(row)).toFixed(Number(market?.currency_decimals ?? 2))}</span>
                        ) : (
                          <Badge variant="destructive" className="ml-2">Not sold in this market</Badge>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center">
                        <Button type="button" variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${name} up`} onClick={() => move(index, -1)}>
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={index === ids.length - 1} aria-label={`Move ${name} down`} onClick={() => move(index, 1)}>
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={() => change(ids.filter((x) => x !== id))}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

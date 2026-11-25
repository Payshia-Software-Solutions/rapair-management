"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  contentUrl, fetchParts, fetchLocations, type PartRow, type ServiceLocationRow,
  fetchItemSections, fetchItemDepartments, fetchItemCategories, type ItemSection, type ItemDepartment, type ItemCategory,
} from "@/lib/api";
import { Grid3X3, LayoutList, Loader2, Plus, Search, Image as ImageIcon, X, UploadCloud, MapPin, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { ImportItemsDialog } from "@/components/inventory/ImportItemsDialog";

type ViewMode = "table" | "grid";

const LS_VIEW_KEY = "inventory_items_view";
const LS_SIZE_KEY = "inventory_items_page_size";
const LS_LOC_KEY = "inventory_items_location"; // "all" or a location id

const money = (v: any) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qtyFmt = (v: any) => Number(v ?? 0).toLocaleString("en-LK", { maximumFractionDigits: 3 });
const brandOf = (p: PartRow) => (p as any).brand_name || (p as any).brand || "";
const searchText = (p: PartRow) =>
  `${p.part_name ?? ""} ${p.sku ?? ""} ${(p as any).part_number ?? ""} ${(p as any).barcode_number ?? ""} ${brandOf(p)}`.toLowerCase();

export default function InventoryItemsListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PartRow[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [pageSize, setPageSize] = useState<number>(24);
  const [page, setPage] = useState<number>(1);
  const [showImport, setShowImport] = useState(false);

  const [locations, setLocations] = useState<ServiceLocationRow[]>([]);
  const [locationSel, setLocationSel] = useState<string | null>(null); // null until read from storage

  const [sections, setSections] = useState<ItemSection[]>([]);
  const [departments, setDepartments] = useState<ItemDepartment[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  // Search suggestions
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const loadItems = async (loc: string) => {
    setLoading(true);
    try {
      const data = await fetchParts("", loc === "all" ? "all" : loc);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setItems([]);
      toast({ title: "Error", description: e?.message || "Failed to load items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Once: preferences, master data and the starting location.
  useEffect(() => {
    let savedLoc = "";
    try {
      const v = window.localStorage.getItem(LS_VIEW_KEY);
      if (v === "grid" || v === "table") setView(v);
      const s = Number(window.localStorage.getItem(LS_SIZE_KEY));
      if (Number.isFinite(s) && s > 0) setPageSize(s);
      savedLoc = window.localStorage.getItem(LS_LOC_KEY) || window.localStorage.getItem("location_id") || "";
    } catch { /* ignore */ }
    setLocationSel(savedLoc || "all");

    void Promise.all([fetchLocations(), fetchItemSections(), fetchItemDepartments(), fetchItemCategories()])
      .then(([l, s, d, c]) => {
        setLocations(Array.isArray(l) ? (l as any) : []);
        setSections(Array.isArray(s) ? s : []);
        setDepartments(Array.isArray(d) ? d : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch(() => { /* filters just stay empty */ });
  }, []);

  useEffect(() => { if (locationSel) void loadItems(locationSel); }, [locationSel]);

  // A saved location that no longer exists (or is not allowed) falls back to All.
  useEffect(() => {
    if (locationSel && locationSel !== "all" && locations.length > 0 && !locations.some((l) => String(l.id) === locationSel)) {
      setLocationSel("all");
    }
  }, [locations, locationSel]);

  useEffect(() => { try { window.localStorage.setItem(LS_VIEW_KEY, view); } catch {} }, [view]);
  useEffect(() => { try { window.localStorage.setItem(LS_SIZE_KEY, String(pageSize)); } catch {} }, [pageSize]);

  const changeLocation = (v: string) => {
    setLocationSel(v);
    setPage(1);
    try { window.localStorage.setItem(LS_LOC_KEY, v); } catch { /* ignore */ }
  };

  const filteredDepts = useMemo(() => {
    if (selectedSectionId === "all") return departments;
    return departments.filter((d) => d.section_id === parseInt(selectedSectionId));
  }, [departments, selectedSectionId]);

  useEffect(() => {
    if (selectedDeptId !== "all" && !filteredDepts.some((d) => String(d.id) === selectedDeptId)) setSelectedDeptId("all");
  }, [filteredDepts, selectedDeptId]);

  // Category/section filters only (search applied after, so suggestions respect the filters too).
  const scoped = useMemo(() => {
    let rows = items;
    if (selectedSectionId !== "all") rows = rows.filter((p) => p.item_section_id === parseInt(selectedSectionId));
    if (selectedDeptId !== "all") rows = rows.filter((p) => p.item_department_id === parseInt(selectedDeptId));
    if (selectedCatId !== "all") rows = rows.filter((p) => p.item_category_id === parseInt(selectedCatId));
    return rows;
  }, [items, selectedSectionId, selectedDeptId, selectedCatId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? scoped.filter((p) => searchText(p).includes(q)) : scoped;
    return [...rows].sort((a, b) => String(a.part_name ?? "").localeCompare(String(b.part_name ?? "")));
  }, [scoped, query]);

  // Suggestions: names that start with the text first, then other matches.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: PartRow[] = [];
    const rest: PartRow[] = [];
    for (const p of scoped) {
      const name = String(p.part_name ?? "").toLowerCase();
      const sku = String(p.sku ?? "").toLowerCase();
      if (name.startsWith(q) || sku.startsWith(q)) starts.push(p);
      else if (searchText(p).includes(q)) rest.push(p);
      if (starts.length >= 8) break;
    }
    return [...starts, ...rest].slice(0, 8);
  }, [scoped, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = (p: PartRow) => { setSuggestOpen(false); router.push(`/inventory/items/${p.id}`); };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSuggestOpen(false); return; }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === "Enter") { e.preventDefault(); openItem(suggestions[active]); }
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const filtersOn = selectedSectionId !== "all" || selectedDeptId !== "all" || selectedCatId !== "all" || !!query;
  const clearFilters = () => { setSelectedSectionId("all"); setSelectedDeptId("all"); setSelectedCatId("all"); setQuery(""); setPage(1); };
  const isAll = locationSel === "all";
  const locName = isAll ? "All locations" : locations.find((l) => String(l.id) === locationSel)?.name || "This location";

  const thumb = (p: any) => (p?.image_filename ? contentUrl("items", String(p.image_filename)) : null);
  const Thumb = ({ p, size }: { p: PartRow; size: string }) => {
    const url = thumb(p);
    return (
      <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/20`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
  };
  const typeLabel = (p: PartRow) => (p.item_type === "Part" ? "Product" : p.item_type || "Product");
  const stockCell = (p: PartRow) => {
    if (p.item_type === "Service") return <span className="text-muted-foreground">—</span>;
    const q = Number(p.stock_quantity ?? 0);
    return (
      <span className={q <= 0 ? "text-destructive" : ""}>
        {qtyFmt(q)} <span className="text-[11px] text-muted-foreground">{p.unit ?? ""}</span>
      </span>
    );
  };

  const Pagination = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
        <span className="font-semibold text-foreground">{filtered.length}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v) || 24); setPage(1); }}>
          <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[12, 24, 48, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-1 tabular-nums">{page} / {pageCount}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="w-full space-y-3">
        {/* Title + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Products</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${items.length} items`} · {locName}{isAll ? " (stock is the total of all locations)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setShowImport(true)}>
              <UploadCloud className="h-4 w-4" /> Import
            </Button>
            <Button size="sm" asChild className="h-9 gap-1.5">
              <Link href="/inventory/items/new" data-tour="item-new"><Plus className="h-4 w-4" /> New item</Link>
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            {/* Search with suggestions */}
            <div ref={searchBoxRef} className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, SKU, barcode, brand…"
                className="h-9 pl-8 pr-8 text-sm"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); setSuggestOpen(true); }}
                onFocus={() => query && setSuggestOpen(true)}
                onKeyDown={onSearchKey}
                role="combobox"
                aria-expanded={suggestOpen && suggestions.length > 0}
                aria-controls="item-suggest"
                aria-autocomplete="list"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setSuggestOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
              {suggestOpen && query.trim() && (
                <div id="item-suggest" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
                  {suggestions.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">No items match “{query}”</div>
                  ) : (
                    <>
                      {suggestions.map((p, i) => (
                        <button
                          key={p.id} type="button" role="option" aria-selected={i === active}
                          onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => openItem(p)}
                          className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left ${i === active ? "bg-muted" : ""}`}
                        >
                          <Thumb p={p} size="h-8 w-8" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{p.part_name}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{[p.sku, brandOf(p), typeLabel(p)].filter(Boolean).join(" · ")}</div>
                          </div>
                          <div className="shrink-0 text-right text-xs tabular-nums">
                            <div>{stockCell(p)}</div>
                            <div className="text-[11px] text-muted-foreground">LKR {money(p.price)}</div>
                          </div>
                        </button>
                      ))}
                      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                        {filtered.length} match{filtered.length === 1 ? "" : "es"} in the list · ↑↓ to move, Enter to open
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            <Select value={locationSel ?? undefined} onValueChange={changeLocation}>
              <SelectTrigger className="h-9 w-[200px] text-sm" aria-label="Location">
                <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedSectionId} onValueChange={(v) => { setSelectedSectionId(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Section"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedDeptId} onValueChange={(v) => { setSelectedDeptId(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Department"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {filteredDepts.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCatId} onValueChange={(v) => { setSelectedCatId(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {filtersOn && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear</Button>
            )}

            <div className="ml-auto flex items-center gap-1">
              <div className="inline-flex rounded-md border p-0.5" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")} aria-label="Table view"
                  className={`rounded px-2 py-1 ${view === "table" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><LayoutList className="h-4 w-4" /></button>
                <button type="button" role="tab" aria-selected={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view"
                  className={`rounded px-2 py-1 ${view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Grid3X3 className="h-4 w-4" /></button>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => locationSel && void loadItems(locationSel)} aria-label="Refresh">
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="overflow-hidden shadow-sm">
          <CardContent className="space-y-3 p-3">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No items found{filtersOn ? " for these filters." : isAll ? "." : ` at ${locName}. Try “All locations”.`}
              </div>
            ) : (
              <>
                {Pagination}
                {view === "table" ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Item</th>
                          <th className="w-28 px-3 py-2 text-left font-medium">Type</th>
                          <th className="w-32 px-3 py-2 text-right font-medium">{isAll ? "Stock (all)" : "Stock"}</th>
                          <th className="w-28 px-3 py-2 text-right font-medium">Cost</th>
                          <th className="w-28 px-3 py-2 text-right font-medium">Selling</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paged.map((p) => (
                          <tr key={p.id} className="cursor-pointer hover:bg-muted/20" onClick={() => router.push(`/inventory/items/${p.id}`)}>
                            <td className="px-3 py-1.5">
                              <Link href={`/inventory/items/${p.id}`} className="flex min-w-0 items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                                <Thumb p={p} size="h-9 w-9" />
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{p.part_name}</div>
                                  <div className="truncate text-[11px] text-muted-foreground">{[p.sku || `#${p.id}`, brandOf(p)].filter(Boolean).join(" · ")}</div>
                                </div>
                              </Link>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${p.item_type === "Service" ? "border-amber-500/30 text-amber-600" : ""}`}>{typeLabel(p)}</Badge>
                                {p.recipe_type && p.recipe_type !== "Standard" && (
                                  <Badge variant="outline" className="h-5 border-blue-500/30 px-1.5 text-[10px] text-blue-600">{p.recipe_type}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium tabular-nums">{stockCell(p)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{money(p.cost_price)}</td>
                            <td className="px-3 py-1.5 text-right font-medium tabular-nums">{money(p.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {paged.map((p) => (
                      <Link key={p.id} href={`/inventory/items/${p.id}`} className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/20">
                        <Thumb p={p} size="h-12 w-12" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{p.part_name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{[p.sku || `#${p.id}`, brandOf(p), typeLabel(p)].filter(Boolean).join(" · ")}</div>
                          <div className="mt-0.5 flex items-center justify-between text-xs tabular-nums">
                            <span>{stockCell(p)}</span>
                            <span className="font-medium">LKR {money(p.price)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {filtered.length > pageSize && Pagination}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ImportItemsDialog open={showImport} onOpenChange={setShowImport} onSuccess={() => locationSel && void loadItems(locationSel)} />
    </DashboardLayout>
  );
}

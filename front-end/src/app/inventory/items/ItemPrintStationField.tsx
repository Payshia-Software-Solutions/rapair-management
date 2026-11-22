"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { assignItemsToStation, fetchPrintStations, type PrintStation } from "@/lib/api/printqueue";

/**
 * Which station (Kitchen, Bar…) prints this item's kitchen tickets. Saves straight away.
 * The station decides the printer, so changing printers never means editing items.
 */
export function ItemPrintStationField({ itemId, current, onSelect }: {
  itemId?: number; current: number | null | undefined;
  /** New items (no id yet): report the choice instead of saving; the form saves it after create. */
  onSelect?: (stationId: number | null) => void;
}) {
  const { toast } = useToast();
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [value, setValue] = useState<string>(current ? String(current) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPrintStations().then(s => setStations(s.filter(x => Number(x.is_active)))).catch(() => {}); }, []);
  useEffect(() => { setValue(current ? String(current) : ""); }, [current]);

  if (stations.length === 0) return null; // no stations set up: everything prints on one KOT

  const multiLoc = new Set(stations.map(s => s.location_id)).size > 1;
  const defaults = stations.filter(s => Number(s.is_default)).map(s => s.name).join(" / ") || "default";

  const change = async (v: string) => {
    const prev = value;
    setValue(v);
    if (!itemId) { onSelect?.(v ? Number(v) : null); return; }
    setSaving(true);
    try {
      await assignItemsToStation(v ? Number(v) : null, [itemId]);
      toast({ title: "Print station saved" });
    } catch (err: any) {
      setValue(prev);
      toast({ title: "Couldn't save print station", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-none bg-muted/5">
      <CardHeader>
        <CardTitle className="text-base">Kitchen printing</CardTitle>
        <CardDescription>Which station gets this item on its ticket (KOT, BOT…).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="item-station">Print station</Label>
        <select
          id="item-station"
          value={value}
          disabled={saving}
          onChange={(e) => void change(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
        >
          <option value="">Use default station ({defaults})</option>
          {stations.map(s => (
            <option key={s.id} value={s.id}>{s.name} · {s.ticket_label}{multiLoc ? ` (location ${s.location_id})` : ""}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{itemId ? "Saved immediately. " : ""}Printers are set per station. Bulk changes: Settings → Printers → Print stations.</p>
      </CardContent>
    </Card>
  );
}

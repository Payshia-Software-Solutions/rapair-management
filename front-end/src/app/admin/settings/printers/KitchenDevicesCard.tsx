"use client";

import { tenantSlug } from "@/lib/tenant";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchLocations } from "@/lib/api";
import { createPrintDevice, fetchPrintDevices, revokePrintDevice, type PrintDevice } from "@/lib/api/printqueue";

/**
 * Kitchen print devices: PCs running the BizzFlow Printer app that print KOTs
 * sent from tablets. Each gets a device key (shown once) for its location.
 */
export function KitchenDevicesCard() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<PrintDevice[] | null>(null);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Kitchen PC");
  const [locationId, setLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = () => fetchPrintDevices().then(setDevices).catch(() => setDevices([]));

  useEffect(() => {
    void load();
    fetchLocations().then((rows: any) => {
      const list = (Array.isArray(rows) ? rows : []).map((l: any) => ({ id: Number(l.id), name: String(l.name) }));
      setLocations(list);
      if (list[0]) setLocationId(String(list[0].id));
    }).catch(() => {});
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locationId) return;
    setSaving(true);
    try {
      const res = await createPrintDevice(name.trim(), Number(locationId));
      setNewKey(res.key);
      void load();
    } catch (err: any) {
      toast({ title: "Couldn't add device", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (d: PrintDevice) => {
    if (!window.confirm(`Revoke "${d.name}"? It will stop printing kitchen tickets until a new key is set.`)) return;
    try {
      await revokePrintDevice(d.id);
      void load();
    } catch (err: any) {
      toast({ title: "Couldn't revoke", description: err?.message, variant: "destructive" });
    }
  };

  const closeDialog = (v: boolean) => {
    setOpen(v);
    if (!v) { setNewKey(null); setName("Kitchen PC"); }
  };

  // Shared deployment: the printer app can't send the workspace header, so its address names the workspace
  const slug = tenantSlug();
  const apiAddress = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "") + (slug ? `/t/${slug}` : "");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">Kitchen print devices</CardTitle>
          <CardDescription>
            PCs that print KOTs sent from steward tablets. Set tablets to &ldquo;Send to kitchen PC&rdquo; in the POS ⋮ menu.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" /> Add device
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {devices === null ? (
          <div className="px-6 py-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : devices.length === 0 ? (
          <div className="px-6 py-6 text-sm text-muted-foreground">No kitchen devices yet. Add one, then paste its key into the BizzFlow Printer app on that PC.</div>
        ) : (
          <ul className="divide-y border-t">
            {devices.map((d) => (
              <li key={d.id} className="px-6 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{d.name}</span>
                    {!Number(d.is_active) ? (
                      <Badge variant="outline" className="text-muted-foreground">Revoked</Badge>
                    ) : Number(d.online) ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">Online</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.location_name || `Location ${d.location_id}`} · key …{d.key_hint}
                    {d.last_seen_at ? ` · last seen ${new Date(d.last_seen_at.replace(" ", "T")).toLocaleString()}` : " · never connected"}
                  </div>
                </div>
                {Number(d.is_active) ? (
                  <Button variant="outline" size="sm" onClick={() => revoke(d)}>Revoke</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent size="sm">
          <DialogHeader className="text-left">
            <DialogTitle>{newKey ? "Device key" : "Add kitchen device"}</DialogTitle>
            <DialogDescription>
              {newKey
                ? "Copy this key now. It's shown only once."
                : "The PC with the kitchen printer and the BizzFlow Printer app."}
            </DialogDescription>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={newKey} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void navigator.clipboard?.writeText(newKey); toast({ title: "Key copied" }); }}
                  aria-label="Copy key"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>On the kitchen PC, open the BizzFlow Printer dashboard.</li>
                <li>Under <b>Kitchen tickets from tablets</b>, turn it on.</li>
                <li>Server address: <code className="text-xs break-all">{apiAddress || "your API address"}</code></li>
                <li>Paste this key and Save. It shows <b>Connected</b> within a few seconds.</li>
              </ol>
              <div className="flex justify-end"><Button onClick={() => closeDialog(false)}>Done</Button></div>
            </div>
          ) : (
            <form onSubmit={create} className="space-y-3">
              <div>
                <label htmlFor="dev-name" className="text-sm font-medium">Name</label>
                <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} className="mt-1.5 h-10" autoFocus />
              </div>
              <div>
                <label htmlFor="dev-loc" className="text-sm font-medium">Location</label>
                <select
                  id="dev-loc"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">It prints KOTs for bills held at this location.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={saving || !name.trim() || !locationId}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create key
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

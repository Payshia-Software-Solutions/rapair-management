"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { saveApiClientSite, testApiClientSite, type ApiClientRow } from "@/lib/api";

/**
 * Where a connected website is told to refresh its cached storefront data after a save here.
 * Each website has its own address and secret (the secret must match what that website expects).
 */
export function WebsiteRefreshDialog({
  client, open, onOpenChange, onSaved,
}: {
  client: ApiClientRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState(client.revalidate_url || "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "off">("");
  const hasSecret = !!client.has_revalidate_secret;

  const run = async (kind: "save" | "off", payload: { revalidate_url: string; revalidate_secret?: string }) => {
    setBusy(kind);
    try {
      await saveApiClientSite(client.id, payload);
      toast({ title: kind === "off" ? "Website refresh turned off" : "Saved" });
      setSecret("");
      onSaved();
      if (kind === "off") onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not save", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await testApiClientSite(client.id);
      toast(r.ok
        ? { title: "The website answered", description: `HTTP ${r.http_code}` }
        : { title: "The website did not accept it", description: r.error || `HTTP ${r.http_code}. Check the address and the secret.`, variant: "destructive" });
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Website refresh · {client.client_name}</DialogTitle>
          <DialogDescription>
            After you save storefront settings here, this website is told to refresh its cached data, so changes show straight away.
            Your website must accept <code className="text-xs">POST</code> on this address with <code className="text-xs">Authorization: Bearer &lt;secret&gt;</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`rv-url-${client.id}`}>Refresh address</Label>
            <Input id={`rv-url-${client.id}`} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.yourshop.com/api/revalidate" inputMode="url" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`rv-secret-${client.id}`}>Secret</Label>
            <Input id={`rv-secret-${client.id}`} type="password" value={secret} onChange={e => setSecret(e.target.value)}
              placeholder={hasSecret ? "Leave empty to keep the saved secret" : "Same value as the website's REVALIDATE_SECRET"} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">Stored encrypted. It is never shown again after saving.</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={test} disabled={busy !== "" || !client.revalidate_url || !hasSecret}>
              {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Test
            </Button>
            {client.revalidate_url && (
              <Button variant="ghost" className="text-destructive" onClick={() => run("off", { revalidate_url: "" })} disabled={busy !== ""}>
                Turn off
              </Button>
            )}
          </div>
          <Button onClick={() => run("save", { revalidate_url: url.trim(), ...(secret ? { revalidate_secret: secret } : {}) })} disabled={busy !== "" || !url.trim()}>
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { contentUrl, uploadCompanyLogo } from "@/lib/api";

/** Company logo: shown on POS receipts, invoices and printed reports. */
export function CompanyLogoCard({ filename, onChange }: { filename?: string | null; onChange: (f: string | null) => void }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Logo must be 2 MB or smaller", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const r = await uploadCompanyLogo(file);
      onChange(r.filename);
      toast({ title: "Logo uploaded", description: "It now shows on receipts and invoices." });
    } catch (e: any) {
      toast({ title: "Couldn't upload logo", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove the company logo from receipts and invoices?")) return;
    setBusy(true);
    try { await uploadCompanyLogo(null); onChange(null); toast({ title: "Logo removed" }); }
    catch (e: any) { toast({ title: "Couldn't remove logo", description: e?.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-lg">Logo</CardTitle>
        <CardDescription>Printed on POS receipts, invoices and reports.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 overflow-hidden">
          {filename ? (
            <img src={contentUrl("company", filename)} alt="Company logo" className="max-h-28 max-w-[90%] object-contain" />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-60" aria-hidden="true" />
              No logo yet
            </div>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" aria-hidden="true" />}
            {filename ? "Replace logo" : "Upload logo"}
          </Button>
          {filename && (
            <Button type="button" variant="outline" size="icon" onClick={remove} disabled={busy} aria-label="Remove logo">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WEBP, up to 2 MB. A dark logo on a white or transparent background prints best on receipt printers.</p>
      </CardContent>
    </Card>
  );
}

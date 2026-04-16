"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchCompany, updateCompany, fetchTaxes, type CompanyRow } from "@/lib/api";
import { Building2, Loader2, Save, Percent, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function AdminCompanyPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<CompanyRow | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [taxLabel, setTaxLabel] = useState("");

  const [allTaxes, setAllTaxes] = useState<any[]>([]);
  const [enabledTaxIds, setEnabledTaxIds] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, masterTaxes] = await Promise.all([
        fetchCompany(),
        fetchTaxes()
      ]);
      
      setCompany(c);
      setName(c?.name ?? "");
      setAddress((c?.address ?? "") as string);
      setPhone((c?.phone ?? "") as string);
      setEmail((c?.email ?? "") as string);
      setTaxNo((c?.tax_no ?? "") as string);
      setTaxLabel((c?.tax_label ?? "") as string);

      setAllTaxes(masterTaxes?.filter((t:any) => t.is_active) || []);
      
      // Parse JSON from database
      let initialTaxIds: number[] = [];
      if (c?.tax_ids_json) {
        try {
          initialTaxIds = JSON.parse(c.tax_ids_json);
        } catch {
          initialTaxIds = [];
        }
      }
      setEnabledTaxIds(initialTaxIds);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    setSaving(true);
    try {
      await updateCompany({
        id: 1,
        name: n,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        tax_no: taxNo.trim() || null,
        tax_label: taxLabel.trim() || null,
        tax_ids: enabledTaxIds // Controller handles JSON conversion
      });
      toast({ title: "Saved", description: "Company details and tax settings updated" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleTax = (id: number) => {
    setEnabledTaxIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Company Profile
          </h1>
          <p className="text-muted-foreground mt-1">Update company information and manage applicable taxes</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-md overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Business Details</CardTitle>
            <CardDescription>Primary information used on official documents.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                Loading...
              </div>
            ) : (
              <form onSubmit={save} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="c-name">Company Name</Label>
                  <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-address">Address</Label>
                  <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="c-phone">Phone</Label>
                    <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-border/50">
                  <div className="grid gap-2">
                    <Label htmlFor="c-tax-no">Tax Registration Number</Label>
                    <Input id="c-tax-no" placeholder="e.g. VAT12345678" value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="c-tax-label">Tax Label (Document Display)</Label>
                    <Input id="c-tax-label" placeholder="e.g. VAT / TAX ID" value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={saving || !name.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save All Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
                    Reload
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              <CardTitle className="text-lg">Applicable Taxes</CardTitle>
            </div>
            <CardDescription>Select which taxes apply to your invoices.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {allTaxes.map((tax) => (
                  <div 
                    key={tax.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                      enabledTaxIds.includes(tax.id) 
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                        : "bg-background border-border hover:border-border/80"
                    )}
                    onClick={() => toggleTax(tax.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={enabledTaxIds.includes(tax.id)}
                        onCheckedChange={() => toggleTax(tax.id)}
                      />
                      <div className="grid">
                        <span className="text-sm font-bold tracking-tight">{tax.name} ({tax.code})</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{tax.rate_percent}% • {tax.apply_on}</span>
                      </div>
                    </div>
                    {enabledTaxIds.includes(tax.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                ))}
                {allTaxes.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm italic">
                    No active taxes found in master data.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


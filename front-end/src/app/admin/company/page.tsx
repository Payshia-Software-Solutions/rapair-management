"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchCompany, updateCompany, type CompanyRow } from "@/lib/api";
import { Building2, Loader2, Save } from "lucide-react";

export default function AdminCompanyPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<CompanyRow | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const c = await fetchCompany();
      setCompany(c);
      setName(c?.name ?? "");
      setAddress((c?.address ?? "") as string);
      setPhone((c?.phone ?? "") as string);
      setEmail((c?.email ?? "") as string);
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
      });
      toast({ title: "Saved", description: "Company details updated" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Company Profile
          </h1>
          <p className="text-muted-foreground mt-1">Update company information used across the system</p>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Details</CardTitle>
          <CardDescription>These details can be printed on receipts and reports.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Loading company details...
            </div>
          ) : (
            <form onSubmit={save} className="grid gap-5 max-w-2xl">
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

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
                  Reload
                </Button>
              </div>

              {company && company.id !== 1 ? (
                <div className="text-xs text-muted-foreground">
                  Note: Company is stored as a singleton row with id=1.
                </div>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}


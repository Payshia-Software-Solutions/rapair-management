"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearUserSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCompany, updateCompany, uploadCompanyLogo, fetchLocations, updateLocation,
  fetchTaxes, updateTax, fetchSystemSettings, updateSystemSettings, testSms,
  fetchSetupStatus, markSetupStep, sendTestMail, completeSetup,
  type CompanyRow, type ServiceLocation, type TaxRow, type SetupStatus,
} from "@/lib/api";
import {
  Building2, MapPin, Percent, Mail, MessageSquare, Flag, Check, Loader2, ArrowLeft, ArrowRight,
  Upload, Users, Package, LayoutGrid, Printer, ChevronRight,
} from "lucide-react";

type StepKey = "company" | "location" | "taxes" | "mail" | "sms" | "finish";
const STEPS: { key: StepKey; title: string; hint: string; Icon: React.ComponentType<{ className?: string }>; optional?: boolean }[] = [
  { key: "company", title: "Company", hint: "Name, contact and logo for bills", Icon: Building2 },
  { key: "location", title: "Main location", hint: "Branch, service types and pricing", Icon: MapPin },
  { key: "taxes", title: "Taxes", hint: "Which taxes you charge", Icon: Percent },
  { key: "mail", title: "Email server", hint: "Send invoices and alerts", Icon: Mail, optional: true },
  { key: "sms", title: "SMS gateway", hint: "Send SMS to customers", Icon: MessageSquare, optional: true },
  { key: "finish", title: "Finish", hint: "What to set up next", Icon: Flag },
];

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * First-time setup for a new workspace. Each step saves through the normal settings APIs, so
 * anything entered here also appears on (and can be changed later from) the regular pages.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState<StepKey>("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data
  const [company, setCompany] = useState<Partial<CompanyRow>>({});
  const [location, setLocation] = useState<Partial<ServiceLocation> | null>(null);
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const refreshStatus = () => fetchSetupStatus().then(setStatus).catch(() => {});

  useEffect(() => {
    let alive = true;
    Promise.all([fetchSetupStatus(), fetchCompany(), fetchLocations(), fetchTaxes("", { all: true }), fetchSystemSettings()])
      .then(([st, c, locs, tx, s]) => {
        if (!alive) return;
        setStatus(st);
        setCompany((c && typeof c === "object" && "name" in c) ? c : {});
        const list = Array.isArray(locs) ? locs : [];
        setLocation(list[0] || null);
        setTaxes(Array.isArray(tx) ? tx : []);
        setSettings(s || {});
        setTestTo(((c as CompanyRow)?.email) || "");
        // Resume at the first unfinished required step
        if (!st.steps.company.done) setStep("company");
        else if (!st.steps.location.done) setStep("location");
        else if (!st.steps.taxes.done) setStep("taxes");
        else setStep("finish");
      })
      .catch((e) => toast({ title: "Couldn't load setup", description: msg(e), variant: "destructive" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [toast]);

  const idx = STEPS.findIndex((s) => s.key === step);
  const go = (k: StepKey) => { setErrors({}); setStep(k); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);
  const back = () => go(STEPS[Math.max(idx - 1, 0)].key);

  const stepDone = (k: StepKey) => {
    if (!status) return false;
    if (k === "finish") return status.completed;
    const s = status.steps[k];
    return !!(s?.done || s?.skipped);
  };

  // ------------------------------------------------------------------ save handlers

  const saveCompany = async () => {
    const e: Record<string, string> = {};
    if (!company.name?.trim()) e.c_name = "Enter the company name.";
    if (!company.address?.trim()) e.c_address = "Enter the address. It is printed on bills.";
    if (!company.phone?.trim()) e.c_phone = "Enter a phone number. It is printed on bills.";
    if (company.email && !/^\S+@\S+\.\S+$/.test(company.email)) e.c_email = "This email address doesn't look right.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      let taxIds: number[] | undefined;
      try { taxIds = company.tax_ids_json ? JSON.parse(company.tax_ids_json) : undefined; } catch { taxIds = undefined; }
      const res = await updateCompany({ ...company, name: company.name!.trim(), tax_ids: taxIds });
      if ((res as { status?: string })?.status === "error") throw new Error((res as { message?: string }).message || "Save failed");
      if (logoFile) {
        const up = await uploadCompanyLogo(logoFile);
        setCompany((c) => ({ ...c, logo_filename: up.filename }));
        setLogoFile(null);
      }
      await refreshStatus();
      next();
    } catch (err) {
      toast({ title: "Couldn't save company", description: msg(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveLocation = async () => {
    if (!location?.id) { next(); return; }
    const e: Record<string, string> = {};
    if (!location.name?.trim()) e.l_name = "Enter the location name.";
    if (!location.address?.trim()) e.l_address = "Enter the address.";
    if (!location.phone?.trim()) e.l_phone = "Enter a phone number.";
    if (location.allow_service_charge && !(Number(location.service_charge_rate) > 0)) e.l_sc = "Enter the service charge %, or turn it off.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await updateLocation(location.id, location);
      await markSetupStep("setup_location_done");
      await refreshStatus();
      next();
    } catch (err) {
      toast({ title: "Couldn't save location", description: msg(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveTaxes = async () => {
    const bad = taxes.find((t) => t.is_active && !(Number(t.rate_percent) >= 0 && Number(t.rate_percent) <= 100));
    if (bad) { setErrors({ [`t_${bad.id}`]: "Enter a rate between 0 and 100." }); return; }
    setSaving(true);
    try {
      for (const t of taxes) await updateTax(t.id, t);
      await markSetupStep("setup_taxes_done");
      await refreshStatus();
      next();
    } catch (err) {
      toast({ title: "Couldn't save taxes", description: msg(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveSettings = async (keys: string[], afterKey: "mail" | "sms") => {
    setSaving(true);
    try {
      await updateSystemSettings(Object.fromEntries(keys.map((k) => [k, settings[k] ?? ""])));
      await markSetupStep(afterKey === "mail" ? "setup_mail_skipped" : "setup_sms_skipped", false);
      await refreshStatus();
      toast({ title: afterKey === "mail" ? "Email settings saved" : "SMS settings saved" });
      return true;
    } catch (err) {
      toast({ title: "Couldn't save", description: msg(err), variant: "destructive" });
      return false;
    } finally { setSaving(false); }
  };

  const MAIL_KEYS = ["mail_host", "mail_port", "mail_encryption", "mail_user", "mail_pass", "mail_from_addr", "mail_from_name"];
  const SMS_KEYS = ["sms_gateway_url", "sms_api_key", "sms_sender_id"];

  const saveMail = async () => {
    const e: Record<string, string> = {};
    if (!settings.mail_host?.trim()) e.m_host = "Enter the mail server, or choose Skip.";
    if (!/^\d+$/.test(settings.mail_port || "")) e.m_port = "Enter the port number (usually 587 or 465).";
    if (settings.mail_from_addr && !/^\S+@\S+\.\S+$/.test(settings.mail_from_addr)) e.m_from = "This email address doesn't look right.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (await saveSettings(MAIL_KEYS, "mail")) next();
  };

  const saveSms = async () => {
    const e: Record<string, string> = {};
    if (!settings.sms_gateway_url?.trim()) e.s_url = "Enter the gateway address, or choose Skip.";
    if (!settings.sms_api_key?.trim()) e.s_key = "Enter the API key from your SMS provider.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (await saveSettings(SMS_KEYS, "sms")) next();
  };

  const skip = async (k: "mail" | "sms") => {
    try { await markSetupStep(k === "mail" ? "setup_mail_skipped" : "setup_sms_skipped"); await refreshStatus(); } catch {}
    next();
  };

  const runTestMail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(testTo)) { setErrors({ m_test: "Enter an email address to send the test to." }); return; }
    setTesting(true);
    setErrors({});
    try {
      if (!(await saveSettings(MAIL_KEYS, "mail"))) return;
      await sendTestMail(testTo);
      toast({ title: "Test email sent", description: `Check the inbox of ${testTo}.` });
    } catch (err) {
      setErrors({ m_test: msg(err) });
    } finally { setTesting(false); }
  };

  const runTestSms = async () => {
    if (!testPhone.trim()) { setErrors({ s_test: "Enter a mobile number to send the test to." }); return; }
    setTesting(true);
    setErrors({});
    try {
      if (!(await saveSettings(SMS_KEYS, "sms"))) return;
      const r = await testSms(testPhone.trim(), "BizzFlow test SMS");
      if (r?.status !== "success") throw new Error(r?.message || "The gateway did not accept the message.");
      toast({ title: "Test SMS sent", description: `Check the phone ${testPhone}.` });
    } catch (err) {
      setErrors({ s_test: msg(err) });
    } finally { setTesting(false); }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await completeSetup();
      toast({ title: "Setup complete", description: "You can change any of this later from Settings." });
      router.replace("/dashboard/overall");
    } catch (err) {
      toast({ title: "Couldn't finish", description: msg(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const requiredDone = !!status?.required_done;
  const doneCount = useMemo(() => STEPS.filter((s) => s.key !== "finish" && stepDone(s.key)).length, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sv = (k: string) => settings[k] ?? "";
  const setSv = (k: string, v: string) => setSettings((p) => ({ ...p, [k]: v }));
  const err = (k: string) => errors[k];
  const aria = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined });

  if (loading) {
    return (
      <SetupShell companyName={company.name}>
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading setup…</div>
      </SetupShell>
    );
  }

  const current = STEPS[idx];

  return (
    <SetupShell companyName={company.name}>
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set up your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">A few basics before you start selling. Everything can be changed later from Settings.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={doneCount} aria-label="Setup progress">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(doneCount / 5) * 100}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{doneCount} of 5 done</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Steps */}
          <nav aria-label="Setup steps">
            <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {STEPS.map((s, i) => {
                const done = stepDone(s.key);
                const active = s.key === step;
                return (
                  <li key={s.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => go(s.key)}
                      aria-current={active ? "step" : undefined}
                      className={`flex w-full min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium whitespace-nowrap">{s.title}</span>
                        <span className="hidden text-xs text-muted-foreground lg:block">
                          {done ? (status?.steps[s.key as Exclude<StepKey, "finish">]?.skipped && !status?.steps[s.key as Exclude<StepKey, "finish">]?.done ? "Skipped" : "Done") : s.optional ? "Optional" : s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Content */}
          <section aria-labelledby="step-title" className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3 border-b pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><current.Icon className="h-5 w-5" /></div>
              <div>
                <h2 id="step-title" className="text-lg font-semibold">
                  {current.title} {current.optional && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground align-middle">Optional</span>}
                </h2>
                <p className="text-sm text-muted-foreground">{current.hint}</p>
              </div>
            </div>

            {step === "company" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field id="c_name" label="Company name" required error={err("c_name")}>
                  <Input id="c_name" value={company.name || ""} onChange={(e) => setCompany({ ...company, name: e.target.value })} autoComplete="organization" {...aria("c_name")} />
                </Field></div>
                <div className="sm:col-span-2"><Field id="c_address" label="Address" required error={err("c_address")} hint="Printed on receipts and invoices.">
                  <Input id="c_address" value={company.address || ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} autoComplete="street-address" {...aria("c_address")} />
                </Field></div>
                <Field id="c_phone" label="Phone" required error={err("c_phone")}>
                  <Input id="c_phone" type="tel" value={company.phone || ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} autoComplete="tel" {...aria("c_phone")} />
                </Field>
                <Field id="c_email" label="Email" error={err("c_email")}>
                  <Input id="c_email" type="email" value={company.email || ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} autoComplete="email" {...aria("c_email")} />
                </Field>
                <Field id="c_tax" label="Tax / VAT registration number" hint="Leave empty if not registered.">
                  <Input id="c_tax" value={company.tax_no || ""} onChange={(e) => setCompany({ ...company, tax_no: e.target.value })} />
                </Field>
                <Field id="c_logo" label="Logo" hint={logoFile ? logoFile.name : company.logo_filename ? "A logo is set. Choose a file to replace it." : "PNG, JPG or WEBP, up to 2 MB."}>
                  <label htmlFor="c_logo" className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" aria-hidden="true" /> {logoFile ? "Change file" : "Choose file"}
                    <input id="c_logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                  </label>
                </Field>
              </div>
            )}

            {step === "location" && (
              location ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="l_name" label="Location name" required error={err("l_name")} hint="e.g. Main branch, Colombo 07">
                      <Input id="l_name" value={location.name || ""} onChange={(e) => setLocation({ ...location, name: e.target.value })} {...aria("l_name")} />
                    </Field>
                    <Field id="l_phone" label="Phone" required error={err("l_phone")}>
                      <Input id="l_phone" type="tel" value={location.phone || ""} onChange={(e) => setLocation({ ...location, phone: e.target.value })} {...aria("l_phone")} />
                    </Field>
                    <div className="sm:col-span-2"><Field id="l_address" label="Address" required error={err("l_address")}>
                      <Input id="l_address" value={location.address || ""} onChange={(e) => setLocation({ ...location, address: e.target.value })} {...aria("l_address")} />
                    </Field></div>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">How do you sell here?</legend>
                    {([["allow_dine_in", "Dine-in", "Tables, KOT to the kitchen"], ["allow_take_away", "Take-away", "Orders to collect"], ["allow_retail", "Retail / counter", "Walk-in sales"]] as const).map(([k, t, h]) => (
                      <label key={k} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2">
                        <span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{h}</span></span>
                        <Switch checked={Number(location[k] ?? 1) === 1} onCheckedChange={(v) => setLocation({ ...location, [k]: v ? 1 : 0 })} aria-label={t} />
                      </label>
                    ))}
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Prices and taxes</legend>
                    {([["inclusive", "Menu prices include taxes", "The price on the menu is what the customer pays. Taxes are worked out inside it."], ["exclusive", "Taxes are added on the bill", "Prices are before tax. VAT etc. are added at checkout."]] as const).map(([v, t, h]) => (
                      <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${location.tax_mode === v || (!location.tax_mode && v === "exclusive") ? "border-primary bg-primary/5" : ""}`}>
                        <input type="radio" name="tax_mode" className="mt-1" checked={location.tax_mode === v || (!location.tax_mode && v === "exclusive")} onChange={() => setLocation({ ...location, tax_mode: v })} />
                        <span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{h}</span></span>
                      </label>
                    ))}
                  </fieldset>

                  <div className="space-y-2">
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <span><span className="block text-sm font-medium">Service charge</span><span className="block text-xs text-muted-foreground">Added to dine-in bills</span></span>
                      <Switch checked={Number(location.allow_service_charge || 0) === 1} onCheckedChange={(v) => setLocation({ ...location, allow_service_charge: v ? 1 : 0, service_charge_rate: v ? (Number(location.service_charge_rate) || 10) : location.service_charge_rate })} aria-label="Service charge" />
                    </label>
                    {Number(location.allow_service_charge || 0) === 1 && (
                      <div className="max-w-[200px]"><Field id="l_sc" label="Service charge %" error={err("l_sc")}>
                        <Input id="l_sc" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={location.service_charge_rate ?? ""} onChange={(e) => setLocation({ ...location, service_charge_rate: e.target.value === "" ? 0 : Number(e.target.value) })} {...aria("l_sc")} />
                      </Field></div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">More branches can be added later in <Link href="/admin/locations" className="text-primary hover:underline">Admin → Locations</Link>.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No location found. Add one in <Link href="/admin/locations" className="text-primary hover:underline">Admin → Locations</Link>.</p>
              )
            )}

            {step === "taxes" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Turn on the taxes you charge and check the rates. Not tax-registered? Turn them all off.</p>
                {taxes.length === 0 && <p className="text-sm text-muted-foreground">No taxes yet. Add them in <Link href="/master-data/taxes" className="text-primary hover:underline">Master Data → Taxes</Link>.</p>}
                {taxes.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{t.name} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{t.code}</span></div>
                      {err(`t_${t.id}`) && <p role="alert" className="text-xs text-destructive">{err(`t_${t.id}`)}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`t_${t.id}`} className="sr-only">{t.name} rate %</Label>
                        <Input id={`t_${t.id}`} type="number" inputMode="decimal" min={0} max={100} step="0.01" className="h-10 w-24 text-right tabular-nums" disabled={!Number(t.is_active)}
                          value={t.rate_percent} onChange={(e) => setTaxes((all) => all.map((x) => x.id === t.id ? { ...x, rate_percent: Number(e.target.value) } : x))} />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <Switch checked={Number(t.is_active) === 1} onCheckedChange={(v) => setTaxes((all) => all.map((x) => x.id === t.id ? { ...x, is_active: v ? 1 : 0 } : x))} aria-label={`Charge ${t.name}`} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">More taxes (e.g. TDL) can be added in <Link href="/master-data/taxes" className="text-primary hover:underline">Master Data → Taxes</Link>.</p>
              </div>
            )}

            {step === "mail" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Used to email invoices, receipts and alerts. Your email or hosting provider gives you these details.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="m_host" label="Mail server (SMTP host)" error={err("m_host")}>
                    <Input id="m_host" value={sv("mail_host")} onChange={(e) => setSv("mail_host", e.target.value)} placeholder="mail.yourdomain.com" {...aria("m_host")} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="m_port" label="Port" error={err("m_port")}>
                      <Input id="m_port" inputMode="numeric" value={sv("mail_port")} onChange={(e) => setSv("mail_port", e.target.value.replace(/\D/g, ""))} placeholder="587" {...aria("m_port")} />
                    </Field>
                    <Field id="m_enc" label="Security">
                      <select id="m_enc" value={sv("mail_encryption") || "tls"} onChange={(e) => setSv("mail_encryption", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                        <option value="tls">TLS (587)</option><option value="ssl">SSL (465)</option>
                      </select>
                    </Field>
                  </div>
                  <Field id="m_user" label="Username">
                    <Input id="m_user" value={sv("mail_user")} onChange={(e) => setSv("mail_user", e.target.value)} autoComplete="username" />
                  </Field>
                  <Field id="m_pass" label="Password">
                    <Input id="m_pass" type="password" value={sv("mail_pass")} onChange={(e) => setSv("mail_pass", e.target.value)} autoComplete="current-password" />
                  </Field>
                  <Field id="m_from" label="Send from (email)" error={err("m_from")}>
                    <Input id="m_from" type="email" value={sv("mail_from_addr")} onChange={(e) => setSv("mail_from_addr", e.target.value)} placeholder="no-reply@yourdomain.com" {...aria("m_from")} />
                  </Field>
                  <Field id="m_fname" label="Send from (name)">
                    <Input id="m_fname" value={sv("mail_from_name")} onChange={(e) => setSv("mail_from_name", e.target.value)} placeholder={company.name || "Your company"} />
                  </Field>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <Field id="m_test" label="Send a test email to" error={err("m_test")}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input id="m_test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} {...aria("m_test")} />
                      <Button type="button" variant="outline" onClick={() => void runTestMail()} disabled={testing}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; send test</Button>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {step === "sms" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Used for order updates and approval alerts. Your SMS provider gives you the gateway address and API key.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field id="s_url" label="Gateway address (URL)" error={err("s_url")}>
                    <Input id="s_url" type="url" value={sv("sms_gateway_url")} onChange={(e) => setSv("sms_gateway_url", e.target.value)} placeholder="https://app.yourprovider.lk/api/v3/sms/send" {...aria("s_url")} />
                  </Field></div>
                  <Field id="s_key" label="API key" error={err("s_key")}>
                    <Input id="s_key" type="password" value={sv("sms_api_key")} onChange={(e) => setSv("sms_api_key", e.target.value)} autoComplete="off" {...aria("s_key")} />
                  </Field>
                  <Field id="s_sender" label="Sender ID" hint="The name customers see, as approved by your provider.">
                    <Input id="s_sender" value={sv("sms_sender_id")} onChange={(e) => setSv("sms_sender_id", e.target.value)} maxLength={11} />
                  </Field>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <Field id="s_test" label="Send a test SMS to" error={err("s_test")}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input id="s_test" type="tel" inputMode="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="07X XXX XXXX" {...aria("s_test")} />
                      <Button type="button" variant="outline" onClick={() => void runTestSms()} disabled={testing}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; send test</Button>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {step === "finish" && (
              <div className="space-y-5">
                {!requiredDone && (
                  <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    Company and main location are still missing details. Finish those first.
                  </p>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-medium">Next, set up</h3>
                  <ul className="divide-y rounded-lg border">
                    {([
                      ["users", "Staff and roles", "Add cashiers, stewards and managers. Give managers a POS PIN.", "/admin/users", Users],
                      ["items", "Items and stock", "Your menu or products, prices and opening stock.", "/inventory/items", Package],
                      ["tables", "Tables", "For dine-in: your tables and floor areas.", "/master-data/tables", LayoutGrid],
                      ["printers", "Printers", "Receipt printer and kitchen (KOT) printers.", "/admin/settings/printers", Printer],
                    ] as const).map(([k, t, h, href, Icon]) => (
                      <li key={k}>
                        <Link href={href} className="flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-muted">
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{h}</span></span>
                          {status?.next[k] ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5" aria-hidden="true" />Started</span> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" onClick={back} disabled={idx === 0 || saving}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {current.optional && <Button type="button" variant="outline" onClick={() => void skip(step as "mail" | "sms")} disabled={saving}>Skip for now</Button>}
                {step === "company" && <Button type="button" onClick={() => void saveCompany()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === "location" && <Button type="button" onClick={() => void saveLocation()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === "taxes" && <Button type="button" onClick={() => void saveTaxes()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === "mail" && <Button type="button" onClick={() => void saveMail()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === "sms" && <Button type="button" onClick={() => void saveSms()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save &amp; continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                {step === "finish" && <Button type="button" onClick={() => void finish()} disabled={saving || !requiredDone}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finish setup</Button>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </SetupShell>
  );
}

/**
 * Plain frame for the setup wizard: no sidebar or module menus (nothing to use yet), just the
 * brand and log out. Same login check as the dashboard. No "set up later" exit: the workspace
 * can't be used until the required basics are saved.
 */
function SetupShell({ children, companyName }: { children: React.ReactNode; companyName?: string }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let token: string | null = null;
    try { token = window.localStorage.getItem("auth_token"); } catch {}
    if (!token) router.replace("/login");
    else setOk(true);
  }, [router]);

  const logout = () => {
    clearUserSession();
    try { window.localStorage.removeItem("location_id"); } catch {}
    router.replace("/login");
  };

  if (!ok) return null;
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/app-icon.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-bold">BizzFlow</div>
              {companyName && <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{companyName}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={logout} className="inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-8">{children}</main>
    </div>
  );
}

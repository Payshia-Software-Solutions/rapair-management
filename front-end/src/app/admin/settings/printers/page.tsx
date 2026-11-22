'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Printer, RefreshCw, Save, Loader2, Receipt, ChefHat, Tag, Zap, MonitorSmartphone,
    CheckCircle2, XCircle, AlertTriangle, Send,
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { silentPrint } from "@/lib/api/silent-print";
import { KitchenDevicesCard } from "./KitchenDevicesCard";
import { PrintStationsCard } from "./PrintStationsCard";
import { KitchenTicketModeCard } from "./KitchenTicketModeCard";
import { getKotRoute, setKotRoute, type KotRoute } from "@/lib/api/printqueue";

const BRIDGE_URLS = ['http://127.0.0.1:5001', 'http://localhost:5001'];
const LOCATION_ID = 1; // printer mappings are currently shared under location 1

const PRINTER_TYPES = [
    { key: 'Receipt', label: 'Receipt printer', description: 'Customer bills, invoices and payment receipts', icon: Receipt },
    { key: 'KOT', label: 'Kitchen printer', description: 'Kitchen tickets, unless a print station has its own printer', icon: ChefHat },
    { key: 'Label', label: 'Label printer', description: 'Barcode and shelf labels', icon: Tag },
];

type BridgePrinter = { name: string; isDefault?: boolean; offline?: boolean };
type BridgeStatus = 'loading' | 'online' | 'offline';
type Setting = { printer_type: string; printer_name: string; paper_width?: string };

const UNASSIGNED = '__none__';
const TAB_KEY = 'printer_settings_tab';

/**
 * Printer setup, in the order it's done:
 *   Tab 1 "This PC": how this PC prints (silent / browser) and which printer does receipts, kitchen, labels.
 *   Tab 2 "Kitchen tickets": how kitchen tickets get printed (direct / kitchen PC) and the print stations split.
 */
export default function PrinterSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<Setting[]>([]);
    const [printers, setPrinters] = useState<BridgePrinter[]>([]);
    const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('loading');
    const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [tab, setTab] = useState('pc');
    // How THIS terminal prints kitchen tickets (same setting as the POS ⋮ menu): direct or via a kitchen PC
    const [kotMode, setKotMode] = useState<KotRoute>('local');

    useEffect(() => {
        setKotMode(getKotRoute());
        try { const t = localStorage.getItem(TAB_KEY); if (t === 'pc' || t === 'kitchen') setTab(t); } catch {}
    }, []);
    const changeTab = (t: string) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch {} };
    const changeKotMode = (m: KotRoute) => { setKotRoute(m); setKotMode(m); };

    const fetchSettings = async () => {
        try {
            const res = await api('/printer/get_settings');
            const data = await res.json();
            if (data.success) setSettings(data.data || []);
        } catch (error) {
            console.error('Failed to fetch printer settings:', error);
        }
    };

    const fetchPrinters = useCallback(async (refresh = false) => {
        setBridgeStatus('loading');
        for (const base of BRIDGE_URLS) {
            try {
                const res = await fetch(`${base}/printers${refresh ? '?refresh=1' : ''}`, { signal: AbortSignal.timeout(10000) });
                const data = await res.json();
                if (data.success) {
                    setPrinters(data.data || []);
                    setBridgeStatus('online');
                    fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })
                        .then(r => r.json()).then(h => setBridgeVersion(h?.version ?? null)).catch(() => setBridgeVersion(null));
                    return;
                }
            } catch { /* try next address */ }
        }
        setPrinters([]);
        setBridgeStatus('offline');
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([fetchSettings(), fetchPrinters()]);
            setLoading(false);
        })();
    }, [fetchPrinters]);

    const getSetting = (type: string) => settings.find(s => s.printer_type === type);
    const withSetting = (list: Setting[], type: string, name: string) =>
        list.some(s => s.printer_type === type)
            ? list.map(s => s.printer_type === type ? { ...s, printer_name: name } : s)
            : [...list, { printer_type: type, printer_name: name, paper_width: '80mm' }];

    const persist = async (next: Setting[], message: string) => {
        setSaving(true);
        try {
            const res = await api('/printer/save_settings', { method: 'POST', body: JSON.stringify({ location_id: LOCATION_ID, settings: next }) });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Save failed');
            setDirty(false);
            toast({ title: message });
            return true;
        } catch (error: any) {
            toast({ title: "Could not save", description: error?.message || "Failed to save settings.", variant: "destructive" });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (type: string, name: string) => { setDirty(true); setSettings(prev => withSetting(prev, type, name)); };

    // The method saves straight away; printer picks wait for "Save printers"
    const changeMethod = async (mode: 'Silent' | 'Browser') => {
        const prev = settings;
        const next = withSetting(settings, 'PrintingMode', mode);
        setSettings(next);
        if (!(await persist(next, mode === 'Silent' ? 'Silent printing on' : 'Browser print dialog on'))) setSettings(prev);
    };

    const handleTestPrint = async (typeKey: string, label: string) => {
        const printerName = getSetting(typeKey)?.printer_name;
        if (!printerName) return;
        setTesting(typeKey);
        const now = new Date();
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
            body{margin:0;padding:8px 10px 24px;font-family:Arial,sans-serif;font-size:12px;color:#000}
            h1{font-size:17px;text-align:center;margin:4px 0}.c{text-align:center}hr{border:0;border-top:1px dashed #000;margin:8px 0}
            .ok{font-weight:700;text-align:center;border:2px solid #000;padding:6px;margin-top:8px}
        </style></head><body>
            <h1>BizzFlow</h1><div class="c">${label} test</div><hr>
            <div>Printer: ${printerName.replace(/[<>&]/g, '')}</div>
            <div>Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
            <div class="ok">PRINTER OK</div>
        </body></html>`;
        const result = await silentPrint(html, printerName, '80mm', `${label} test`);
        setTesting(null);
        toast(result.success
            ? { title: "Test page sent", description: `Sent to ${printerName}.` }
            : { title: "Test print failed", description: `Check that ${printerName} is switched on and BizzFlow Printer is running.`, variant: "destructive" });
    };

    const printingMode = getSetting('PrintingMode')?.printer_name === 'Browser' ? 'Browser' : 'Silent';
    const silent = printingMode === 'Silent';
    const assignedCount = PRINTER_TYPES.filter(t => getSetting(t.key)?.printer_name).length;

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground font-medium">Loading printer settings...</span>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Printer className="w-6 h-6 text-primary" aria-hidden="true" /> Printers
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Set up this PC&rsquo;s printers first, then kitchen tickets.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <BridgeBadge status={bridgeStatus} version={bridgeVersion} />
                        <Button variant="outline" size="sm" onClick={() => fetchPrinters(true)} disabled={bridgeStatus === 'loading'}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${bridgeStatus === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
                            Refresh
                        </Button>
                    </div>
                </div>

                <Tabs value={tab} onValueChange={changeTab}>
                    <TabsList className="grid w-full grid-cols-2 h-11 mb-5">
                        <TabsTrigger value="pc" className="h-9">1. This PC&rsquo;s printers</TabsTrigger>
                        <TabsTrigger value="kitchen" className="h-9">2. Kitchen tickets</TabsTrigger>
                    </TabsList>

                    {/* ---------------- 1. This PC */}
                    <TabsContent value="pc" className="mt-0 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
                        <Card className={silent ? "" : "xl:col-span-2"}>
                            <CardHeader>
                                <CardTitle className="text-lg">How this PC prints</CardTitle>
                                <CardDescription>Saved straight away.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div role="radiogroup" aria-label="Printing method" className={`grid gap-3 sm:grid-cols-2 ${silent ? "xl:grid-cols-1" : ""}`}>
                                    {([
                                        { value: 'Silent', title: 'Silent printing', desc: 'Prints straight to the printers below. Recommended.', icon: Zap },
                                        { value: 'Browser', title: 'Browser dialog', desc: 'Opens the print window every time; you pick the printer there.', icon: MonitorSmartphone },
                                    ] as const).map(opt => {
                                        const on = printingMode === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                disabled={saving}
                                                onClick={() => !on && changeMethod(opt.value)}
                                                className={`text-left rounded-lg border p-4 flex gap-3 transition-colors disabled:opacity-60 ${on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                                            >
                                                <opt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${on ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                                                <span>
                                                    <span className="block text-sm font-semibold">{opt.title}</span>
                                                    <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {silent && bridgeStatus === 'offline' && (
                                    <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                                        <span>
                                            <b>BizzFlow Printer isn&rsquo;t running on this PC.</b> Silent printing needs it. Install
                                            <b> BizzFlowPrinter-Setup.exe</b> or start it from the Start menu, then press Refresh.
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {silent && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Printers</CardTitle>
                                    <CardDescription>
                                        Shared by every POS counter. Name the printers the same in Windows on each PC (e.g. &ldquo;Receipt-Printer&rdquo;).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="divide-y p-0 border-t">
                                    {PRINTER_TYPES.map(type => {
                                        const current = getSetting(type.key)?.printer_name || '';
                                        const missing = current && bridgeStatus === 'online' && !printers.some(p => p.name === current);
                                        return (
                                            <div key={type.key} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center">
                                                <div className="flex flex-1 items-start gap-3 min-w-0">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                        <type.icon className="w-4 h-4 text-primary" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm">{type.label}</p>
                                                        <p className="text-xs text-muted-foreground">{type.description}</p>
                                                        {missing && (
                                                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
                                                                <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Not found on this PC
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 md:w-[340px]">
                                                    <Select value={current || UNASSIGNED} onValueChange={(val) => updateSetting(type.key, val === UNASSIGNED ? '' : val)}>
                                                        <SelectTrigger className="w-full" aria-label={type.label}>
                                                            <SelectValue placeholder="Select a printer..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={UNASSIGNED}>Not assigned (Windows default)</SelectItem>
                                                            {current && !printers.some(p => p.name === current) && (
                                                                <SelectItem value={current}>{current}</SelectItem>
                                                            )}
                                                            {printers.map(p => (
                                                                <SelectItem key={p.name} value={p.name}>
                                                                    {p.name}{p.isDefault ? ' (default)' : ''}{p.offline ? ' - offline' : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        title={`Print a test page on the ${type.label}`}
                                                        aria-label={`Test ${type.label}`}
                                                        disabled={!current || bridgeStatus !== 'online' || testing !== null}
                                                        onClick={() => handleTestPrint(type.key, type.label)}
                                                    >
                                                        {testing === type.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                                <CardFooter className="flex items-center justify-between gap-4 border-t pt-5">
                                    <p className="text-sm text-muted-foreground">
                                        {dirty ? 'Unsaved changes' : `${assignedCount} of ${PRINTER_TYPES.length} assigned`}
                                    </p>
                                    <Button onClick={() => persist(settings, 'Printers saved')} disabled={saving || !dirty}>
                                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save printers
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        <div className="flex justify-end xl:col-span-2">
                            <Button variant="outline" onClick={() => changeTab('kitchen')}>Next: kitchen tickets</Button>
                        </div>
                    </TabsContent>

                    {/* ---------------- 2. Kitchen tickets */}
                    <TabsContent value="kitchen" className="mt-0 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
                        <div className="space-y-5 min-w-0">
                            <KitchenTicketModeCard mode={kotMode} onChange={changeKotMode} />
                            {kotMode === 'queue' && <KitchenDevicesCard />}
                        </div>
                        <PrintStationsCard key={kotMode} mode={kotMode === 'queue' ? 'queue' : 'direct'} />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}

function BridgeBadge({ status, version }: { status: BridgeStatus; version?: string | null }) {
    if (status === 'online') {
        return (
            <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> BizzFlow Printer{version ? ` ${version}` : ''}
            </Badge>
        );
    }
    if (status === 'offline') {
        return (
            <Badge variant="outline" className="gap-1.5 border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Printer app offline
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Checking...
        </Badge>
    );
}

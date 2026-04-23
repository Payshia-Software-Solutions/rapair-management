"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchHRSettings,
  updateHRSettings
} from "@/lib/api/hrm";
import { Loader2, Gavel, Save, Octagon, CalendarX, Clock, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function PayrollRulesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHRSettings();
      setSettings(data);
    } catch (err) {
      toast({ title: "Sync Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateHRSettings(settings);
      toast({ title: "Success", description: "Payroll rules updated" });
      void loadData();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return (
          <DashboardLayout>
              <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Fetching organizational rules...</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
           <Link href="/hrm/settings" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mb-2">
             <ArrowLeft className="w-3 h-3" /> Back to Overview
           </Link>
           <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
             <Gavel className="w-8 h-8 text-indigo-500" />
             Payroll Penalty Rules
           </h1>
           <p className="text-muted-foreground mt-1">Configure automated financial deductions for attendance exceptions</p>
        </div>
        <Button className="h-11 px-8 shadow-xl shadow-primary/20 font-bold" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Policy Changes
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md overflow-hidden rounded-[2rem]">
              <CardHeader className="bg-primary/5 border-b pb-6 pt-8 px-8">
                  <div className="flex items-center justify-between">
                      <div>
                          <CardTitle className="text-xl">Automated Tracking</CardTitle>
                          <CardDescription>Enable or disable automated cross-referencing with the attendance module</CardDescription>
                      </div>
                      <Switch 
                        checked={settings['PAYROLL_AUTO_CALC_ATTENDANCE'] === '1'} 
                        onCheckedChange={checked => setSettings({...settings, PAYROLL_AUTO_CALC_ATTENDANCE: checked ? '1' : '0'})}
                      />
                  </div>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                  {/* Lateness Section */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                      <div className="md:col-span-5 flex items-center gap-4">
                          <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500">
                              <Clock className="w-8 h-8" />
                          </div>
                          <div>
                              <h4 className="font-black uppercase tracking-widest text-sm text-foreground">Lateness Penalty</h4>
                              <p className="text-xs text-muted-foreground">Fixed amount deducted per 'Late' arrival</p>
                          </div>
                      </div>
                      <div className="md:col-span-7 flex justify-end">
                          <div className="relative w-48">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">LKR</span>
                              <Input 
                                type="number" 
                                className="h-12 pl-12 rounded-xl bg-background font-mono font-black" 
                                value={settings['PAYROLL_LATE_PENALTY']}
                                onChange={e=>setSettings({...settings, PAYROLL_LATE_PENALTY: e.target.value})}
                              />
                          </div>
                      </div>
                  </div>

                  <div className="h-px bg-muted/20" />

                  {/* Absence Section */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      <div className="md:col-span-12 flex items-center gap-4 mb-2">
                          <div className="p-4 bg-red-500/10 rounded-2xl text-red-500">
                              <CalendarX className="w-8 h-8" />
                          </div>
                          <div>
                              <h4 className="font-black uppercase tracking-widest text-sm text-foreground">Absence Policy</h4>
                              <p className="text-xs text-muted-foreground">How the system calculates deductions for missing days</p>
                          </div>
                      </div>

                      <div className="md:col-span-6 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Calculation Method</Label>
                          <Select 
                            value={settings['PAYROLL_ABSENCE_DEDUCTION_TYPE']} 
                            onValueChange={v => setSettings({...settings, PAYROLL_ABSENCE_DEDUCTION_TYPE: v})}
                          >
                              <SelectTrigger className="h-12 rounded-xl bg-background font-bold px-4">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="daily_fraction">Daily Wage Fraction (Basic / 30)</SelectItem>
                                  <SelectItem value="fixed">Fixed Amount per Day</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>

                      <div className="md:col-span-6 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Fixed Deduction Amount</Label>
                          <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">LKR</span>
                               <Input 
                                 type="number" 
                                 disabled={settings['PAYROLL_ABSENCE_DEDUCTION_TYPE'] === 'daily_fraction'} 
                                 className="h-12 pl-12 rounded-xl bg-background font-mono font-black" 
                                 value={settings['PAYROLL_ABSENCE_FIXED_AMOUNT']}
                                 onChange={e=>setSettings({...settings, PAYROLL_ABSENCE_FIXED_AMOUNT: e.target.value})}
                               />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic px-1">Only used if "Fixed Amount" method is selected above.</p>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-indigo-600 text-white rounded-[2rem] overflow-hidden relative">
              <Octagon className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 rotate-12" />
              <CardHeader>
                  <CardTitle className="text-lg">Policy Note</CardTitle>
                  <CardDescription className="text-indigo-100">Rules applied during generation phase</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium leading-relaxed">
                  When enabled, any employee with 'Late', 'Absent' or 'Half-Day' status in the attendance module will automatically trigger a deduction in their draft payroll for that month. 
                  Deductions for Half-Days are calculated as 50% of the daily absence rate.
              </CardContent>
          </Card>
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fetchStorefrontSettings, updateStorefrontSettings } from "@/lib/api";
import { HelpCircle, Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from "lucide-react";

type FaqItem = { question: string; answer: string; active: boolean };

function parseItems(raw: unknown): FaqItem[] {
  try {
    const list = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(list)) return [];
    return list.map((i) => ({
      question: String(i?.question ?? ""),
      answer: String(i?.answer ?? ""),
      active: i?.active !== false,
    }));
  } catch {
    return [];
  }
}

export default function FaqPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchStorefrontSettings();
        setItems(parseItems(data?.faq_items));
      } catch {
        toast({ title: "Error", description: "Failed to load FAQ.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (index: number, patch: Partial<FaqItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setDirty(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const remove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const add = () => {
    setItems((prev) => [...prev, { question: "", answer: "", active: true }]);
    setDirty(true);
  };

  const save = async () => {
    const incomplete = items.some((i) => i.active && (!i.question.trim() || !i.answer.trim()));
    if (incomplete) {
      toast({ title: "Incomplete", description: "Every active question needs an answer.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const clean = items.map((i) => ({ question: i.question.trim(), answer: i.answer.trim(), active: i.active }));
      await updateStorefrontSettings({ faq_items: JSON.stringify(clean) });
      setDirty(false);
      toast({ title: "Saved", description: "FAQ updated on the website." });
    } catch {
      toast({ title: "Error", description: "Failed to save FAQ.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="FAQ">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="FAQ">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-indigo-500" /> Website FAQ
            </h1>
            <p className="text-sm text-muted-foreground">
              These questions appear on the home page. Turn one off to hide it without deleting it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={add}>
              <Plus className="w-4 h-4 mr-2" /> Add question
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save FAQ
            </Button>
          </div>
        </div>

        {items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No questions yet. Click &quot;Add question&quot; to create the first one.
            </CardContent>
          </Card>
        )}

        {items.map((item, index) => (
          <Card key={index} className={item.active ? "" : "opacity-60"}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-base">Question {index + 1}</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <Label htmlFor={`faq-active-${index}`} className="text-sm">Show on site</Label>
                  <Switch
                    id={`faq-active-${index}`}
                    checked={item.active}
                    onCheckedChange={(v) => update(index, { active: v })}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down">
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Delete question">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`faq-q-${index}`}>Question</Label>
                <Input
                  id={`faq-q-${index}`}
                  value={item.question}
                  placeholder="e.g. Do you ship internationally?"
                  onChange={(e) => update(index, { question: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`faq-a-${index}`}>Answer</Label>
                <Textarea
                  id={`faq-a-${index}`}
                  rows={4}
                  value={item.answer}
                  placeholder="Write the answer shoppers will see."
                  onChange={(e) => update(index, { answer: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

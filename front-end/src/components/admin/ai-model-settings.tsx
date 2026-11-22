"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSystemSettings, updateSystemSettings } from "@/lib/api";

type Provider = "gemini" | "claude" | "openai";

export const AI_PROVIDERS: { id: Provider; name: string; keyFrom: string; defaultModel: string }[] = [
  { id: "gemini", name: "Google Gemini", keyFrom: "aistudio.google.com/apikey", defaultModel: "gemini-3.5-flash-lite" },
  { id: "claude", name: "Anthropic Claude", keyFrom: "console.anthropic.com", defaultModel: "claude-opus-5-5" },
  { id: "openai", name: "OpenAI ChatGPT", keyFrom: "platform.openai.com/api-keys", defaultModel: "gpt-5-mini" },
];

const MASK = "••••";

/**
 * Company-wide AI model (System Settings → AI). Used by Business Intelligence and the
 * e-commerce assistant. Keys are stored on the server and come back masked.
 */
export function AiModelSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [keys, setKeys] = useState<Record<Provider, string>>({ gemini: "", claude: "", openai: "" });
  const [models, setModels] = useState<Record<Provider, string>>({ gemini: "", claude: "", openai: "" });

  useEffect(() => {
    void (async () => {
      try {
        const s = await fetchSystemSettings();
        setProvider((AI_PROVIDERS.some((p) => p.id === s.ai_provider) ? s.ai_provider : "gemini") as Provider);
        setKeys({ gemini: s.ai_gemini_key || "", claude: s.ai_claude_key || "", openai: s.ai_openai_key || "" });
        setModels({ gemini: s.ai_gemini_model || "", claude: s.ai_claude_model || "", openai: s.ai_openai_model || "" });
      } catch (e: any) {
        toast({ title: "Couldn't load AI settings", description: e?.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({
        ai_provider: provider,
        ai_gemini_key: keys.gemini, ai_claude_key: keys.claude, ai_openai_key: keys.openai,
        ai_gemini_model: models.gemini.trim(), ai_claude_model: models.claude.trim(), ai_openai_model: models.openai.trim(),
      });
      toast({ title: "AI settings saved", description: "Business Intelligence and the website assistant now use this model." });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message || "Only administrators can change this.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</Card>;
  }

  const active = AI_PROVIDERS.find((p) => p.id === provider)!;

  return (
    <Card className="p-4 space-y-5">
      <div>
        <h2 className="font-semibold">AI model</h2>
        <p className="text-sm text-muted-foreground">
          One model for the whole company: Business Intelligence and the e-commerce assistant both use it.
        </p>
      </div>

      <div role="radiogroup" aria-label="AI provider" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {AI_PROVIDERS.map((p) => {
          const on = provider === p.id;
          const hasKey = !!keys[p.id];
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setProvider(p.id)}
              className={cn("flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary/5" : "hover:bg-muted/40")}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                {on && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className={cn("block text-xs", hasKey ? "text-emerald-600" : "text-muted-foreground")}>{hasKey ? "Key saved" : "No key yet"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-key">{active.name} API key</Label>
          <Input id="ai-key" type="password" autoComplete="off" className="font-mono" placeholder="Paste the API key"
            value={keys[provider]}
            onFocus={(e) => { if (e.target.value.startsWith(MASK)) setKeys((k) => ({ ...k, [provider]: "" })); }}
            onBlur={(e) => { if (!e.target.value) void fetchSystemSettings().then((s) => setKeys((k) => ({ ...k, [provider]: k[provider] || s[`ai_${provider}_key`] || "" }))); }}
            onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))} />
          <p className="text-xs text-muted-foreground">Get one at {active.keyFrom}. Stored on the server only; a saved key shows as dots and its last 4 characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-model">Model</Label>
          <Input id="ai-model" className="font-mono" placeholder={active.defaultModel}
            value={models[provider]} onChange={(e) => setModels((m) => ({ ...m, [provider]: e.target.value }))} />
          <p className="text-xs text-muted-foreground">Leave empty to use {active.defaultModel}.</p>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
        Save AI settings
      </Button>
    </Card>
  );
}

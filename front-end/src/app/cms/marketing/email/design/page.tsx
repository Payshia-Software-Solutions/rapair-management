"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Layout, 
  Sparkles, 
  ChevronDown,
  Loader2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PREMADE_TEMPLATES, EmailBlock } from "../constants";

export default function DesignHubPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [creationMode, setCreationMode] = useState<'select' | 'templates'>('select');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const startCustomMode = () => {
    sessionStorage.removeItem("email_editor_blocks");
    router.push("/cms/marketing/email/editor");
  };

  const startTemplateMode = () => {
    setCreationMode('templates');
  };

  const selectTemplate = (blocks: EmailBlock[]) => {
    sessionStorage.setItem("email_editor_blocks", JSON.stringify(blocks));
    router.push("/cms/marketing/email/editor");
  };

  const generateAiNewsletter = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      // Simulating AI generation logic from previous version
      setTimeout(() => {
        const generatedBlocks: EmailBlock[] = [
          { id: Math.random().toString(), type: 'hero', content: { title: aiPrompt.toUpperCase(), subtitle: 'AI Generated Layout' } },
          { id: Math.random().toString(), type: 'text', content: { text: `Here is some tailored content based on: ${aiPrompt}. This layout was generated specifically to engage your customers with high-quality services.` } },
          { id: Math.random().toString(), type: 'services', content: { items: ['Premium Wash', 'Oil Check', 'Interior Detail'] } },
          { id: Math.random().toString(), type: 'button', content: { label: 'VIEW DETAILS', url: '#' } }
        ];
        sessionStorage.setItem("email_editor_blocks", JSON.stringify(generatedBlocks));
        toast({ title: "Generated", description: "AI has crafted your newsletter layout." });
        setIsGenerating(false);
        router.push("/cms/marketing/email/editor");
      }, 1500);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Design Hub" subtitle="Start a new email design">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Design Hub</h2>
              <p className="text-muted-foreground text-xs">Choose how you want to start</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="group border shadow-sm hover:shadow-md transition-all cursor-pointer rounded-xl overflow-hidden" onClick={startTemplateMode}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto group-hover:bg-primary group-hover:text-white transition-all">
                <Layout className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold">Templates</h3>
              <p className="text-muted-foreground text-xs">Use a pre-designed layout</p>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm hover:shadow-md transition-all cursor-pointer rounded-xl overflow-hidden" onClick={startCustomMode}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto group-hover:bg-primary group-hover:text-white transition-all">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold">Custom</h3>
              <p className="text-muted-foreground text-xs">Build block by block</p>
            </CardContent>
          </Card>

          <Card className="group border shadow-sm hover:shadow-md transition-all cursor-pointer rounded-xl overflow-hidden bg-slate-900 text-white" onClick={() => setIsAiModalOpen(true)}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mx-auto group-hover:bg-emerald-400 group-hover:text-black transition-all">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-emerald-400">AI Craft</h3>
              <p className="text-slate-400 text-xs">Let AI build the foundation</p>
            </CardContent>
          </Card>
        </div>

        {creationMode === 'templates' && (
          <div className="animate-in fade-in pt-4">
            <h3 className="text-xs font-bold text-muted-foreground mb-4">Available Layouts</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PREMADE_TEMPLATES.map(template => (
                <Card key={template.id} className="border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden rounded-xl" onClick={() => selectTemplate(template.blocks)}>
                  <div className="h-28 bg-slate-100 flex items-center justify-center">
                    <Layout className="w-10 h-10 text-slate-300" />
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-bold text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Modal */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
               <Sparkles className="w-6 h-6 text-primary" /> AI Newsletter Craft
            </DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground pt-2">
               Describe your goal, and our AI will generate a structured newsletter layout for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Theme / Topic</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. Summer service discounts"
                  className="h-12 rounded-xl font-bold border-2"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateAiNewsletter()}
                />
                <Button onClick={generateAiNewsletter} disabled={isGenerating} className="h-12 w-12 rounded-xl p-0 shadow-lg shadow-primary/20">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 opacity-50">
               <div className="p-4 border-2 border-dashed rounded-2xl text-[10px] font-black uppercase text-center">Modern Minimal</div>
               <div className="p-4 border-2 border-dashed rounded-2xl text-[10px] font-black uppercase text-center">Corporate Bold</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchEmailTemplates,
  deleteEmailTemplate
} from "@/lib/api";
import { 
  Send, 
  Layout, 
  ChevronDown,
  FileCode,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function DesignLibraryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const tmpls = await fetchEmailTemplates();
      setTemplates(tmpls);
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [toast]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteEmailTemplate(id);
      toast({ title: "Success", description: "Template deleted." });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const loadTemplate = (template: any) => {
    try {
      // Validate content is JSON
      JSON.parse(template.content);
      sessionStorage.setItem("email_editor_blocks", template.content);
      sessionStorage.setItem("email_editor_template_id", template.id.toString());
      sessionStorage.setItem("email_editor_template_name", template.name);
      router.push("/cms/marketing/email/editor");
    } catch (e) {
      toast({ title: "Error", description: "Failed to load template blocks.", variant: "destructive" });
    }
  };

  const launchCampaign = (templateId: number, templateName: string) => {
    router.push(`/cms/marketing/email/builder?templateId=${templateId}&name=${encodeURIComponent(templateName)}`);
  };

  return (
    <DashboardLayout title="Design Library" subtitle="Manage saved newsletter templates">
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/cms/marketing/email')} className="w-9 h-9 rounded-lg p-0">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Design Library</h2>
              <p className="text-muted-foreground text-xs">Your saved designs</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: any) => (
            <Card key={template.id} className="border shadow-sm rounded-xl overflow-hidden group hover:shadow-md transition-all">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileCode className="w-4 h-4 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md">Saved</Badge>
                </div>
                <h4 className="font-bold text-sm mb-1">{template.name}</h4>
                <p className="text-[11px] text-muted-foreground">Modified {new Date(template.created_at).toLocaleDateString()}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-9 rounded-lg font-bold text-xs" onClick={() => loadTemplate(template)}>
                    <Layout className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="w-9 h-9 p-0 rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" className="flex-1 h-9 rounded-lg font-bold text-xs bg-slate-900 text-white hover:bg-slate-800" onClick={() => launchCampaign(template.id, template.name)}>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Launch
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {!loading && templates.length === 0 && (
            <div className="col-span-full py-16 bg-muted/10 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6">
              <FileCode className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <h4 className="font-bold text-sm mb-1">Your library is empty</h4>
              <p className="text-xs text-muted-foreground">Create your first design to see it here.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

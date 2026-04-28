"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchMarketingMedia,
  uploadMarketingImage,
  saveEmailTemplate
} from "@/lib/api";
import { 
  Plus, 
  Layout, 
  Sparkles, 
  Loader2, 
  Eye, 
  Code, 
  Save, 
  Trash2,
  Maximize2,
  Smartphone,
  Monitor,
  GripVertical,
  Type,
  Image as ImageIcon,
  Square,
  Minus,
  Grid,
  Settings2,
  ChevronUp,
  ChevronDown,
  X,
  PlayCircle,
  UploadCloud,
  Layers,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { EmailBlock, BlockType, FONTS } from "../constants";
import { compileEmailHtml } from "../utils";

export default function EmailEditorPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual');
  const [htmlCode, setHtmlCode] = useState("");
  const [canvasBgColor, setCanvasBgColor] = useState("#ffffff");
  const [contentBgColor, setContentBgColor] = useState("#ffffff");
  
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaTargetCallback, setMediaTargetCallback] = useState<((url: string) => void) | null>(null);
  
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize blocks from sessionStorage
  useEffect(() => {
    const storedBlocks = sessionStorage.getItem("email_editor_blocks");
    const storedId = sessionStorage.getItem("email_editor_template_id");
    const storedName = sessionStorage.getItem("email_editor_template_name");

    if (storedBlocks) {
      try {
        setBlocks(JSON.parse(storedBlocks));
      } catch (e) {
        console.error("Failed to parse stored blocks", e);
      }
    }
    if (storedId) setTemplateId(parseInt(storedId));
    if (storedName) setSaveName(storedName);
  }, []);

  // Sync blocks back to sessionStorage on change
  useEffect(() => {
    if (blocks.length > 0) {
      sessionStorage.setItem("email_editor_blocks", JSON.stringify(blocks));
    }
  }, [blocks]);

  // Load media list
  useEffect(() => {
    const loadMedia = async () => {
      try {
        const mRes = await fetchMarketingMedia();
        setMediaList(mRes || []);
      } catch (e) {}
    };
    loadMedia();
  }, []);

  useEffect(() => {
    setHtmlCode(compileEmailHtml(blocks, { canvasBgColor, contentBgColor }));
  }, [blocks, canvasBgColor, contentBgColor]);

  const addBlock = (type: BlockType) => {
    const newBlock: EmailBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: type === 'hero' ? { title: 'New Hero', subtitle: 'Enter subtitle here', textAlign: 'center' } :
               type === 'text' ? { text: 'Enter your text here...', textAlign: 'left' } :
               type === 'image' ? { url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=600' } :
               type === 'image-grid' ? { 
                 rows: 1, 
                 columns: 2, 
                 backgroundColor: '#ffffff',
                 items: [
                   { url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400', linkText: 'Click Here', linkUrl: '#' },
                   { url: 'https://images.unsplash.com/photo-1530046339160-ce3e5b0c7a2f?auto=format&fit=crop&q=80&w=400', linkText: 'Learn More', linkUrl: '#' }
                 ] 
               } :
               type === 'button' ? { label: 'Click Me', url: '#' } :
               type === 'social' ? { facebook: '#', instagram: '#', twitter: '#' } :
               type === 'video' ? { url: '#' } :
               type === 'services' ? { items: ['Feature A', 'Feature B', 'Feature C'] } :
               type === 'divider' ? {} :
               { text: 'Side text here' }
    };
    setBlocks([...blocks, newBlock]);
    setActiveBlockId(newBlock.id);
  };

  const updateBlock = (id: string, content: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const handleSave = async () => {
    if (!saveName) {
      toast({ title: "Error", description: "Template name is required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await saveEmailTemplate({ 
        id: templateId || undefined, // Include ID if updating
        name: saveName, 
        content: JSON.stringify(blocks) 
      });
      
      // If it was a new save, update the ID for future updates
      if (res.data?.id) {
        setTemplateId(res.data.id);
        sessionStorage.setItem("email_editor_template_id", res.data.id.toString());
      }
      
      toast({ title: "Success", description: templateId ? "Template updated!" : "Template saved successfully!" });
      setIsSaveModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openMediaCenter = (callback: (url: string) => void) => {
    setMediaTargetCallback(() => callback);
    setIsMediaModalOpen(true);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    try {
      const file = e.target.files[0];
      await uploadMarketingImage(file);
      toast({ title: "Success", description: "Image uploaded." });
      const mRes = await fetchMarketingMedia();
      setMediaList(mRes || []);
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout title="Email Editor" subtitle="Design your newsletter template">
      <div className="flex flex-col gap-4 pb-12 animate-in fade-in duration-300">
        {/* Editor Top Bar */}
        <div className="flex justify-between items-center bg-slate-900 text-white p-3 px-5 rounded-xl shadow-sm">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/cms/marketing/email/design')} className="rounded-lg text-xs hover:bg-white/10 text-white">
              <ChevronDown className="w-3.5 h-3.5 mr-1.5 rotate-90" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSaveModalOpen(true)} className="rounded-lg text-xs bg-emerald-500 border-none text-white hover:bg-emerald-600 transition-all" disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              {templateId ? 'Save & Rename' : 'Save to Library'}
            </Button>
            {templateId && (
              <Button variant="ghost" size="sm" onClick={() => { setTemplateId(null); setSaveName(""); setBlocks([]); sessionStorage.removeItem("email_editor_template_id"); sessionStorage.removeItem("email_editor_template_name"); sessionStorage.removeItem("email_editor_blocks"); }} className="rounded-lg text-xs text-slate-400 hover:text-white">
                New Design
              </Button>
            )}
          </div>
          <div className="text-xs text-slate-400 px-4 border-l border-white/10">Template Designer</div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
          {/* Sidebar: Building Blocks & Settings */}
          <div className="xl:col-span-3 space-y-6">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-muted py-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Building Blocks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('hero')}>
                  <ImageIcon className="w-5 h-5" /> Hero Section
                </Button>
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('text')}>
                  <Type className="w-5 h-5" /> Text Block
                </Button>
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('button')}>
                  <Square className="w-5 h-5" /> Call to Action
                </Button>
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('divider')}>
                  <Minus className="w-5 h-5" /> Divider
                </Button>
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('image-grid')}>
                  <Grid className="w-5 h-5" /> Image Grid
                </Button>
                <Button variant="outline" className="h-20 rounded-2xl flex-col gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all" onClick={() => addBlock('services')}>
                  <Layers className="w-5 h-5" /> Services List
                </Button>
              </CardContent>
            </Card>

            {activeBlockId && (
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-right-4">
                <CardHeader className="bg-primary/5 border-b border-primary/10 py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
                    <span>Block Settings</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setActiveBlockId(null)}><X className="w-4 h-4" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
                   {blocks.find(b => b.id === activeBlockId)?.type === 'hero' && (
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Main Title</label>
                           <Input value={blocks.find(b => b.id === activeBlockId)?.content.title} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtitle</label>
                           <Input value={blocks.find(b => b.id === activeBlockId)?.content.subtitle} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, subtitle: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alignment</label>
                           <div className="flex gap-1 bg-muted p-1 rounded-lg">
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'left' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'left' })}
                              >
                                <AlignLeft className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'center' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'center' })}
                              >
                                <AlignCenter className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'right' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'right' })}
                              >
                                <AlignRight className="w-3.5 h-3.5" />
                              </Button>
                           </div>
                        </div>

                        <div className="pt-4 border-t space-y-3">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title Font</label>
                              <Select value={blocks.find(b => b.id === activeBlockId)?.content.titleFont} onValueChange={val => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, titleFont: val })}>
                                <SelectTrigger className="h-8 text-xs font-bold w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>{FONTS.map(f => <SelectItem key={f.value} value={f.value}>{f.name}</SelectItem>)}</SelectContent>
                              </Select>
                           </div>
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title Color</label>
                              <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.titleColor || '#000000'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, titleColor: e.target.value })} />
                           </div>
                        </div>
                     </div>
                   )}
                   {blocks.find(b => b.id === activeBlockId)?.type === 'text' && (
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content Text</label>
                        <Textarea className="min-h-[150px] font-medium" value={blocks.find(b => b.id === activeBlockId)?.content.text} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, text: e.target.value })} />
                        
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alignment</label>
                           <div className="flex gap-1 bg-muted p-1 rounded-lg">
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'left' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'left' })}
                              >
                                <AlignLeft className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'center' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'center' })}
                              >
                                <AlignCenter className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'right' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'right' })}
                              >
                                <AlignRight className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant={blocks.find(b => b.id === activeBlockId)?.content.textAlign === 'justify' ? 'secondary' : 'ghost'} 
                                size="sm" className="flex-1 h-8 px-0" 
                                onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textAlign: 'justify' })}
                              >
                                <AlignJustify className="w-3.5 h-3.5" />
                              </Button>
                           </div>
                        </div>

                        <div className="pt-4 border-t space-y-3">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Text Color</label>
                              <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.textColor || '#555555'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textColor: e.target.value })} />
                           </div>
                        </div>
                     </div>
                   )}
                   {blocks.find(b => b.id === activeBlockId)?.type === 'button' && (
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Button Label</label>
                           <Input value={blocks.find(b => b.id === activeBlockId)?.content.label} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, label: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action URL</label>
                           <Input value={blocks.find(b => b.id === activeBlockId)?.content.url} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, url: e.target.value })} placeholder="https://..." />
                        </div>
                        <div className="pt-4 border-t space-y-3">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Background</label>
                              <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.buttonBgColor || '#000000'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, buttonBgColor: e.target.value })} />
                           </div>
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Text Color</label>
                              <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.buttonTextColor || '#ffffff'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, buttonTextColor: e.target.value })} />
                           </div>
                        </div>
                     </div>
                   )}
                    {blocks.find(b => b.id === activeBlockId)?.type === 'image' && (
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Image Media</label>
                            <div className="flex gap-2">
                               <div className="flex-1 h-20 bg-muted/40 rounded-2xl overflow-hidden border">
                                  <img src={blocks.find(b => b.id === activeBlockId)?.content.url} className="w-full h-full object-cover" />
                               </div>
                               <Button variant="outline" className="h-20 rounded-2xl flex-1 text-[10px] font-black uppercase tracking-widest" onClick={() => openMediaCenter(url => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, url }))}>Change Image</Button>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link URL (Optional)</label>
                            <Input placeholder="https://..." value={blocks.find(b => b.id === activeBlockId)?.content.linkUrl} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, linkUrl: e.target.value })} />
                         </div>
                      </div>
                    )}
                   {blocks.find(b => b.id === activeBlockId)?.type === 'image-grid' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rows</label>
                              <Input type="number" min="1" max="5" value={blocks.find(b => b.id === activeBlockId)?.content.rows} onChange={e => {
                                 const rows = parseInt(e.target.value) || 1;
                                 const currentContent = blocks.find(b => b.id === activeBlockId)?.content;
                                 const needed = rows * currentContent.columns;
                                 let newItems = [...currentContent.items];
                                 if (newItems.length < needed) {
                                    for(let i=newItems.length; i<needed; i++) newItems.push({ url: 'https://placehold.co/400', linkText: '', linkUrl: '#' });
                                 }
                                 updateBlock(activeBlockId, { ...currentContent, rows, items: newItems });
                              }} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Columns</label>
                              <Input type="number" min="1" max="4" value={blocks.find(b => b.id === activeBlockId)?.content.columns} onChange={e => {
                                 const columns = parseInt(e.target.value) || 1;
                                 const currentContent = blocks.find(b => b.id === activeBlockId)?.content;
                                 const needed = currentContent.rows * columns;
                                 let newItems = [...currentContent.items];
                                 if (newItems.length < needed) {
                                    for(let i=newItems.length; i<needed; i++) newItems.push({ url: 'https://placehold.co/400', linkText: '', linkUrl: '#' });
                                 }
                                 updateBlock(activeBlockId, { ...currentContent, columns, items: newItems });
                              }} />
                           </div>
                        </div>
                        <div className="space-y-3 pt-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Media</label>
                           {blocks.find(b => b.id === activeBlockId)?.content.items.map((item: any, idx: number) => (
                              <div key={idx} className="p-3 bg-muted/40 rounded-xl space-y-2">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold">Item {idx + 1}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => openMediaCenter(url => {
                                       const newItems = [...blocks.find(b => b.id === activeBlockId)?.content.items];
                                       newItems[idx].url = url;
                                       updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                                    })}>Select Image</Button>
                                 </div>
                                    <div className="grid grid-cols-2 gap-2">
                                       <Input className="h-8 text-[10px]" placeholder="Link Text" value={item.linkText} onChange={e => {
                                         const newItems = [...(blocks.find(b => b.id === activeBlockId)?.content.items || [])];
                                         newItems[idx] = { ...item, linkText: e.target.value };
                                         updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                                       }} />
                                       <Input className="h-8 text-[10px]" placeholder="Link URL" value={item.linkUrl} onChange={e => {
                                         const newItems = [...(blocks.find(b => b.id === activeBlockId)?.content.items || [])];
                                         newItems[idx] = { ...item, linkUrl: e.target.value };
                                         updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                                       }} />
                                    </div>
                              </div>
                           ))}
                        </div>
                     </div>
                   )}
                   {/* Background color for any block */}
                   {blocks.find(b => b.id === activeBlockId)?.type === 'services' && (
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Items</label>
                        <div className="space-y-2">
                           {blocks.find(b => b.id === activeBlockId)?.content.items?.map((item: string, idx: number) => (
                              <div key={idx} className="flex gap-2">
                                 <Input className="h-8 text-xs font-bold" value={item} onChange={e => {
                                    const newItems = [...(blocks.find(b => b.id === activeBlockId)?.content.items || [])];
                                    newItems[idx] = e.target.value;
                                    updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                                 }} />
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => {
                                    const newItems = blocks.find(b => b.id === activeBlockId)?.content.items.filter((_: any, i: number) => i !== idx);
                                    updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                                 }}><X className="w-3.5 h-3.5" /></Button>
                              </div>
                           ))}
                           <Button variant="outline" size="sm" className="w-full h-8 border-dashed text-[10px] font-bold" onClick={() => {
                              const currentItems = blocks.find(b => b.id === activeBlockId)?.content.items || [];
                              const newItems = [...currentItems, "New Service"];
                              updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, items: newItems });
                           }}><Plus className="w-3 h-3 mr-1" /> Add Service Item</Button>
                        </div>
                        
                        <div className="pt-4 border-t space-y-3">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Text Color</label>
                              <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.textColor || '#000000'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, textColor: e.target.value })} />
                           </div>
                        </div>
                     </div>
                   )}
                   <div className="pt-4 border-t space-y-3">
                      <div className="flex justify-between items-center">
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Block Background</label>
                         <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, backgroundColor: 'transparent' })}>Clear</Button>
                            <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={blocks.find(b => b.id === activeBlockId)?.content.backgroundColor || '#ffffff'} onChange={e => updateBlock(activeBlockId, { ...blocks.find(b => b.id === activeBlockId)?.content, backgroundColor: e.target.value })} />
                         </div>
                      </div>
                   </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/10">
                   <Button variant="destructive" className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] gap-2" onClick={() => deleteBlock(activeBlockId)}>
                      <Trash2 className="w-3.5 h-3.5" /> Remove Block
                   </Button>
                </CardFooter>
              </Card>
            )}

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
               <CardHeader className="bg-muted/30 border-b border-muted py-4">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                   <Settings2 className="w-4 h-4" /> Global Style
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Canvas Background</label>
                    <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={canvasBgColor} onChange={e => setCanvasBgColor(e.target.value)} />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content Background</label>
                    <input type="color" className="w-8 h-8 rounded-lg cursor-pointer" value={contentBgColor} onChange={e => setContentBgColor(e.target.value)} />
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* Main Stage: Preview / Code */}
          <div className="xl:col-span-9 space-y-6">
            <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)}>
              <div className="flex justify-between items-center mb-4">
                <TabsList className="bg-muted/50 p-1 rounded-xl h-11 border">
                  <TabsTrigger value="visual" className="rounded-lg font-black uppercase tracking-widest text-[9px] px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Eye className="w-3.5 h-3.5 mr-2" /> Visual Canvas
                  </TabsTrigger>
                  <TabsTrigger value="code" className="rounded-lg font-black uppercase tracking-widest text-[9px] px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Code className="w-3.5 h-3.5 mr-2" /> HTML Code
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2 bg-muted/50 p-1 rounded-xl border">
                  <Button variant={viewMode === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-10 p-0 rounded-lg" onClick={() => setViewMode('desktop')}>
                    <Monitor className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant={viewMode === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-10 p-0 rounded-lg" onClick={() => setViewMode('mobile')}>
                    <Smartphone className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <TabsContent value="visual" className="mt-0 ring-0 focus-visible:ring-0 outline-none">
                <div className="flex justify-center bg-slate-200/50 rounded-[2.5rem] p-10 min-h-[700px] border-4 border-white shadow-inner">
                  <div 
                    className={`bg-white shadow-2xl transition-all duration-500 overflow-hidden ${viewMode === 'mobile' ? 'w-[375px] rounded-[3rem] border-[12px] border-slate-900' : 'w-full max-w-[600px] rounded-2xl'}`}
                    style={{ backgroundColor: canvasBgColor }}
                  >
                    <div style={{ backgroundColor: contentBgColor }} className="min-h-full">
                       {blocks.length === 0 ? (
                         <div className="p-20 text-center flex flex-col items-center justify-center space-y-6 opacity-30">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                               <Plus className="w-10 h-10" />
                            </div>
                            <div>
                               <p className="font-black uppercase tracking-widest text-lg">Canvas Empty</p>
                               <p className="text-sm font-bold">Add blocks from the sidebar to begin.</p>
                            </div>
                         </div>
                       ) : (
                         blocks.map((block, idx) => (
                           <div 
                             key={block.id} 
                             className={`group relative cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all ${activeBlockId === block.id ? 'border-primary' : ''}`}
                             onClick={(e) => { e.stopPropagation(); setActiveBlockId(block.id); }}
                           >
                              <div className="absolute left-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                 <Button variant="secondary" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={(e) => { e.stopPropagation(); moveBlock(idx, 'up'); }}><ChevronUp className="w-3.5 h-3.5" /></Button>
                                 <Button variant="secondary" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={(e) => { e.stopPropagation(); moveBlock(idx, 'down'); }}><ChevronDown className="w-3.5 h-3.5" /></Button>
                              </div>
                              
                              <div style={{ backgroundColor: block.content.backgroundColor || 'transparent' }}>
                                 {block.type === 'hero' && (
                                   <div className="py-12 px-10 text-center" style={{ textAlign: block.content.textAlign || 'center' }}>
                                      <h1 style={{ color: block.content.titleColor || '#000', fontFamily: block.content.titleFont || 'inherit' }} className="text-4xl font-black uppercase tracking-tight">{block.content.title}</h1>
                                      <p style={{ color: block.content.subtitleColor || '#666', fontFamily: block.content.subtitleFont || 'inherit' }} className="text-sm font-bold mt-2">{block.content.subtitle}</p>
                                   </div>
                                 )}
                                 {block.type === 'text' && (
                                   <div className="py-6 px-10 text-sm font-medium leading-relaxed" style={{ color: block.content.textColor || '#555', fontFamily: block.content.fontFamily || 'inherit', textAlign: block.content.textAlign || 'left' }}>
                                      {block.content.text}
                                   </div>
                                 )}
                                 {block.type === 'button' && (
                                   <div className="py-6 text-center">
                                      <div style={{ backgroundColor: block.content.buttonBgColor || '#000', color: block.content.buttonTextColor || '#fff', fontFamily: block.content.buttonFont || 'inherit' }} className="inline-block px-8 py-3 rounded-lg font-black uppercase tracking-widest text-[10px]">
                                         {block.content.label}
                                      </div>
                                   </div>
                                 )}
                                 {block.type === 'image' && (
                                   <div className="p-10 relative group">
                                      <img src={block.content.url} alt="Content" className="w-full rounded-2xl shadow-lg" />
                                      {block.content.linkUrl && (
                                        <div className="absolute top-12 right-12 bg-primary text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-lg border border-white/20">
                                          Link Attached
                                        </div>
                                      )}
                                   </div>
                                 )}
                                 {block.type === 'divider' && <div className="px-10 py-6"><hr className="border-muted" /></div>}
                                 {block.type === 'services' && (
                                    <div className="px-10 py-6 flex gap-4">
                                       {block.content.items?.map((item: string, i: number) => (
                                          <div key={i} className="flex-1 bg-muted/50 p-4 rounded-xl text-center">
                                             <div className="text-[10px] font-black uppercase tracking-tight">{item}</div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                                 {block.type === 'image-grid' && (
                                    <div className="px-10 py-6" style={{ backgroundColor: block.content.backgroundColor || 'transparent' }}>
                                       <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${block.content.columns}, 1fr)` }}>
                                          {block.content.items.slice(0, block.content.rows * block.content.columns).map((item: any, i: number) => (
                                             <div key={i} className="space-y-2 text-center">
                                                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-sm">
                                                   <img src={item.url} className="w-full h-full object-cover" />
                                                </div>
                                                {item.linkText && <div className="text-[9px] font-black uppercase tracking-widest text-primary">{item.linkText}</div>}
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="code" className="mt-0 ring-0 focus-visible:ring-0 outline-none">
                 <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900">
                    <CardHeader className="bg-slate-800/50 border-b border-white/5 py-4 px-8">
                       <div className="flex justify-between items-center">
                          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Read-only Output</CardTitle>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-white" onClick={() => {
                             navigator.clipboard.writeText(htmlCode);
                             toast({ title: "Copied", description: "HTML code copied to clipboard." });
                          }}>Copy Code</Button>
                       </div>
                    </CardHeader>
                    <CardContent className="p-8">
                       <pre className="text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px]">
                          {htmlCode}
                       </pre>
                    </CardContent>
                 </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">{templateId ? 'Rename Template' : 'Save as Template'}</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground">{templateId ? 'Change the name of your existing design.' : 'Give your newsletter design a name to save it to your library.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Newsletter Name</label>
                <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="E.g. Summer Promo 2026" className="h-12 rounded-2xl border-2 font-bold" />
             </div>
             <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-tight bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20" onClick={handleSave} disabled={submitting}>
               {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : templateId ? "Rename & Update" : "Save to My Newsletters"}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Center Modal */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-4xl p-0 overflow-hidden bg-slate-50 border-none">
           <div className="p-8 bg-white border-b flex justify-between items-center">
              <div>
                 <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                   <ImageIcon className="w-6 h-6 text-primary" /> Media Center
                 </DialogTitle>
                 <DialogDescription className="font-medium mt-1">Select an image or upload a new one.</DialogDescription>
              </div>
              <div>
                 <input type="file" id="media-upload" className="hidden" accept="image/*" onChange={handleMediaUpload} disabled={isUploading} />
                 <label htmlFor="media-upload">
                    <Button asChild disabled={isUploading} className="h-12 rounded-2xl font-black uppercase tracking-widest cursor-pointer shadow-xl shadow-primary/20">
                       <span>
                          {isUploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UploadCloud className="w-5 h-5 mr-2" />}
                          Upload Image
                       </span>
                    </Button>
                 </label>
              </div>
           </div>
           <div className="p-8 h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 {mediaList.map((media, idx) => (
                    <div key={idx} className="group relative rounded-3xl overflow-hidden border-2 bg-white aspect-square flex items-center justify-center cursor-pointer hover:border-primary transition-all shadow-lg" onClick={() => {
                       if (mediaTargetCallback) mediaTargetCallback(media.url);
                       setIsMediaModalOpen(false);
                    }}>
                       <img src={media.url} alt={media.filename} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="secondary" className="font-black uppercase tracking-widest rounded-xl text-[10px]">Select</Button>
                       </div>
                    </div>
                 ))}
                 {mediaList.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-50">No images uploaded yet.</div>
                 )}
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

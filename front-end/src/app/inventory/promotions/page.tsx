"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fetchPromotions } from "@/lib/api";
import { 
  Gift, 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  Tag, 
  Settings2,
  AlertCircle,
  Zap,
  Trash2
} from "lucide-react";
import { PromotionFormModal } from "./components/PromotionFormModal";
import { PromotionTemplateGallery, type PromotionTemplate } from "./components/PromotionTemplateGallery";
import { SeasonalDiscountModal } from "./components/SeasonalDiscountModal";
import { BundleOfferModal } from "./components/BundleOfferModal";
import { BOGOModal } from "./components/BOGOModal";
import { ItemQtyRewardModal } from "./components/ItemQtyRewardModal";
import { WebsiteOfferModal } from "./components/WebsiteOfferModal";
import { BankOfferModal } from "./components/BankOfferModal";
import { togglePromotion, deletePromotion } from "@/lib/api";

export default function PromotionManagementPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  
  // Gallery & Modals State
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PromotionTemplate | null>(null);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Modal Visibility States
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [seasonalOpen, setSeasonalOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bogoOpen, setBogoOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPromotions();
      setPromotions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load promotions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateClick = () => {
    setSelectedId(null);
    setGalleryOpen(true);
  };

  const handleTemplateSelect = (template: PromotionTemplate) => {
    setGalleryOpen(false);
    setActiveTemplate(template);
    
    // Open corresponding modal
    if (template === 'seasonal') setSeasonalOpen(true);
    else if (template === 'bundle') setBundleOpen(true);
    else if (template === 'bogo') setBogoOpen(true);
    else if (template === 'qty') setQtyOpen(true);
    else if (template === 'website') setWebsiteOpen(true);
    else if (template === 'bank') setBankOpen(true);
    else setAdvancedOpen(true);
  };

  const handleEditClick = (promo: any) => {
    setSelectedId(promo.id);
    
    // Ensure data exists and normalize keys for robust detection
    const conditions = Array.isArray(promo.conditions) ? promo.conditions : [];
    const benefits = Array.isArray(promo.benefits) ? promo.benefits : [];
    const firstBenefit = benefits[0] || {};
    
    // Helper to check condition types case-insensitively
    const hasCondition = (type: string) => conditions.some((c: any) => {
        const cType = (c.condition_type || c.ConditionType || "").toLowerCase();
        return cType === type.toLowerCase();
    });

    // 1. Bank Offer Detect (Most specific)
    const isBankKeyword = promo.name?.toLowerCase().includes('bank') || 
                         promo.description?.toLowerCase().includes('bank');
                         
    if (hasCondition('BankCard') || hasCondition('CardCategory') || isBankKeyword) {
        return setBankOpen(true);
    }

    // 2. Website Offer Detect
    if (promo.description?.toLowerCase().startsWith('[website]')) {
        return setWebsiteOpen(true);
    }

    // 3. Bundle Offer Detect
    if (promo.type === 'Bundle') {
        return setBundleOpen(true);
    }

    // 4. BOGO / Qty Reward Detect
    if (promo.type === 'BOGO' || firstBenefit.benefit_type === 'BuyXGetY') {
        if (firstBenefit.trigger_items === firstBenefit.reward_items) return setQtyOpen(true);
        return setBogoOpen(true);
    }

    // 5. Seasonal Discount Detect
    const onlyMinAmount = conditions.length === 0 || 
                         (conditions.length === 1 && hasCondition('MinAmount'));
    
    if (promo.type === 'Discount' && onlyMinAmount && firstBenefit.benefit_type === 'Percentage') {
        return setSeasonalOpen(true);
    }

    // 6. Default to Advanced
    setAdvancedOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this promotion? This will not affect previous transactions but will remove the rule from future use.")) return;
    try {
        await deletePromotion(id);
        toast({ title: "Deleted", description: "Promotion removed successfully." });
        void load();
    } catch (e: any) {
        toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    }
  };

  const filtered = promotions.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.type.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                <Gift className="w-6 h-6 text-white" />
              </div>
              Promotion Engine
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Manage seasonal discounts, bundles, and loyalty schemas.
            </p>
          </div>
          <Button 
            onClick={handleCreateClick}
            className="h-12 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 mr-2" /> Create Promotion
          </Button>
        </div>

        {/* ... Stats Summary ... */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="p-4 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Active Now</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                  {promotions.filter(p => p.is_active).length}
                </h3>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="p-4 bg-blue-100 dark:bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Upcoming</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">0</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="p-4 bg-amber-100 dark:bg-amber-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                <Tag className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Types</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">4</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white dark:bg-slate-950 overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black tracking-tight">Active Rules</CardTitle>
                <CardDescription className="text-sm font-medium">All currently valid promotional logic.</CardDescription>
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search rules..." 
                  className="pl-11 h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 focus:ring-primary font-medium"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Synchronizing Data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-32 flex flex-col items-center justify-center gap-6 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black tracking-tight">No Promotions Found</p>
                  <p className="text-sm text-muted-foreground max-w-[280px] font-medium leading-relaxed">
                    You haven't defined any promotional rules yet. Start giving your customers a reason to stay!
                  </p>
                </div>
                <Button variant="outline" className="h-11 px-8 rounded-xl font-bold border-2" onClick={handleCreateClick}>
                   Create Your First Rule
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 border-none h-14">
                      <TableHead className="pl-8 font-black uppercase tracking-widest text-[10px] text-slate-400">Promotion Name</TableHead>
                      <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Type</TableHead>
                      <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Validity</TableHead>
                      <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">Status</TableHead>
                      <TableHead className="pr-8 text-right font-black uppercase tracking-widest text-[10px] text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((promo) => (
                      <TableRow key={promo.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-900/50 border-slate-100 dark:border-slate-900 transition-colors">
                        <TableCell className="pl-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 dark:text-white capitalize leading-none tracking-tight">
                              {promo.name}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground mt-1.5 line-clamp-1 opacity-60">
                              {promo.description || "No description provided."}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-lg px-2 py-0 h-6 text-[10px] font-black uppercase tracking-widest flex w-fit gap-1.5 items-center border-none shadow-sm ${
                            promo.type === 'Bundle' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                            promo.type === 'BOGO' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${
                                promo.type === 'Bundle' ? 'bg-purple-500' :
                                promo.type === 'BOGO' ? 'bg-amber-500' :
                                'bg-blue-500'
                            }`} />
                            {promo.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                             <Calendar className="w-3.5 h-3.5 opacity-40" />
                             {promo.start_date ? `${promo.start_date} → ${promo.end_date || '∞'}` : 'Permanent'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button 
                            onClick={async () => {
                              try {
                                await togglePromotion(promo.id, promo.is_active ? 0 : 1);
                                void load();
                              } catch (e: any) {
                                toast({ title: "Toggle Failed", description: e.message, variant: "destructive" });
                              }
                            }}
                            className="transition-transform active:scale-90"
                          >
                            {Number(promo.is_active) === 1 ? (
                              <Badge className="bg-emerald-500 text-white border-none shadow-md shadow-emerald-500/20 px-3 h-6 text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-600">Active Now</Badge>
                            ) : (
                              <Badge variant="secondary" className="px-3 h-6 text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800">Paused</Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-slate-400 hover:text-primary rounded-xl"
                              onClick={() => handleEditClick(promo)}
                            >
                               <Settings2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-slate-400 hover:text-rose-500 rounded-xl"
                              onClick={() => handleDelete(promo.id)}
                            >
                               <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PromotionTemplateGallery 
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={handleTemplateSelect}
      />

      <PromotionFormModal 
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <SeasonalDiscountModal 
        open={seasonalOpen}
        onOpenChange={setSeasonalOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <BundleOfferModal 
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <BOGOModal 
        open={bogoOpen}
        onOpenChange={setBogoOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <ItemQtyRewardModal 
        open={qtyOpen}
        onOpenChange={setQtyOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <WebsiteOfferModal 
        open={websiteOpen}
        onOpenChange={setWebsiteOpen}
        promotionId={selectedId}
        onSuccess={load}
      />

      <BankOfferModal 
        open={bankOpen}
        onOpenChange={setBankOpen}
        promotionId={selectedId}
        onSuccess={load}
      />
    </DashboardLayout>
  );
}

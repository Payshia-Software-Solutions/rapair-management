"use client";

import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Gift, 
  Tag, 
  Zap, 
  Sparkles, 
  Globe, 
  ChevronRight,
  Package,
  CreditCard,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PromotionTemplate = 'bundle' | 'seasonal' | 'bogo' | 'qty' | 'website' | 'bank' | 'advanced';

interface PromotionTemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: PromotionTemplate) => void;
}

const TEMPLATES = [
  {
    id: 'seasonal',
    title: 'Seasonal Discount',
    description: 'Flat percentage or fixed discount across the whole store or specific periods.',
    icon: Tag,
    color: 'bg-emerald-500',
    group: 'Discounts'
  },
  {
    id: 'bundle',
    title: 'Bundle Offer',
    description: 'Sell a set of specific items together for a special fixed price.',
    icon: Package,
    color: 'bg-blue-500',
    group: 'Bundles'
  },
  {
    id: 'bogo',
    title: 'Buy X Get Y',
    description: 'Classic reward: Buy one product and get another free or discounted.',
    icon: Sparkles,
    color: 'bg-amber-500',
    group: 'BOGO'
  },
  {
    id: 'qty',
    title: 'Item Qty Reward',
    description: 'Buy a specific quantity (e.g. 10) and get 1 or more of the same item free.',
    icon: Zap,
    color: 'bg-purple-500',
    group: 'BOGO'
  },
  {
    id: 'website',
    title: 'Website Special',
    description: 'Promotions tailored for online customers and website-driven orders.',
    icon: Globe,
    color: 'bg-indigo-500',
    group: 'External'
  },
  {
    id: 'bank',
    title: 'Bank card Offer',
    description: 'Automatic discounts for specific bank cards (e.g. Sampath, HNB, Commercial).',
    icon: CreditCard,
    color: 'bg-indigo-600',
    group: 'External'
  }
];

export const PromotionTemplateGallery: React.FC<PromotionTemplateGalleryProps> = ({
  open,
  onOpenChange,
  onSelect
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-slate-50 dark:bg-slate-950">
        <div className="p-10 space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">What are you planning?</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Select a template to start building your promotion in seconds.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onSelect(tmpl.id as PromotionTemplate)}
                className="group relative flex items-center gap-5 p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-transparent hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500",
                  tmpl.color
                )}>
                  <tmpl.icon className="w-8 h-8" />
                </div>
                <div className="flex-1 space-y-1 pr-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{tmpl.group}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {tmpl.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                
                {/* Background Glow */}
                <div className={cn(
                  "absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity",
                  tmpl.color
                )} />
              </button>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-center">
             <button 
                onClick={() => onSelect('advanced')}
                className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group"
             >
                <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                Or build from scratch using Advanced Mode
             </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

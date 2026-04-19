"use client";

import React, { useEffect, useState } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  X, 
  Check, 
  Plus, 
  Package, 
  Loader2 
} from "lucide-react";
import { fetchParts, type PartRow } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiItemSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}

export const MultiItemSelector: React.FC<MultiItemSelectorProps> = ({
  selectedIds,
  onChange,
  placeholder = "Select Items..."
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      void searchItems("");
    }
  }, [open]);

  const searchItems = async (q: string) => {
    setLoading(true);
    try {
      const data = await fetchParts(q);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: number | string) => {
    const numericId = Number(id);
    if (selectedIds.map(Number).includes(numericId)) {
      onChange(selectedIds.map(Number).filter(i => i !== numericId));
    } else {
      onChange([...selectedIds.map(Number), numericId]);
    }
  };

  const selectedItems = items.filter(i => selectedIds.includes(i.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedIds.map(id => {
          const item = items.find(i => i.id === id);
          return (
            <Badge key={id} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-primary/10 text-primary border-primary/20 flex items-center gap-2">
              <span className="text-[10px] font-black">{item ? item.part_name : `#${id}`}</span>
              <button 
                onClick={() => toggleItem(id)}
                className="p-0.5 hover:bg-primary/20 rounded-md transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
        {selectedIds.length === 0 && (
           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50 pl-1">No specific items selected</span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-2 justify-start text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary transition-all">
            <Plus className="w-4 h-4 mr-2" /> {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
            className="p-0 w-[400px] border-none shadow-2xl rounded-2xl overflow-hidden bg-white dark:bg-slate-950 z-[9999]" 
            align="start"
            style={{ pointerEvents: 'auto' }}
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search inventory..."
                className="pl-10 h-10 rounded-lg border-muted bg-slate-50 dark:bg-slate-900 border-none font-bold"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    void searchItems(e.target.value);
                }}
              />
            </div>
          </div>
          <ScrollArea className="h-[300px]">
            {loading ? (
                <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" />
                </div>
            ) : items.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                    <Package className="w-8 h-8 text-slate-200 mx-auto" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching items found</p>
                </div>
            ) : (
                <div className="p-2 grid grid-cols-1 gap-1">
                    {items.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleItem(item.id);
                            }}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-xl transition-all text-left",
                                selectedIds.map(Number).includes(Number(item.id)) 
                                    ? "bg-primary/5 border border-primary/20 shadow-sm" 
                                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                            )}
                        >
                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-xs font-black tracking-tight",
                                    selectedIds.includes(item.id) ? "text-primary" : "text-slate-900 dark:text-white"
                                )}>
                                    {item.part_name}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground opacity-60">
                                    {item.sku} • LKR {item.price}
                                </span>
                            </div>
                            {selectedIds.includes(item.id) && (
                                <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};

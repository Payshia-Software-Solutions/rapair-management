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
  ChevronDown, 
  Package, 
  Loader2 
} from "lucide-react";
import { fetchParts, fetchPart, type PartRow } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PromotionItemSelectorProps {
  selectedId: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  className?: string;
}

export const PromotionItemSelector: React.FC<PromotionItemSelectorProps> = ({
  selectedId,
  onChange,
  placeholder = "Select an item...",
  className
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PartRow | null>(null);

  useEffect(() => {
    if (open) {
      void searchItems("");
    }
  }, [open]);

  // Sync selected item details if ID changes (e.g. on load)
  useEffect(() => {
    if (selectedId) {
        const foundLocal = items.find(i => Number(i.id) === Number(selectedId));
        if (foundLocal) {
            setSelectedItem(foundLocal);
        } else if (!selectedItem || Number(selectedItem.id) !== Number(selectedId)) {
            // Need to fetch individual part details
            void (async () => {
                setLoading(true);
                try {
                    const data = await fetchPart(String(selectedId));
                    if (data) setSelectedItem(data);
                } catch (e) {
                    console.error("Hydration error:", e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    } else {
        setSelectedItem(null);
    }
  }, [selectedId]);

  useEffect(() => {
      if (selectedId && items.length > 0 && !selectedItem) {
          const found = items.find(i => Number(i.id) === Number(selectedId));
          if (found) setSelectedItem(found);
      }
  }, [items, selectedId, selectedItem]);

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

  const handleSelect = (item: PartRow) => {
    setSelectedItem(item);
    onChange(Number(item.id));
    setOpen(false);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(null);
    onChange(null);
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-2 justify-between px-4 text-xs font-bold transition-all hover:border-primary group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
                <Package className={cn("w-4 h-4 shrink-0", selectedItem ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("truncate", !selectedItem && "text-muted-foreground uppercase tracking-widest text-[10px] font-black")}>
                    {selectedItem ? `${selectedItem.part_name} (${selectedItem.sku})` : placeholder}
                </span>
            </div>
            <div className="flex items-center gap-2">
                {selectedItem && (
                    <button 
                        onClick={clearSelection}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-muted-foreground hover:text-red-500 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
                <ChevronDown className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
            </div>
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
                                handleSelect(item);
                            }}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-xl transition-all text-left",
                                Number(selectedId) === Number(item.id) 
                                    ? "bg-primary/5 border border-primary/20 shadow-sm" 
                                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                            )}
                        >
                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-xs font-black tracking-tight",
                                    Number(selectedId) === Number(item.id) ? "text-primary" : "text-slate-900 dark:text-white"
                                )}>
                                    {item.part_name}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground opacity-60">
                                    {item.sku} • LKR {item.price}
                                </span>
                            </div>
                            {Number(selectedId) === Number(item.id) && (
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

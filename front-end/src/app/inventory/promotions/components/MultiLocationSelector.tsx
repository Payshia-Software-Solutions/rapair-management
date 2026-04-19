"use client";

import React, { useEffect, useState } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, 
  Check, 
  Plus, 
  MapPin, 
  Loader2 
} from "lucide-react";
import { fetchLocations } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiLocationSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}

export const MultiLocationSelector: React.FC<MultiLocationSelectorProps> = ({
  selectedIds,
  onChange,
  placeholder = "Add Locations..."
}) => {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && locations.length === 0) {
      void loadLocations();
    }
  }, [open]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await fetchLocations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLocation = (id: number) => {
    const numericId = Number(id);
    const current = selectedIds.map(Number);
    if (current.includes(numericId)) {
      onChange(current.filter(i => i !== numericId));
    } else {
      onChange([...current, numericId]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[40px] items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground mr-1 opacity-50" />
        {selectedIds.length === 0 ? (
           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Available at All Locations</span>
        ) : (
          selectedIds.map(id => {
            const loc = locations.find(l => Number(l.id) === Number(id));
            return (
              <Badge key={id} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 border-indigo-500/20 flex items-center gap-2">
                <span className="text-[10px] font-black">{loc ? loc.name : `Outlet #${id}`}</span>
                <button 
                  onClick={() => toggleLocation(id)}
                  className="p-0.5 hover:bg-indigo-500/20 rounded-md transition-colors text-indigo-400 hover:text-indigo-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-2 justify-start text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-indigo-600 hover:border-indigo-600 transition-all bg-white dark:bg-transparent">
            <Plus className="w-4 h-4 mr-2" /> {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
            className="p-0 w-[300px] border-none shadow-2xl rounded-2xl overflow-hidden bg-white dark:bg-slate-950 z-[9999]" 
            align="start"
            onPointerDown={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Applicable Outlets</h4>
          </div>
          <ScrollArea className="h-[250px]">
            {loading ? (
                <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" />
                </div>
            ) : locations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                    <MapPin className="w-8 h-8 text-slate-200 mx-auto" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No locations found</p>
                </div>
            ) : (
                <div className="p-2 grid grid-cols-1 gap-1">
                    {locations.map(loc => (
                        <button
                            key={loc.id}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleLocation(Number(loc.id));
                            }}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-xl transition-all text-left w-full",
                                selectedIds.map(Number).includes(Number(loc.id)) 
                                    ? "bg-indigo-500/5 border border-indigo-500/20 shadow-sm" 
                                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                            )}
                        >
                            <span className={cn(
                                "text-xs font-black tracking-tight",
                                selectedIds.map(Number).includes(Number(loc.id)) ? "text-indigo-600" : "text-slate-900 dark:text-white"
                            )}>
                                {loc.name}
                            </span>
                            {selectedIds.map(Number).includes(Number(loc.id)) && (
                                <div className="w-5 h-5 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                    <Check className="w-3 h-3 text-white" />
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

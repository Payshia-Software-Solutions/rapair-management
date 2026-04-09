"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled,
  className,
  triggerClassName,
  contentClassName,
  emptyText = "No results",
}: {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = React.useMemo(() => {
    const v = (value ?? "").toString();
    return options.find((o) => o.value === v) ?? null;
  }, [options, value]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={(v) => (disabled ? setOpen(false) : setOpen(v))}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected ? "text-muted-foreground" : "",
              triggerClassName
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-70 shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={6} className={cn("p-0 w-[--radix-popover-trigger-width]", contentClassName)}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 h-9"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="max-h-[280px]">
            <div className="p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">{emptyText}</div>
              ) : (
                filtered.map((o) => {
                  const isSelected = (value ?? "") === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={cn(
                        "w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors",
                        isSelected ? "bg-muted" : ""
                      )}
                      onClick={() => {
                        onValueChange(o.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-transparent")}>
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}


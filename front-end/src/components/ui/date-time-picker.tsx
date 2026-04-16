"use client";

import * as React from "react";
import { format, isValid, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  value?: string; // Expects YYYY-MM-DDTHH:mm or ISO
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Internal date state derived from value prop
  const date = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleSelectDate = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    const newDate = date ? new Date(date) : new Date();
    
    // Transfer date parts but keep existing time
    newDate.setFullYear(selectedDate.getFullYear());
    newDate.setMonth(selectedDate.getMonth());
    newDate.setDate(selectedDate.getDate());
    
    onChange?.(format(newDate, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', val: string | number) => {
    const newDate = date ? new Date(date) : new Date();
    
    if (type === 'hour') {
      const isPM = newDate.getHours() >= 12;
      let h = Number(val);
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      newDate.setHours(h);
    } else if (type === 'minute') {
      newDate.setMinutes(Number(val));
    } else if (type === 'ampm') {
      const currentH = newDate.getHours();
      if (val === 'PM' && currentH < 12) newDate.setHours(currentH + 12);
      else if (val === 'AM' && currentH >= 12) newDate.setHours(currentH - 12);
    }

    onChange?.(format(newDate, "yyyy-MM-dd'T'HH:mm"));
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const ampm = ["AM", "PM"];

  const displayHour = date ? (date.getHours() % 12 || 12) : 12;
  const displayMinute = date ? date.getMinutes() : 0;
  const displayAmpm = date ? (date.getHours() >= 12 ? "PM" : "AM") : "AM";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3 py-2 bg-background border-[#2a2a2a] hover:bg-accent/50",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          {date ? format(date, "PPP p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-[#2a2a2a] shadow-2xl overflow-hidden" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="p-3 border-b sm:border-b-0 sm:border-r border-[#2a2a2a]">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelectDate}
              initialFocus
            />
          </div>
          
          <div className="flex flex-col w-full sm:w-[180px] bg-muted/20">
            <div className="p-3 border-b border-[#2a2a2a] bg-muted/30">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                <Clock className="w-3 h-3" />
                Select Time
              </div>
            </div>
            
            <div className="flex h-[280px] divide-x border-[#2a2a2a] divide-[#2a2a2a]">
              {/* Hours */}
              <ScrollArea className="flex-1">
                <div className="flex flex-col p-1.5">
                  {hours.map((h) => (
                    <Button
                      key={h}
                      variant={displayHour === h ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs font-medium px-0"
                      onClick={() => handleTimeChange('hour', h)}
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {/* Minutes */}
              <ScrollArea className="flex-1">
                <div className="flex flex-col p-1.5">
                  {minutes.map((m) => (
                    <Button
                      key={m}
                      variant={Math.floor(displayMinute / 5) * 5 === m ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs font-medium px-0"
                      onClick={() => handleTimeChange('minute', m)}
                    >
                      {m.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {/* AM/PM */}
              <div className="flex flex-col p-1.5 gap-1.5 w-[50px]">
                {ampm.map((a) => (
                  <Button
                    key={a}
                    variant={displayAmpm === a ? "default" : "ghost"}
                    size="sm"
                    className="h-10 text-[10px] font-bold px-0"
                    onClick={() => handleTimeChange('ampm', a)}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

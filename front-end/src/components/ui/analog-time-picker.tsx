"use client";

import * as React from "react";
import { Clock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AnalogTimePickerProps {
  value?: string; // HH:mm (24h)
  onChange?: (time: string) => void;
  className?: string;
}

export function AnalogTimePicker({
  value,
  onChange,
  className,
}: AnalogTimePickerProps) {
  const [view, setView] = React.useState<"hours" | "minutes">("hours");
  const [hour, setHour] = React.useState(12);
  const [minute, setMinute] = React.useState(0);
  const [ampm, setAmpm] = React.useState<"AM" | "PM">("AM");

  // Sync internal state with value prop
  React.useEffect(() => {
    if (value) {
      const [h24, m] = value.split(":").map(Number);
      const ampmVal = h24 >= 12 ? "PM" : "AM";
      const h12 = h24 % 12 || 12;
      setHour(h12);
      setMinute(m || 0);
      setAmpm(ampmVal);
    }
  }, [value]);

  const handleTimeChange = (h: number, m: number, a: "AM" | "PM") => {
    let h24 = h;
    if (a === "PM" && h < 12) h24 += 12;
    if (a === "AM" && h === 12) h24 = 0;
    const formatted = `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    onChange?.(formatted);
  };

  const onNumberClick = (val: number) => {
    if (view === "hours") {
      setHour(val);
      handleTimeChange(val, minute, ampm);
      setTimeout(() => setView("minutes"), 300);
    } else {
      setMinute(val);
      handleTimeChange(hour, val, ampm);
    }
  };

  const toggleAmpm = (a: "AM" | "PM") => {
    setAmpm(a);
    handleTimeChange(hour, minute, a);
  };

  const getAngle = (val: number, isHour: boolean) => {
    if (isHour) return (val % 12) * 30;
    return (val % 60) * 6;
  };

  const currentAngle = getAngle(view === "hours" ? hour : minute, view === "hours");

  return (
    <div className={cn("flex flex-col items-center p-4 bg-background rounded-xl border border-border shadow-xl w-[280px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-6">
        <div className="flex items-center gap-1 text-primary font-bold">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Analog Clock</span>
        </div>
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => toggleAmpm("AM")}
            className={cn("px-2 py-1 text-[10px] font-bold rounded-md transition-all", ampm === "AM" ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
          >
            AM
          </button>
          <button
            onClick={() => toggleAmpm("PM")}
            className={cn("px-2 py-1 text-[10px] font-bold rounded-md transition-all", ampm === "PM" ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
          >
            PM
          </button>
        </div>
      </div>

      {/* Time Display */}
      <div className="flex items-end gap-1 mb-6">
        <button 
          onClick={() => setView("hours")}
          className={cn("text-4xl font-mono leading-none transition-colors", view === "hours" ? "text-primary" : "text-muted-foreground")}
        >
          {hour.toString().padStart(2, "0")}
        </button>
        <span className="text-3xl text-muted-foreground font-mono leading-none mb-1">:</span>
        <button 
          onClick={() => setView("minutes")}
          className={cn("text-4xl font-mono leading-none transition-colors", view === "minutes" ? "text-primary" : "text-muted-foreground")}
        >
          {minute.toString().padStart(2, "0")}
        </button>
      </div>

      {/* Clock Face */}
      <div className="relative w-48 h-48 rounded-full bg-muted/30 flex items-center justify-center border-4 border-muted">
        {/* Hand */}
        <div 
          className="absolute bottom-1/2 left-1/2 w-1 h-20 bg-primary/40 origin-bottom rounded-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-50%) rotate(${currentAngle}deg)` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-lg" />
        </div>
        
        {/* Center pivot */}
        <div className="absolute w-3 h-3 bg-primary rounded-full z-10 shadow-md" />

        {/* Numbers */}
        {view === "hours" ? (
          [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((val, i) => {
            const angle = i * 30;
            const rad = (angle - 90) * (Math.PI / 180);
            const x = Math.cos(rad) * 75;
            const y = Math.sin(rad) * 75;
            return (
              <button
                key={val}
                onClick={() => onNumberClick(val)}
                className={cn(
                  "absolute w-8 h-8 rounded-full text-sm font-bold transition-all hover:bg-primary/20",
                  hour === val ? "text-primary scale-125" : "text-muted-foreground"
                )}
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {val}
              </button>
            );
          })
        ) : (
          [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((val, i) => {
            const angle = i * 30;
            const rad = (angle - 90) * (Math.PI / 180);
            const x = Math.cos(rad) * 75;
            const y = Math.sin(rad) * 75;
            return (
              <button
                key={val}
                onClick={() => onNumberClick(val)}
                className={cn(
                  "absolute w-8 h-8 rounded-full text-xs font-bold transition-all hover:bg-primary/20",
                  minute === val ? "text-primary scale-125" : "text-muted-foreground"
                )}
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {val.toString().padStart(2, "0")}
              </button>
            );
          })
        )}
      </div>

      {view === "minutes" && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-6 text-xs gap-1 h-7 text-muted-foreground"
          onClick={() => setView("hours")}
        >
          <ChevronLeft className="w-3 h-3" />
          Back to hours
        </Button>
      )}
    </div>
  );
}

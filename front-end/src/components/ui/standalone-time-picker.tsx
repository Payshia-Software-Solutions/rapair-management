"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StandaloneTimePickerProps {
  value?: string; // Expects HH:mm (24h)
  onChange?: (time: string) => void;
  className?: string;
}

export function StandaloneTimePicker({
  value,
  onChange,
  className,
}: StandaloneTimePickerProps) {
  // Internal state for Hour, Minute, and AM/PM
  const [hour, setHour] = React.useState("12");
  const [minute, setMinute] = React.useState("00");
  const [ampm, setAmpm] = React.useState("AM");

  // Sync internal state with value prop
  React.useEffect(() => {
    if (value) {
      const [h24, m] = value.split(":");
      let hVal = parseInt(h24);
      const ampmVal = hVal >= 12 ? "PM" : "AM";
      const h12 = hVal % 12 || 12;
      
      setHour(h12.toString());
      setMinute(m || "00");
      setAmpm(ampmVal);
    }
  }, [value]);

  const updateTime = (newH: string, newM: string, newA: string) => {
    let h = parseInt(newH);
    if (newA === "PM" && h < 12) h += 12;
    if (newA === "AM" && h === 12) h = 0;
    
    const formattedH = h.toString().padStart(2, "0");
    const formattedM = newM.padStart(2, "0");
    onChange?.(`${formattedH}:${formattedM}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex-1">
        <Select value={hour} onValueChange={(val) => { setHour(val); updateTime(val, minute, ampm); }}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Hr" />
          </SelectTrigger>
          <SelectContent>
            {hours.map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        <Select value={minute} onValueChange={(val) => { setMinute(val); updateTime(hour, val, ampm); }}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {minutes.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[65px]">
        <Select value={ampm} onValueChange={(val) => { setAmpm(val); updateTime(hour, minute, val); }}>
          <SelectTrigger className="h-10 text-xs font-bold">
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Phone, MessageCircle, X, ChevronUp, Sparkles } from "lucide-react";

export default function WhatsAppWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Exclude widget in admin workspace or doc editor
  if (pathname.startsWith('/admin') || pathname.startsWith('/verify-email')) {
    return null;
  }

  const phoneDisplay = "0770 481 363";
  const phoneIntl = "+94770481363";
  const waUrl = `https://wa.me/94770481363?text=Hi%20BizzFlow%20Team%2C%20I%20would%20like%20to%20get%20more%20information%20about%20BizzFlow%20ERP%20and%20pricing.`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">
      
      {/* Expanded Quick Contact Card */}
      {isOpen && (
        <div className="w-80 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-3 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
                <MessageCircle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">BizzFlow Direct Sales</h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online & Ready to Help</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="py-3.5 space-y-2.5">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Have questions about modules, custom pricing, or need a live system demo? Connect directly with our team:
            </p>

            {/* WhatsApp Direct Button */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/20 group"
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle size={17} />
                <span>Chat on WhatsApp</span>
              </div>
              <span className="text-[10px] font-mono opacity-90 group-hover:translate-x-0.5 transition-transform">077 048 1363 →</span>
            </a>

            {/* Direct Phone Call Button */}
            <a
              href={`tel:${phoneIntl}`}
              className="flex items-center justify-between gap-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span>Direct Voice Call</span>
              </div>
              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{phoneDisplay}</span>
            </a>
          </div>

          {/* Footer Note */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center font-medium">
            Available Mon – Sat (8:30 AM – 7:00 PM)
          </div>

        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 group focus:outline-none ring-4 ring-emerald-500/20"
        aria-label="Contact Us on WhatsApp"
      >
        <div className="relative">
          <MessageCircle size={22} />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-200" />
          </span>
        </div>
        <span className="text-xs font-black tracking-wide hidden sm:inline-block">
          {isOpen ? "Close" : "Chat on WhatsApp"}
        </span>
      </button>

    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import { useDocs } from "@/app/docs/layout";
import DocsHeader from "@/components/docs/DocsHeader";
import Callout from "@/components/docs/Callout";
import CodeBlock from "@/components/docs/CodeBlock";
import DocsPagination from "@/components/docs/DocsPagination";
import { FileText, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function InvoicingPage() {
  const { setTocItems } = useDocs();

  useEffect(() => {
    setTocItems([
      { id: "overview", title: "Overview", level: 2 },
      { id: "lifecycle", title: "Invoice Lifecycle States", level: 2 },
      { id: "terms", title: "Payment Terms", level: 2 },
      { id: "apis", title: "REST APIs & Endpoints", level: 2 },
    ]);
  }, [setTocItems]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <DocsHeader
        title="Invoice Lifecycle"
        description="Specifications for invoice creation, terms validation, status changes, and automatic email logs."
        badge="Core Module"
        version="2.4.0"
      />

      {/* Overview */}
      <section id="overview" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Overview</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          The Invoicing Module handles invoicing flows for repair tickets and direct retail bills. Finalized invoices lock quantity data and sync directly to accounting records.
        </p>
      </section>

      {/* Invoice Lifecycle States */}
      <section id="lifecycle" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Invoice Lifecycle States</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          Invoices move through four main statuses during their lifecycle:
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-center">
            <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-md">
              DRAFT
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Editable draft bill</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-center">
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-md border border-amber-500/20">
              SENT / UNPAID
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Locked, sent to client</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-center">
            <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-md border border-blue-500/20">
              PARTIALLY PAID
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Initial deposit recorded</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-center">
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/20">
              PAID
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">Balance fully settled</p>
          </div>
        </div>
      </section>

      {/* Payment Terms */}
      <section id="terms" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Payment Terms</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          Invoices can be assigned payment terms (e.g. Net 15, Net 30). Late invoice notifications are triggered automatically by the system cron daemon based on due dates.
        </p>
        <Callout type="info" title="Automatic Reminders">
          System settings allow checking for unpaid invoices and queuing transactional reminder emails through the system mailer.
        </Callout>
      </section>

      {/* REST APIs & Endpoints */}
      <section id="apis" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">REST APIs & Endpoints</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          Create an invoice by POSTing line items, taxes, and client mappings:
        </p>
        <CodeBlock
          filename="POST /api/invoices/new"
          language="json"
          code={`{
  "client_id": 8941,
  "payment_terms": "net30",
  "items": [
    {
      "description": "Oil Filter Replacement",
      "quantity": 1,
      "unit_price": 18.00,
      "tax_rate": 8.0
    }
  ]
}`}
        />
      </section>

      <DocsPagination
        prev={{ title: "Employee & HRM", href: "/docs/modules/hrm" }}
        next={null}
      />
    </motion.div>
  );
}

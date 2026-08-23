"use client";

import React, { useEffect } from "react";
import { useDocs } from "@/app/docs/layout";
import DocsHeader from "@/components/docs/DocsHeader";
import Callout from "@/components/docs/Callout";
import CodeBlock from "@/components/docs/CodeBlock";
import DocsPagination from "@/components/docs/DocsPagination";
import { Layers, Cpu, Database, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function DocsLandingPage() {
  const { setTocItems } = useDocs();

  useEffect(() => {
    setTocItems([
      { id: "welcome", title: "Welcome to BizzFlow", level: 2 },
      { id: "architecture", title: "Platform Architecture", level: 2 },
      { id: "direct-sync", title: "Direct-Sync Core Engine", level: 2 },
      { id: "multi-tenant", title: "Multi-Tenant Topology", level: 2 },
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
        title="Introduction & Architecture"
        description="Learn about BizzFlow's high-frequency engine, real-time sync mechanism, and scalable enterprise architecture."
        badge="Platform Core"
        version="2.4.0"
      />

      {/* Welcome Section */}
      <section id="welcome" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Welcome to BizzFlow</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          BizzFlow is a cloud-native, high-frequency enterprise resource planning (ERP) system designed specifically for workshops, modern retail settings, and multi-location businesses. BizzFlow connects front-end cashiers, service bays, inventory systems, and back-office general ledgers.
        </p>
        <Callout type="info" title="System Capabilities">
          BizzFlow is optimized for sub-second database operations, supporting active POS queues, concurrent vehicle repairs, and instant inventory adjustments without double-booking or operational delays.
        </Callout>
      </section>

      {/* Architecture Overview */}
      <section id="architecture" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Platform Architecture</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          The ecosystem is built on a split architecture consisting of a lightweight PHP MVC Engine on the backend and a Next.js / Tailwind CSS SPA on the frontend.
        </p>
        <div className="grid md:grid-cols-3 gap-4 my-6">
          <div className="border border-slate-200 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40">
            <Cpu className="text-indigo-500 mb-3" size={24} />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Frontend Client</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Next.js with custom Tailwind CSS utility configurations and fluid UI transitions.</p>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40">
            <Layers className="text-emerald-500 mb-3" size={24} />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">REST API Engine</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Custom high-speed PHP router handling request validation, auth middleware, and model mapping.</p>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40">
            <Database className="text-cyan-500 mb-3" size={24} />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Database Layer</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">MySQL schema optimized with structural indexes, foreign keys, and atomic transaction locks.</p>
          </div>
        </div>
      </section>

      {/* Direct-Sync Core Engine */}
      <section id="direct-sync" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Direct-Sync Core Engine</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          Unlike traditional batch-processed ERP systems, BizzFlow features a Direct-Sync Engine. Every transaction (e.g. marking a POS receipt paid) triggers an instant cascade of events:
        </p>
        <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 text-sm space-y-2">
          <li>Adjusts batch inventory levels instantly under First-In-First-Out (FIFO) standards.</li>
          <li>Posts automated double-entry journal logs to the General Ledger.</li>
          <li>Updates invoice fulfillment logs, syncing billing data to client dashboards.</li>
        </ul>
      </section>

      {/* Multi-Tenant Topology */}
      <section id="multi-tenant" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Multi-Tenant Topology</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
          BizzFlow uses a single-database, tenant-isolated data structure. Each query filter applies tenant keys transparently via request interceptors.
        </p>
        <CodeBlock
          filename="tenant_middleware.php"
          language="php"
          code={`public function handle(Request $request, Closure $next) {
    $tenantId = $request->headers->get('X-Tenant-ID');
    if (!$tenantId) {
        return Response::json(['error' => 'Tenant identification missing'], 401);
    }
    TenantContext::setTenantId($tenantId);
    return $next($request);
}`}
        />
        <Callout type="warning" title="Data Integrity">
          Always ensure query filters include tenant context keys to preserve tenant data isolation across multi-tenant environments.
        </Callout>
      </section>

      <DocsPagination
        prev={null}
        next={{ title: "Installation & Setup", href: "/docs/getting-started" }}
      />
    </motion.div>
  );
}

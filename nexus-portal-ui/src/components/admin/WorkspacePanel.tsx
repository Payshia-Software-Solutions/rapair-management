"use client";

import React, { useState } from 'react';
import { Rocket, Loader2, ExternalLink, AlertTriangle, CheckCircle2, Server, Clock, HardDrive, ChevronDown, Copy, Check } from 'lucide-react';
import { errMsg } from '@/lib/adminApi';
import WebhookTable from './WebhookTable';
import ProvisionDialog from './ProvisionDialog';
import WorkspaceDatabase from './WorkspaceDatabase';
import WorkspaceSchema from './WorkspaceSchema';
import WorkspaceBackups from './WorkspaceBackups';
import SetupProgress from '../SetupProgress';

type Props = {
  tenantId: string | number;
  deployment?: string | null;
  provisionStatus?: string | null;
  provisionError?: string | null;
  workspaceUrl?: string | null;
  adminEmail?: string | null;
  tenantName?: string | null;
  onChanged?: () => void;
};

const STATUS = {
  ready:     { label: 'Live',              Icon: CheckCircle2,  chip: 'bg-nx-success-soft text-nx-success border-nx-success/30 dark:bg-nx-success-soft dark:border-nx-success/30' },
  pending:   { label: 'Setting up',        Icon: Clock,         chip: 'bg-nx-warning-soft text-nx-warning border-nx-warning/30 dark:bg-nx-warning-soft dark:border-nx-warning/30' },
  failed:    { label: 'Setup failed',      Icon: AlertTriangle, chip: 'bg-nx-danger-soft text-nx-danger border-nx-danger/30 dark:bg-nx-danger-soft dark:border-nx-danger/30' },
  dedicated: { label: 'Dedicated install', Icon: HardDrive,     chip: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
} as const;

const label = 'block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider';

/**
 * The tenant's workspace on the product's shared deployment.
 * Dedicated tenants (own server, as today) stay as they are until an admin creates a shared workspace.
 */
export default function WorkspacePanel({ tenantId, deployment, provisionStatus, provisionError, workspaceUrl, adminEmail, tenantName, onChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState(0);

  const raw = provisionStatus || 'none';
  const key: keyof typeof STATUS = raw === 'ready' || raw === 'pending' || raw === 'failed' ? raw : 'dedicated';
  const s = STATUS[key];
  const hasActivity = deployment === 'shared' || raw !== 'none';
  const canCreate = key === 'dedicated' || key === 'failed';

  // Creation runs in ProvisionDialog, which shows real progress. When it closes, refresh the tenant.
  const finished = () => {
    setDialogOpen(false);
    setRefresh(x => x + 1);
    onChanged?.();
  };

  const copyUrl = () => {
    if (!workspaceUrl) return;
    void navigator.clipboard.writeText(workspaceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section aria-labelledby="ws-title" className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nx-accent-soft text-nx-accent dark:text-nx-accent-light">
            <Server size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="ws-title" className="text-sm font-bold text-slate-900 dark:text-white">Workspace</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Where this tenant&apos;s ERP runs. Shared workspaces are created and updated automatically.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${s.chip}`}>
          <s.Icon size={13} aria-hidden="true" className={key === 'pending' ? 'animate-pulse' : ''} />
          {s.label}
        </span>
      </div>

      {/* Details */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <span className={label}>Address</span>
          {workspaceUrl ? (
            <div className="flex items-center gap-2 min-w-0">
              <a href={workspaceUrl} target="_blank" rel="noreferrer"
                className="min-w-0 font-mono text-[13px] font-semibold text-nx-accent hover:underline dark:text-nx-accent-light [overflow-wrap:anywhere]">
                {workspaceUrl.replace(/^https?:\/\//, '')}
              </a>
              <button type="button" onClick={copyUrl} aria-label="Copy workspace address"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{key === 'dedicated' ? 'Own server (set up manually)' : 'Not created yet'}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <span className={label}>Deployment</span>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{deployment === 'shared' ? 'Shared (automatic)' : 'Dedicated (manual)'}</p>
        </div>
        <div className="space-y-1.5">
          <span className={label}>Login sent to</span>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white [overflow-wrap:anywhere]">{adminEmail || '—'}</p>
        </div>
      </div>

      {deployment === 'shared' && key === 'ready' && <WorkspaceDatabase key={refresh} tenantId={tenantId} />}
      {deployment === 'shared' && key === 'ready' && <WorkspaceSchema tenantId={tenantId} onBackup={() => setBackups(x => x + 1)} />}
      {deployment === 'shared' && key === 'ready' && <WorkspaceBackups tenantId={tenantId} refreshKey={backups} />}

      {/* State message */}
      {key === 'pending' && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <SetupProgress endpoint={`/admin/tenants/setup-progress?id=${tenantId}`} detail onFinished={finished} />
        </div>
      )}
      {(key === 'failed' || error) && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-nx-danger/30 bg-nx-danger-soft px-4 py-3 text-xs text-nx-danger">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="[overflow-wrap:anywhere]">{error || provisionError || 'Setup failed. See Activity below, fix the cause and try again.'}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        {workspaceUrl && key === 'ready' && (
          <a href={workspaceUrl} target="_blank" rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-nx-accent-strong hover:bg-nx-accent-strong px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition-colors">
            <ExternalLink size={15} aria-hidden="true" /> Open workspace
          </a>
        )}
        {canCreate && (
          <button type="button" onClick={() => setDialogOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-nx-accent-strong hover:bg-nx-accent-strong px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
            <Rocket size={15} aria-hidden="true" />
            {key === 'failed' ? 'Try again' : 'Create workspace'}
          </button>
        )}
        {key === 'dedicated' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Creates a new, empty workspace and emails the login to the admin email.</p>
        )}
      </div>

      {/* Activity (secondary detail, folded) */}
      {hasActivity && (
        <details className="group rounded-xl border border-slate-200/80 dark:border-slate-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
            Activity
            <ChevronDown size={15} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 dark:border-slate-800">
            <WebhookTable tenantId={tenantId} showTenant={false} refreshKey={refresh} />
          </div>
        </details>
      )}

      <ProvisionDialog
        open={dialogOpen}
        tenantId={tenantId}
        tenantName={tenantName || 'Tenant'}
        adminEmail={adminEmail}
        onClose={() => setDialogOpen(false)}
        onFinished={finished}
      />
    </section>
  );
}

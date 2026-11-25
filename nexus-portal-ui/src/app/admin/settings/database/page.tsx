"use client";

import WorkspaceSchema from '@/components/admin/WorkspaceSchema';

/** Brings the Nexus database up to the schema the deployed code expects (app/Database/schema.json). */
export default function NexusDatabasePage() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Nexus Database</h1>
        <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">
          After a deploy, add any tables and columns the new code needs. A full backup is taken first; nothing is dropped or changed.
        </p>
      </div>
      <div className="max-w-3xl rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <WorkspaceSchema nexus />
      </div>
    </div>
  );
}

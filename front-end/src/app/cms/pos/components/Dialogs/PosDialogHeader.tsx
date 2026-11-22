"use client";

import React from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The one header every POS dialog uses (same as the ERP / Day summary):
 * title + short description on the left, optional actions on the right,
 * divider below. No coloured banners: colour is kept for state (errors,
 * amounts), not for decorating headers.
 */
export function PosDialogHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <DialogHeader className="px-5 pt-5 pb-3 pr-12 border-b border-border text-left flex-row items-start justify-between gap-3 space-y-0 shrink-0">
      <div className="min-w-0">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </DialogHeader>
  );
}

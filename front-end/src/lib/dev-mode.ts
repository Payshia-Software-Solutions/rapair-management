"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Developer mode for this workspace, switched per tenant in the Nexus portal.
 * Asked once per page load (the server caches it for 60 seconds), so a switch in Nexus
 * shows on the next navigation or refresh. Always false for non-admins.
 */
let pending: Promise<boolean> | null = null;

function fetchDevMode(): Promise<boolean> {
  if (!pending) {
    pending = api("/api/saas/dev_mode")
      .then(async (res) => (res.ok ? Boolean((await res.json())?.data?.dev_mode) : false))
      .catch(() => false)
      .finally(() => { setTimeout(() => { pending = null; }, 30_000); });
  }
  return pending;
}

export function useDevMode(enabled = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) { setOn(false); return; }
    let alive = true;
    fetchDevMode().then((v) => { if (alive) setOn(v); });
    return () => { alive = false; };
  }, [enabled]);
  return on;
}

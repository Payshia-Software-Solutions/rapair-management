import { api } from "@/lib/api/client";
import { TENANT_MODE_SHARED } from "@/lib/tenant";
import {
  DEFAULT_DASHBOARD,
  HOME_DASHBOARD_SETTING,
  dashboardByKey,
  loadSaasModules,
  moduleAllowed,
} from "@/lib/dashboards";

/**
 * Where a user lands after signing in.
 * 1. Order-taking roles (POS access without "pos.checkout", e.g. stewards on tablets) go
 *    straight to the POS.
 * 2. Everyone else opens the company's chosen home dashboard (Company Profile setting),
 *    as long as the company has that module and the user may open it.
 * 3. Otherwise the business overview.
 */
export async function homeRouteForUser(): Promise<string> {
  const fallback = dashboardByKey(DEFAULT_DASHBOARD)!.href;
  try {
    const [permRes, settingsRes, modules] = await Promise.all([
      api("/api/auth/permissions").then((r) => r.json()).catch(() => null),
      api("/api/settings/system").then((r) => r.json()).catch(() => null),
      loadSaasModules(),
    ]);
    const perms: string[] = permRes?.status === "success" && Array.isArray(permRes.data) ? permRes.data : [];
    const isAll = perms.includes("*");

    const usesPos = perms.includes("pos.write") || perms.includes("pos.read");
    if (!isAll && usesPos && !perms.includes("pos.checkout")) return "/cms/pos";

    // New workspace on the shared deployment: the admin finishes the basics first (Setup wizard).
    // Single-client installs are never redirected.
    if (isAll && TENANT_MODE_SHARED) {
      const st = await api("/api/setup/status").then((r) => r.json()).catch(() => null);
      if (st?.status === "success" && !st.data?.completed) return "/onboarding";
    }

    const chosen = dashboardByKey(settingsRes?.data?.[HOME_DASHBOARD_SETTING]);
    if (chosen && moduleAllowed(modules, chosen.module) && (!chosen.perm || isAll || perms.includes(chosen.perm))) {
      return chosen.href;
    }
  } catch {}
  return fallback;
}

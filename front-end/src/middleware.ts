import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared mode: refuse to serve the app on a domain that is not a real workspace.
 * Asks the API (/api/workspace/info with X-Tenant-Host) whether the domain belongs to an active
 * workspace. If not, the visitor sees /workspace-unavailable instead of the login page.
 * The answer is cached per domain for a short time, so this is one API call per domain per minute.
 * Single-client installs (NEXT_PUBLIC_TENANT_MODE unset) skip all of this.
 */

const SHARED = process.env.NEXT_PUBLIC_TENANT_MODE === "shared";
const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const OK_TTL = 60_000; // known workspace: recheck after 1 minute
const BAD_TTL = 15_000; // unknown/paused: recheck sooner, so a new workspace works quickly

type Info = { code: string; workspace?: string; since?: string };
type Verdict = { code: Info | null; until: number };
const cache = new Map<string, Verdict>();

async function check(host: string): Promise<Info | null> {
  const hit = cache.get(host);
  if (hit && hit.until > Date.now()) return hit.code;

  let code: Info | null = null;
  let ttl = OK_TTL;
  try {
    const res = await fetch(`${API}/api/workspace/info`, {
      // Browser-like User-Agent: cPanel firewalls (ModSecurity) answer 406 to bare server requests
      headers: {
        "X-Tenant-Host": host,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BizzFlowWeb/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      code = {
        code: (body && body.code) || `http_${res.status}`,
        workspace: typeof body?.workspace === "string" ? body.workspace.slice(0, 120) : undefined,
        since: typeof body?.since === "string" ? body.since.slice(0, 10) : undefined,
      };
      ttl = BAD_TTL;
    }
  } catch {
    // API down or slow: don't lock everyone out, let the page load and show its own errors
    return null;
  }
  // Only a definite "no" blocks the page; temporary API trouble does not
  if (code?.code === "registry_unavailable") return null;
  cache.set(host, { code, until: Date.now() + ttl });
  if (cache.size > 5000) cache.clear();
  return code;
}

export async function middleware(req: NextRequest) {
  if (!SHARED || !API) return NextResponse.next();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0].trim().split(":")[0].toLowerCase();
  // Local development and direct IP access are not workspaces
  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".sslip.io")) {
    return NextResponse.next();
  }

  const code = await check(host);
  if (!code) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/workspace-unavailable";
  const q = new URLSearchParams({ code: code.code });
  if (code.workspace) q.set("w", code.workspace);
  if (code.since) q.set("since", code.since);
  url.search = `?${q}`;
  return NextResponse.rewrite(url, { status: code.code === "workspace_not_found" ? 404 : 503 });
}

export const config = {
  // Pages only: skip Next assets, files with an extension and the unavailable page itself
  matcher: ["/((?!_next/|api/|workspace-unavailable|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};

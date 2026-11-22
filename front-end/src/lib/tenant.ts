/**
 * Shared (multi-tenant) deployment support.
 *
 * NEXT_PUBLIC_TENANT_MODE=shared  -> one web app serves every workspace. The workspace is the
 * domain the app is open on (teajar.bizzflow.nebulync.com or a custom domain like erp.client.lk).
 * Every request to the API carries that domain in the X-Tenant-Host header; the server maps it
 * to the workspace's database. The header is added by a tiny script in the root layout that wraps
 * window.fetch before any app code runs, so every call (api(), raw fetch) is covered.
 *
 * Unset (single-client installs): nothing here does anything.
 */

export const TENANT_MODE_SHARED = process.env.NEXT_PUBLIC_TENANT_MODE === "shared";
/** Workspaces get <slug>.<base domain> */
export const TENANT_BASE_DOMAIN = (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN || "").toLowerCase();

const SLUG_KEY = "bf_tenant_slug";

/** Domain the app is open on, when running shared; null otherwise. */
export function tenantHost(): string | null {
  if (!TENANT_MODE_SHARED || typeof window === "undefined") return null;
  return window.location.hostname.toLowerCase();
}

export function tenantHeaders(): Record<string, string> {
  const h = tenantHost();
  return h ? { "X-Tenant-Host": h } : {};
}

/**
 * Workspace slug: from the subdomain when on the base domain, otherwise (custom domain) the value
 * the server returned from /api/workspace/info, cached in this browser.
 */
export function tenantSlug(): string | null {
  const host = tenantHost();
  if (!host) return null;
  if (TENANT_BASE_DOMAIN && host.endsWith("." + TENANT_BASE_DOMAIN)) {
    const sub = host.slice(0, -(TENANT_BASE_DOMAIN.length + 1));
    if (sub && !sub.includes(".")) return sub;
  }
  try {
    return window.localStorage.getItem(SLUG_KEY);
  } catch {
    return null;
  }
}

/**
 * Inline <head> script for shared mode: wraps fetch so requests to the API carry X-Tenant-Host,
 * and (custom domains) caches the workspace slug. Plain JS string: it runs before React loads.
 */
export function tenantBootScript(apiBase: string): string {
  const base = JSON.stringify(apiBase.replace(/\/+$/, ""));
  const slugKey = JSON.stringify(SLUG_KEY);
  return `(function(){try{
var API=${base},H=location.hostname.toLowerCase(),F=window.fetch;
if(!F||F.__bfTenant)return;
var AB=API?new URL(API,location.href).href:location.origin+"/";
function isApi(u){try{var s=typeof u==="string"?u:(u&&u.url)||String(u);return new URL(s,location.href).href.indexOf(AB)===0;}catch(e){return false;}}
var W=function(input,init){
  if(isApi(input)){
    init=init||{};
    var h=new Headers(init.headers||(input&&input.headers)||{});
    if(!h.has("X-Tenant-Host"))h.set("X-Tenant-Host",H);
    init.headers=h;
  }
  return F.call(this,input,init);
};
W.__bfTenant=true;window.fetch=W;
fetch(API+"/api/workspace/info").then(function(r){return r.json()}).then(function(d){
  if(d&&d.data&&d.data.slug)try{localStorage.setItem(${slugKey},d.data.slug)}catch(e){}
}).catch(function(){});
}catch(e){}})();`;
}

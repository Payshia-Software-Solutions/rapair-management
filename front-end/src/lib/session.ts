/**
 * User session storage in one place.
 *
 * Everything that belongs to the signed-in USER (token, permissions, role, location,
 * POS lock) is cleared on login and on logout, so the next person on the same PC
 * never inherits the previous user's privileges.
 *
 * Device preferences (theme, POS layout, favourites, printer choices) are kept.
 */
const USER_KEYS = [
  "auth_token",
  "location_id",
  "location_name",
  "perms_cache",
  "perms_cache_time",
  "perms_cache_user",
  "userRole",
  "saas_config_cache",
  "saas_config_cache_time",
  "stock_adj_location_id",
  "pos_locked",
];

export function clearUserSession() {
  try {
    for (const k of USER_KEYS) window.localStorage.removeItem(k);
    window.sessionStorage.clear();
  } catch {}
}

/** Start a fresh session for a newly signed-in user. */
export function startUserSession(token: string) {
  clearUserSession();
  try { window.localStorage.setItem("auth_token", token); } catch {}
}

/** Sign out and go to the login page. */
export function signOut(redirect = "/login") {
  clearUserSession();
  window.location.href = redirect;
}

/** User id (JWT "sub") of the current token, or "" when signed out. */
export function currentUserId(): string {
  try {
    const part = window.localStorage.getItem("auth_token")?.split(".")[1];
    if (!part) return "";
    const p = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return String(p.sub ?? "");
  } catch {
    return "";
  }
}

/** Cached permissions, only if they were cached for THIS user. */
export function readPermsCache(maxAgeMs = 86_400_000): string[] | null {
  try {
    const uid = currentUserId();
    if (!uid || window.localStorage.getItem("perms_cache_user") !== uid) return null;
    const time = Number(window.localStorage.getItem("perms_cache_time") || 0);
    if (!time || Date.now() - time > maxAgeMs) return null;
    const parsed = JSON.parse(window.localStorage.getItem("perms_cache") || "null");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePermsCache(perms: string[]) {
  try {
    window.localStorage.setItem("perms_cache", JSON.stringify(perms));
    window.localStorage.setItem("perms_cache_time", String(Date.now()));
    window.localStorage.setItem("perms_cache_user", currentUserId());
  } catch {}
}

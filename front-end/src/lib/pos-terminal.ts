/**
 * POS terminal (cash drawer) of this PC, remembered per location in localStorage.
 * api() sends it as X-Terminal-Id; the server then runs the terminal's shift and stamps the
 * sales, refunds and vouchers made here with it.
 */
const key = (locationId?: string | number | null) => {
  const loc = locationId ?? (typeof window !== "undefined" ? window.localStorage.getItem("location_id") : null);
  return loc ? `pos_terminal:${loc}` : null;
};

export function getTerminalId(locationId?: string | number | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const k = key(locationId);
    return k ? window.localStorage.getItem(k) : null;
  } catch {
    return null;
  }
}

export function setTerminalId(id: string | number | null, locationId?: string | number | null) {
  if (typeof window === "undefined") return;
  try {
    const k = key(locationId);
    if (!k) return;
    if (id == null || id === "") window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, String(id));
  } catch { /* storage blocked */ }
}

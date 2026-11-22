/**
 * App-wide colour theme: Light, Dark (navy) or Dim (neutral charcoal).
 * Saved per device in localStorage.theme. "Dim" also sets the .dark class,
 * so every dark: style applies and only the colour tokens differ.
 */
export type AppTheme = "light" | "dark" | "dim";
export const THEMES: Array<{ value: AppTheme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "dim", label: "Dim" },
];

export const THEME_EVENT = "bizzflow-theme-change";

export function getTheme(): AppTheme {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;
  if (root.classList.contains("theme-dim")) return "dim";
  return root.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme !== "light");
  root.classList.toggle("theme-dim", theme === "dim");
  try { window.localStorage.setItem("theme", theme); } catch {}
  // keep every theme control on the page in sync
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

/** Light → Dark → Dim → Light (for single-button toggles). */
export function nextTheme(t: AppTheme): AppTheme {
  return t === "light" ? "dark" : t === "dark" ? "dim" : "light";
}

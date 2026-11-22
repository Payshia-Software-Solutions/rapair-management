/**
 * One chart look for every dashboard. Colours come from CSS tokens in globals.css,
 * so light / dark / dim themes all work without per-chart overrides.
 *
 * Series order is fixed: slot 1 is always the first series, slot 2 the second, and so on.
 * The palette was validated for colour-blind separation on the app's card surfaces.
 * In light mode slots 3-5 sit below 3:1 contrast, so multi-series charts always ship a
 * legend with values next to the swatch (never colour alone).
 */
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

export const gridStroke = "hsl(var(--border))";
export const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 11 } as const;

export const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
  fontSize: 12,
} as const;

export const tooltipLabelStyle = { color: "hsl(var(--muted-foreground))", marginBottom: 4 } as const;
export const tooltipItemStyle = { color: "hsl(var(--popover-foreground))" } as const;

export const lkr = (n: number, digits = 0) =>
  `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** Compact axis ticks: 1.2k, 3.4M */
export const compact = (n: number) =>
  Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Number(n || 0));

import type { ReactNode } from "react";

/** Legend with the value beside each swatch, so identity never depends on colour alone. */
export function ChartLegend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="grid gap-1.5 text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} aria-hidden="true" />
            <span className="truncate text-muted-foreground">{it.label}</span>
          </span>
          {it.value !== undefined && <span className="tabular-nums font-medium">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

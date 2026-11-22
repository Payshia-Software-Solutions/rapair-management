import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Standard page header for accounting screens. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Compact KPI tile. */
export function StatCard({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </Card>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Table header cell classes, to keep thead styling identical everywhere. */
export const theadClass = "bg-muted/40 text-left text-xs text-muted-foreground";

/** Titled card section: header row (title, description, optional action) and a body. */
export function SectionCard({ title, description, action, children, className, bodyClassName }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

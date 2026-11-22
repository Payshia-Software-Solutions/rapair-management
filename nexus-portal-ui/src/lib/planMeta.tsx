import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Package, Truck, Users, ShoppingCart, Database, Tag, Factory, Layers, Calculator,
} from 'lucide-react';

export const MODULES: Record<string, { label: string; Icon: LucideIcon }> = {
  inventory: { label: 'Inventory', Icon: Package },
  vendors: { label: 'Vendors & suppliers', Icon: Truck },
  crm: { label: 'CRM', Icon: Users },
  sales: { label: 'Sales & invoicing', Icon: ShoppingCart },
  masterData: { label: 'Master data', Icon: Database },
  promotions: { label: 'Promotions', Icon: Tag },
  production: { label: 'Production', Icon: Factory },
  coreFeatures: { label: 'Core features', Icon: Layers },
  accounting: { label: 'Accounting', Icon: Calculator },
};

export const humanize = (k: string) =>
  k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());

export function UsageMeter({ label, used, max }: { label: string; used: number | null; max: number | null }) {
  const pct = max && used != null ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const tone = pct >= 100 ? 'bg-nx-danger' : pct >= 80 ? 'bg-nx-warning' : 'bg-nx-accent';
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-nx-text-muted dark:text-nx-text-subtle">{label}</span>
        <span className="font-semibold tabular-nums text-nx-ink dark:text-white">
          {used ?? '–'} / {max ?? '∞'}
        </span>
      </div>
      <div
        role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={max ?? undefined} aria-valuenow={used ?? undefined}
        className="mt-2 h-2 overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark"
      >
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${tone}`} style={{ width: `${max ? pct : 0}%` }} />
      </div>
      {used == null && <p className="mt-1 text-[11px] text-nx-text-subtle">Shown after your workspace first reports.</p>}
    </div>
  );
}

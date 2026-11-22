import React from 'react';
import { Package, Receipt, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Package, title: 'Orders & inventory in one place', text: 'Track jobs, stock and suppliers without switching tools.' },
  { icon: Receipt, title: 'Invoicing & payments', text: 'Quotes, invoices and receipts that stay in sync.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Every staff action is limited and recorded in the audit log.' },
];

/** Split-screen layout shared by the sign-in, forgot-password and reset-password pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-slate-900 p-12 text-white">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-black/20 blur-3xl" aria-hidden />

        <div className="relative inline-flex w-fit items-center rounded-2xl bg-white px-5 py-3 shadow-lg">
          <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-12 w-auto object-contain" />
        </div>

        <div className="relative space-y-10">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold leading-tight">Run your workshop, end to end.</h2>
            <p className="max-w-md text-lg text-white/80">
              Unified business intelligence and ERP for sales, service and finance.
            </p>
          </div>
          <ul className="space-y-6">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">&copy; {new Date().getFullYear()} BizFlow Systems. All rights reserved.</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center lg:hidden">
            <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-16 w-auto object-contain" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">Unified Business Intelligence &amp; ERP</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer}

          <p className="text-center text-xs text-muted-foreground lg:hidden">
            &copy; {new Date().getFullYear()} BizFlow Systems. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}

import { Clock, Mail, PauseCircle, RefreshCw, SearchX, ShieldCheck, Wrench } from "lucide-react";

const SUPPORT_EMAIL = "support@nebulync.com";

type Msg = { title: string; text: string; icon: typeof PauseCircle; tone: string };

const MESSAGES: Record<string, Msg> = {
  workspace_not_found: {
    title: "Workspace not found",
    text: "There is no workspace at this address. Check the link, or ask your administrator for the correct one.",
    icon: SearchX,
    tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  workspace_suspended: {
    title: "Workspace paused",
    text: "Access to this workspace is paused, usually because of an unpaid invoice or a subscription change.",
    icon: PauseCircle,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  maintenance: {
    title: "Under maintenance",
    text: "We are carrying out scheduled maintenance. BizzFlow will be back shortly.",
    icon: Wrench,
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  },
  workspace_not_ready: {
    title: "Workspace is being set up",
    text: "This workspace is still being prepared. Please try again in a few minutes.",
    icon: Clock,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
};

const FALLBACK: Msg = {
  title: "Workspace unavailable",
  text: "This workspace cannot be opened right now. Please try again later.",
  icon: Clock,
  tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function WorkspaceUnavailable({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; w?: string; since?: string; m?: string; until?: string; back?: string }>;
}) {
  const { code = "", w = "", since = "", m: customText = "", until = "", back = "" } = await searchParams;
  const base = MESSAGES[code] ?? FALLBACK;
  const maintenance = code === "maintenance";
  const m = maintenance && customText ? { ...base, text: customText.slice(0, 500) } : base;
  const untilLabel = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(until) ? until.replace("T", " ") : "";
  // Only same-site paths, so the link can't send people elsewhere
  const retryHref = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const Icon = m.icon;
  const paused = code === "workspace_suspended";
  const workspace = w.slice(0, 120);
  const sinceDate = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : "";
  const subject = encodeURIComponent(paused ? `Reactivate workspace${workspace ? `: ${workspace}` : ""}` : "Workspace access");

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-8 w-auto object-contain" />
      </header>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.tone}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{m.title}</h1>
          {workspace && <p className="mt-1 text-sm font-medium text-foreground">{workspace}</p>}
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.text}</p>

          {maintenance && (
            <>
              {untilLabel && (
                <dl className="mt-5 rounded-xl border bg-muted/40 p-4 text-sm">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected back</dt>
                  <dd className="mt-0.5 font-semibold">{untilLabel} (Sri Lanka time)</dd>
                </dl>
              )}
              <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <p className="text-emerald-900 dark:text-emerald-100">
                  Your data is safe. Everything you saved before the maintenance is kept. Try again in a few minutes.
                </p>
              </div>
            </>
          )}

          {paused && (
            <>
              <dl className="mt-5 grid gap-3 rounded-xl border bg-muted/40 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">Paused</dd>
                </div>
                {sinceDate && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Since</dt>
                    <dd className="mt-0.5 font-semibold">{sinceDate}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <p className="text-emerald-900 dark:text-emerald-100">
                  Your data is safe. Nothing has been deleted, and everything is back as it was once the workspace is reactivated.
                </p>
              </div>

              <div className="mt-5 text-sm">
                <p className="font-semibold">What to do</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Workspace owner: check the email we sent about the pause, and settle any open invoice.</li>
                  <li>Team member: ask your workspace owner or administrator to contact us.</li>
                  <li>Already paid? Email us your payment reference and we will reactivate the workspace.</li>
                </ul>
              </div>
            </>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> Contact support
            </a>
            <a
              href={retryHref}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </main>
  );
}

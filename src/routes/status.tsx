import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  HelpCircle,
  Clock,
  Mail,
  Gauge,
} from "lucide-react";

import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { getPlatformStatus } from "@/lib/status/platform-status.functions";
import {
  STATUS_LABEL,
  STATUS_MEANING,
  STATUS_LEVELS,
  type ServiceStatus,
  type StatusLevel,
  type StatusNotice,
} from "@/lib/status/platform-status";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const statusQuery = queryOptions({
  queryKey: ["platform-status", "page"],
  queryFn: () => getPlatformStatus(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

export const Route = createFileRoute("/status")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQuery),
  head: () =>
    marketingHead(undefined, "/status", {
      title: "System status — TaaSFlow platform availability",
      description:
        "Live, measured status for the TaaSFlow platform: public website, authentication, client workspace, role management, agent processing, candidate data, scoring, integrations, notifications and billing.",
    }),
  component: StatusPage,
  errorComponent: makeRouteErrorComponent("public", "status"),
  notFoundComponent: makeRouteNotFoundComponent("public"),
});

/* --------------------------------------------------------------- presentation */

const ICON: Record<StatusLevel, typeof CheckCircle2> = {
  operational: CheckCircle2,
  degraded_performance: AlertTriangle,
  partial_outage: AlertTriangle,
  major_outage: AlertOctagon,
  maintenance: Wrench,
  unknown: HelpCircle,
};

/** Colour is a reinforcement here; the label always carries the meaning. */
const TONE: Record<StatusLevel, { text: string; dot: string; band: string }> = {
  operational: {
    text: "text-success",
    dot: "bg-success",
    band: "border-success/25 bg-success/[0.06]",
  },
  degraded_performance: {
    text: "text-warning-foreground",
    dot: "bg-warning",
    band: "border-warning/35 bg-warning/[0.10]",
  },
  partial_outage: {
    text: "text-warning-foreground",
    dot: "bg-warning",
    band: "border-warning/40 bg-warning/[0.14]",
  },
  major_outage: {
    text: "text-destructive",
    dot: "bg-destructive",
    band: "border-destructive/30 bg-destructive/[0.07]",
  },
  maintenance: {
    text: "text-[color:var(--brand-navy)]/80",
    dot: "bg-[color:var(--brand-navy)]/60",
    band: "border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/[0.04]",
  },
  unknown: {
    text: "text-[color:var(--brand-navy)]/70",
    dot: "bg-[color:var(--brand-navy)]/35",
    band: "border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/[0.02]",
  },
};

function StatusPill({ level }: { level: StatusLevel }) {
  const Icon = ICON[level];
  const tone = TONE[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.band} ${tone.text}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {STATUS_LABEL[level]}
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* -------------------------------------------------------------------- blocks */

function ServiceRow({ service }: { service: ServiceStatus }) {
  const tone = TONE[service.status];
  return (
    <li className="border-t border-[color:var(--brand-navy)]/8 first:border-t-0">
      <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
            <h3 className="text-sm font-semibold text-[color:var(--brand-navy)]">{service.name}</h3>
          </div>
          <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">{service.covers}</p>
          <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/85">{service.detail}</p>
          {service.maintenance_note ? (
            <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/70">
              Planned work: {service.maintenance_note}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-[color:var(--brand-navy)]/70">
            {service.measured_by} Window: {service.window}.
          </p>
        </div>
        <div className="shrink-0 sm:pt-0.5">
          <StatusPill level={service.status} />
        </div>
      </div>
    </li>
  );
}

function NoticeCard({ notice }: { notice: StatusNotice }) {
  const window =
    notice.kind === "maintenance" && notice.scheduled_start
      ? `${formatTime(notice.scheduled_start)}${notice.scheduled_end ? ` — ${formatTime(notice.scheduled_end)}` : ""}`
      : formatTime(notice.started_at);
  return (
    <article className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill level={notice.severity} />
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-navy)]/70">
          {notice.state.replace(/_/g, " ")}
        </span>
      </div>
      <h3 className="mt-2.5 text-base font-semibold text-[color:var(--brand-navy)]">{notice.title}</h3>
      <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/80">{notice.summary}</p>
      <dl className="mt-3 grid gap-1.5 text-xs text-[color:var(--brand-navy)]/70 sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="font-semibold">{notice.kind === "maintenance" ? "Window" : "Started"}:</dt>
          <dd>{window}</dd>
        </div>
        {notice.resolved_at ? (
          <div className="flex gap-1.5">
            <dt className="font-semibold">Resolved:</dt>
            <dd>{formatTime(notice.resolved_at)}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

/* ---------------------------------------------------------------------- page */

function StatusPage() {
  const { data } = useSuspenseQuery(statusQuery);
  const unmeasured = data.services.filter((s) => !s.measured);

  return (
    <SiteShell>
      <PublicSection className="pb-4">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/70">
            System status
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
            TaaSFlow platform status
          </h1>

          <div
            className={`mt-6 rounded-xl border p-4 sm:p-5 ${TONE[data.overall].band}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-base font-semibold text-[color:var(--brand-navy)]">{data.headline}</p>
              <StatusPill level={data.overall} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--brand-navy)]/70">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Last updated {formatTime(data.checked_at)}. Measured when this page loaded.
            </p>
          </div>

          <p className="mt-4 max-w-3xl text-sm text-[color:var(--brand-navy)]/70">
            Every status below comes from a check run when this page loaded. Where a check could not
            run, the service reads <strong>Unknown</strong> rather than a guess. We do not publish
            uptime percentages, because we do not run continuous external monitoring that would make
            such a figure honest.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ---------------------------------------------------- active incidents */}
      {data.active_incidents.length > 0 ? (
        <PublicSection className="py-6">
          <PublicPage>
            <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">Open incidents</h2>
            <div className="mt-3 grid gap-3">
              {data.active_incidents.map((notice) => (
                <NoticeCard key={notice.id} notice={notice} />
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* ---------------------------------------------------------- maintenance */}
      <PublicSection className="py-6">
        <PublicPage>
          <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">Maintenance notices</h2>
          {data.maintenance.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {data.maintenance.map((notice) => (
                <NoticeCard key={notice.id} notice={notice} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
              No maintenance is scheduled or in progress. Planned work that affects availability is
              published here before it starts.
            </p>
          )}
        </PublicPage>
      </PublicSection>

      {/* -------------------------------------------------------------- services */}
      <PublicSection className="py-6">
        <PublicPage>
          <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">Services</h2>
          <ul className="mt-2 rounded-xl border border-[color:var(--brand-navy)]/12 bg-white px-4 sm:px-5">
            {data.services.map((service) => (
              <ServiceRow key={service.key} service={service} />
            ))}
          </ul>
          {unmeasured.length > 0 ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-[color:var(--brand-navy)]/70">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {unmeasured.length === 1
                  ? `${unmeasured[0]!.name} could not be measured on this check, so no status is claimed for it.`
                  : `${unmeasured.length} services could not be measured on this check, so no status is claimed for them.`}
              </span>
            </p>
          ) : null}
        </PublicPage>
      </PublicSection>

      {/* ------------------------------------------------------ status meanings */}
      <PublicSection className="py-6">
        <PublicPage>
          <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">
            <span className="inline-flex items-center gap-2">
              <Gauge className="h-4 w-4" aria-hidden />
              What each status means
            </span>
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {STATUS_LEVELS.map((level) => (
              <div
                key={level}
                className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white p-3.5"
              >
                <dt>
                  <StatusPill level={level} />
                </dt>
                <dd className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {STATUS_MEANING[level]}
                </dd>
              </div>
            ))}
          </dl>
        </PublicPage>
      </PublicSection>

      {/* -------------------------------------------------------------- history */}
      <PublicSection className="py-6">
        <PublicPage>
          <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">Incident history</h2>
          {data.incident_history.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Published records since {data.history_since ? formatDate(data.history_since) : "—"}.
              </p>
              <div className="mt-3 grid gap-3">
                {data.incident_history.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--brand-navy)]/70">
              No incident records have been published yet. This means the published record is empty —
              it is not a claim that no disruption has ever occurred. Incidents that affect customers
              are written here when they happen.
            </p>
          )}
        </PublicPage>
      </PublicSection>

      {/* -------------------------------------------------------------- support */}
      <PublicSection className="py-6 pb-16">
        <PublicPage>
          <div className="rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-paper)] p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">
              Something wrong that is not listed here?
            </h2>
            <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/75">
              {data.subscription_supported
                ? "Subscribe to status updates or contact support."
                : "There is no status-update subscription yet, so this page is the source of truth. If you are seeing a problem that is not reflected above, tell us — checks only see what they can measure."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-navy)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Contact support
              </Link>
              <Link
                to="/security"
                className="inline-flex items-center rounded-md border border-[color:var(--brand-navy)]/15 px-3.5 py-2 text-sm font-semibold text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                Trust Center
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}

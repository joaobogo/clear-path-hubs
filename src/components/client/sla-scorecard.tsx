import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Target, TrendingUp } from "lucide-react";
import { getSlaPerformance } from "@/lib/sla.functions";
import { SLA_STATE_LABEL, roundHalf, type RoleSla, type SlaMetric, type SlaState } from "@/lib/sla";

const TONE: Record<SlaState, string> = {
  met: "taas-bd-success taas-bg-success-soft taas-fg-success",
  missed: "taas-bd-danger taas-bg-danger-soft taas-fg-danger",
  at_risk: "taas-bd-warning taas-bg-warning-soft taas-fg-warning",
  on_track: "border-border bg-muted/40 text-muted-foreground",
  pending: "border-border bg-muted/40 text-muted-foreground",
};

function StateChip({ state }: { state: SlaState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[state]}`}
    >
      {SLA_STATE_LABEL[state]}
    </span>
  );
}

function MetricRow({ metric }: { metric: SlaMetric }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{metric.label}</div>
        <div className="truncate text-xs text-muted-foreground">{metric.promise}</div>
      </div>
      <div className="text-xs sm:text-sm">
        <span className="text-muted-foreground sm:hidden">Actual: </span>
        {metric.actual}
      </div>
      <div className="text-xs sm:text-sm">
        <span className="text-muted-foreground sm:hidden">Variance: </span>
        {metric.variance}
      </div>
      <StateChip state={metric.state} />
    </div>
  );
}

function RoleBlock({ role, showLink }: { role: RoleSla; showLink: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {showLink ? (
            <Link
              to="/client/positions/$id"
              params={{ id: role.positionId }}
              className="truncate font-medium hover:underline"
            >
              {role.title}
            </Link>
          ) : (
            <span className="truncate font-medium">{role.title}</span>
          )}
          <div className="text-xs text-muted-foreground">
            Search live since{" "}
            {new Date(role.baselineAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        <StateChip state={role.state} />
      </div>

      <div className="mt-2 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
        <span>Commitment</span>
        <span>Actual</span>
        <span>Variance</span>
        <span className="text-right">Status</span>
      </div>
      <div className="divide-y">
        {role.metrics.map((m) => (
          <MetricRow key={m.key} metric={m} />
        ))}
      </div>
    </div>
  );
}

/**
 * Promise, actual, variance — reported against the commitments we set when the
 * search went live. Shows misses as plainly as it shows wins.
 */
export function SlaScorecard({
  orgId,
  positionId,
  title = "Our commitments to you",
}: {
  orgId: string | undefined;
  positionId?: string;
  title?: string;
}) {
  const fn = useServerFn(getSlaPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["client", "sla", orgId, positionId ?? null],
    queryFn: () => fn({ data: { orgId: orgId!, ...(positionId ? { positionId } : {}) } }),
    enabled: !!orgId,
  });

  if (!orgId) return null;
  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-lg border bg-muted/40" aria-hidden />;
  }
  if (!data || data.roles.length === 0) return null;

  const { summary, roles } = data;
  const avg = summary.averageVarianceDays;

  return (
    <section aria-labelledby="sla-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sla-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" />
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">
          What we promised at launch, and what actually happened.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Commitments met"
          value={summary.onTimeRate === null ? "—" : `${summary.onTimeRate}%`}
          detail={
            summary.measured
              ? `${summary.met} of ${summary.measured} measured`
              : "Nothing measurable yet"
          }
        />
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Average variance"
          value={
            avg === null
              ? "—"
              : `${avg > 0 ? "+" : ""}${roundHalf(avg)}d`
          }
          detail={
            avg === null
              ? "Measured once deadlines pass"
              : avg <= 0
                ? "Ahead of promise on average"
                : "Behind promise on average"
          }
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Behind or at risk"
          value={String(summary.atRisk)}
          detail={summary.atRisk === 0 ? "Everything inside the window" : "We owe you movement"}
        />
      </div>

      <div className="space-y-3">
        {roles.map((role) => (
          <RoleBlock key={role.positionId} role={role} showLink={!positionId} />
        ))}
      </div>
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

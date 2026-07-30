import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CHANNEL_STATE_LABEL,
  SOURCING_CAPABILITIES,
  formatExpected,
  type LaunchStage,
  type RoleLaunchState,
} from "@/lib/role-launch";
import { CheckCircle2, Circle, Loader2, Radar, TriangleAlert } from "lucide-react";

/**
 * RoleLaunchPanel — the client's "what is happening with my role" view.
 *
 * Two halves, both fed by server-computed evidence: the Role Setup timeline
 * (what has happened, in order) and Search Channels (where we are looking).
 * Nothing animates on a timer; a step only moves when a record moves.
 */

function StageIcon({ state }: { state: LaunchStage["state"] }) {
  if (state === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (state === "attention")
    return <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden />;
  if (state === "active")
    return <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" aria-hidden />;
}

const STATE_WORD: Record<LaunchStage["state"], string> = {
  done: "Complete",
  active: "In progress",
  attention: "Needs attention",
  pending: "Not started",
};

function when(at: string | null) {
  if (!at) return null;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function RoleLaunchPanel({ launch }: { launch: RoleLaunchState }) {
  if (!launch) return null;
  const { stages, channels } = launch;

  return (
    <div className="space-y-4">
      <SourcingEngineCard launch={launch} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Role setup</h2>
            <p className="text-sm text-muted-foreground">{launch.headline}</p>
          </div>
          {launch.firstCandidatesExpected && (
            <Badge
              variant="outline"
              className={
                launch.delayed
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-500"
                  : "border-sky-500/40 text-sky-700 dark:text-sky-400"
              }
            >
              First candidates · {formatExpected(launch.firstCandidatesExpected)}
            </Badge>
          )}
        </div>

        <ol className="space-y-0">
          {stages.map((s, i) => (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < stages.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[7px] top-5 h-full w-px bg-border"
                />
              )}
              <span className="relative mt-0.5 shrink-0 bg-card">
                <StageIcon state={s.state} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p
                    className={`text-sm ${
                      s.state === "pending"
                        ? "text-muted-foreground"
                        : "font-medium"
                    }`}
                  >
                    {s.label}
                  </p>
                  <span className="sr-only">{STATE_WORD[s.state]}</span>
                  {when(s.at) && (
                    <span className="text-xs text-muted-foreground">
                      {when(s.at)}
                    </span>
                  )}
                </div>
                {s.detail && (
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Channel mix</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Selected and optimised by TaaSFlow for this role.
        </p>
        <ul className="space-y-3">
          {channels.map((c) => (
            <li key={c.key} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.label}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    c.state === "active"
                      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                      : c.state === "paused" || c.state === "attention"
                        ? "border-amber-500/40 text-amber-700 dark:text-amber-500"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {CHANNEL_STATE_LABEL[c.state]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.evidence}</p>
            </li>
          ))}
        </ul>
      </Card>
      </div>
    </div>
  );
}

const METRIC_ORDER = [
  ["identified", "Candidates identified"],
  ["contacted", "Candidates contacted"],
  ["engaged", "Engaged"],
  ["replied", "Responses"],
  ["applicants", "Applicants"],
  ["qualified", "Qualified candidates"],
] as const;

function MetricTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value === null ? (
        <p className="mt-1 text-xs text-muted-foreground">No verified data yet</p>
      ) : (
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

/**
 * TaaSFlow Sourcing Engine — read-only. Clients never pick channels; the
 * engine decides the mix from role, geography, seniority, market conditions,
 * availability and channel performance. Every number here is a stored count.
 */
function SourcingEngineCard({ launch }: { launch: RoleLaunchState }) {
  const m = launch.metrics;
  if (!m) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <Radar className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold">TaaSFlow Sourcing Engine</h2>
            <p className="text-sm text-muted-foreground">{launch.headline}</p>
          </div>
        </div>
        {m.lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Last update {new Date(m.lastUpdate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        The engine evaluates role, geography, seniority, market conditions,
        candidate availability and live channel performance to set and
        continuously optimise the channel mix for this position.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METRIC_ORDER.map(([key, label]) => (
          <MetricTile key={key} label={label} value={m[key]} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium">Source attribution</p>
          {m.attribution.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              No verified data yet
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {m.attribution.map((a) => (
                <li
                  key={a.label}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="capitalize">{a.label.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-medium">Next system action</p>
          <p className="mt-1 text-xs text-muted-foreground">{m.nextAction}</p>
        </div>
      </div>

      <details className="mt-4 rounded-lg border bg-muted/20 p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Network capabilities the engine can deploy
        </summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {SOURCING_CAPABILITIES.map((c) => (
            <li key={c} className="text-xs text-muted-foreground">
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Availability across the TaaSFlow network. The engine selects only the
          channels justified by this role and market.
        </p>
      </details>
    </Card>
  );
}

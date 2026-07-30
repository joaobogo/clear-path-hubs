import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CHANNEL_STATE_LABEL,
  formatExpected,
  type LaunchStage,
  type RoleLaunchState,
} from "@/lib/role-launch";
import { CheckCircle2, Circle, Loader2, TriangleAlert } from "lucide-react";

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
        <h2 className="mb-1 text-sm font-semibold">Search channels</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Where TaaSFlow is looking for this role.
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
  );
}

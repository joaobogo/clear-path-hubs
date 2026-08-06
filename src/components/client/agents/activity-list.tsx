import { Link } from "@tanstack/react-router";
import { Ban, Bot, CircleSlash, Clock } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";
import { Badge } from "@/components/ui/badge";
import { stamp } from "./agent-card";
import type { listAgentActivity } from "@/lib/agents.functions";

type ActivityRow = Awaited<ReturnType<typeof listAgentActivity>>[number];

export function AgentActivityList({
  activityState,
  activity,
}: {
  activityState: {
    isError: boolean;
    error: unknown;
    retry: () => void;
    retrying: boolean;
  };
  activity: ActivityRow[] | undefined;
}) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
      {activityState.isError ? (
        <li className="p-4">
          <QueryErrorCard
            error={activityState.error}
            onRetry={activityState.retry}
            retrying={activityState.retrying}
            compact
          />
        </li>
      ) : (activity ?? []).length === 0 ? (
        <li className="p-6 text-sm text-muted-foreground">
          Nothing recorded yet. When an agent acts — or is stopped by a rule
          — the sentence appears here.
        </li>
      ) : (
        activity!.map((row) => (
          <li key={row.id} className="flex items-start gap-3 p-4">
            <span className="mt-0.5">
              {row.outcome === "blocked" ? (
                <Ban className="h-4 w-4 text-amber-500" aria-hidden />
              ) : row.outcome === "failed" ? (
                <CircleSlash
                  className="h-4 w-4 text-destructive"
                  aria-hidden
                />
              ) : (
                <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {row.link_path ? (
                  <Link
                    to={row.link_path}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.sentence}
                  </Link>
                ) : (
                  row.sentence
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-normal">
                  {row.agent_name}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {stamp(row.occurred_at)}
                </span>
                {row.reason && <span>Reason: {row.reason}</span>}
              </p>
            </div>
          </li>
        ))
      )}
    </ul>
  );
}

import * as React from "react";
import { Bot, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import {
  PREVIEW_AGENT_RUNS,
  PREVIEW_ROLE,
  type PreviewAgentRun,
} from "@/lib/previews/representative-fixtures";

const STATUS_META: Record<
  PreviewAgentRun["status"],
  { icon: typeof Bot; className: string }
> = {
  Running: { icon: Loader2, className: "border-primary/40 bg-primary/10 text-primary" },
  Complete: {
    icon: CheckCircle2,
    className: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  Waiting: {
    icon: Clock,
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

/**
 * Agent run log preview — the same shape as the workspace Agent Activity rail:
 * actor, action, time, status, result. Static fixtures only.
 */
export function AgentRunsPreview({ className }: { className?: string }) {
  const [filter, setFilter] = React.useState<"all" | PreviewAgentRun["status"]>("all");
  const runs = PREVIEW_AGENT_RUNS.filter((r) => filter === "all" || r.status === filter);

  return (
    <PreviewFrame
      title={`Agent activity · ${PREVIEW_ROLE.title}`}
      caption="Every run records actor, action, time, status and result"
      className={className}
    >
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter agent runs by status">
        {(["all", "Running", "Waiting", "Complete"] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "secondary" : "ghost"}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "All runs" : key}
          </Button>
        ))}
      </div>

      {runs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No runs with that status in this example.
        </p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {runs.map((run) => {
            const meta = STATUS_META[run.status];
            const Icon = meta.icon;
            return (
              <li
                key={run.agent}
                className="min-w-0 rounded-xl border border-border/70 bg-background p-3"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{run.agent}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{run.detail}</p>
                  </div>
                  <span
                    className={
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                      meta.className
                    }
                  >
                    <Icon
                      className={"h-3 w-3" + (run.status === "Running" ? " animate-spin" : "")}
                      aria-hidden
                    />
                    {run.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-foreground/85">
                  <span className="tabular-nums text-muted-foreground">{run.at}</span> · {run.result}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </PreviewFrame>
  );
}

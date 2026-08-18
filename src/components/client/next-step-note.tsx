import { ArrowRight, Clock, UserCheck } from "lucide-react";
import { buildNextStep } from "@/lib/client-next-step";
import type { MatchStage } from "@/lib/client-kpi.server";
import { cn } from "@/lib/utils";

/**
 * "What happens next" under every state: what happens, who owns it, and when.
 * If we owe the client something we say so; if the ball is with them, we say
 * that instead — never silence.
 */
export function NextStepNote({
  stage,
  stageEnteredAt,
  className,
}: {
  stage: MatchStage;
  stageEnteredAt: string | null;
  className?: string;
}) {
  const next = buildNextStep(stage, stageEnteredAt);
  const waitingOnClient = next.owner === "client";

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs",
        next.overdue
          ? "border-warning/40 bg-warning/5 text-warning-foreground"
          : waitingOnClient
            ? "border-border bg-muted/40 text-muted-foreground"
            : "border-primary/30 bg-primary/5 text-muted-foreground",
        className,
      )}
    >
      {next.overdue ? (
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-foreground" aria-hidden />
      ) : waitingOnClient ? (
        <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      )}
      <p className="leading-relaxed">
        <span className="font-medium text-foreground">Next: </span>
        {next.sentence}{" "}
        <span className="font-medium text-foreground">
          {waitingOnClient ? "You" : "Recruiting team"}
        </span>
        {next.due && (
          <>
            {" · "}
            <span
              className={cn(
                "font-medium",
                next.overdue ? "text-warning-foreground" : "text-foreground",
              )}
            >
              {next.overdue ? "Overdue — we're on it." : next.due}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

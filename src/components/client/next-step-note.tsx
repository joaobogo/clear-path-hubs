import { ArrowRight, UserCheck } from "lucide-react";
import { buildNextStep } from "@/lib/client-next-step";
import type { MatchStage } from "@/lib/client-kpi.server";
import { cn } from "@/lib/utils";

/**
 * "What happens next" under every state: what happens, who owns it, and when.
 * If we owe the client something we say so; if the ball is with them, we say
 * that instead — never silence.
 *
 * This is a client-facing component: overdue counts and internal SLA language
 * are intentionally stripped. The team responsible and the commitment remain.
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
  const next = buildNextStep(stage, stageEnteredAt, undefined, { clientView: true });
  const waitingOnClient = next.owner === "client";
  // Defensive: never let an overdue label ("Overdue by …") reach the client UI,
  // even if the underlying helper changes.
  const clientDue = next.due && !/^Overdue\b/i.test(next.due) ? next.due : null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs",
        waitingOnClient
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-primary/30 bg-primary/5 text-muted-foreground",
        className,
      )}
    >
      {waitingOnClient ? (
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
        {clientDue && (
          <>
            {" · "}
            <span className="font-medium text-foreground">{clientDue}</span>
          </>
        )}
      </p>
    </div>
  );
}

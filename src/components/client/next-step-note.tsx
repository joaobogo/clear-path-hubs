import { ArrowRight, Clock } from "lucide-react";
import { buildNextStep } from "@/lib/client-next-step";
import type { MatchStage } from "@/lib/client-kpi.server";
import { cn } from "@/lib/utils";

/**
 * Persistent "what happens next" line so a decision never disappears into
 * silence. Shows our commitment and the deadline it is measured against.
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
  if (next.owner === "client") return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs",
        next.overdue
          ? "border-warning/40 bg-warning/5 text-warning-foreground"
          : "border-primary/30 bg-primary/5 text-muted-foreground",
        className,
      )}
    >
      {next.overdue ? (
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      ) : (
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      )}
      <p className="leading-relaxed">
        <span className="font-medium text-foreground">Next: </span>
        {next.sentence}{" "}
        {next.due && (
          <span className={cn("font-medium", next.overdue ? "text-warning-foreground" : "text-foreground")}>
            {next.overdue ? "Overdue — we're on it." : next.due}
          </span>
        )}
      </p>
    </div>
  );
}

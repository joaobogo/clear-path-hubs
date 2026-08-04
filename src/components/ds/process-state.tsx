import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  announcement,
  processDefinition,
  stageProgress,
  type ProcessKey,
  type ProcessStatus,
} from "@/lib/loading/process-catalogue";

/**
 * The single presentation for "something is running" in the product.
 *
 * Layout-stable: the frame keeps the same footprint across running, done and
 * failed so nothing shifts underneath the pointer. Motion is limited to a small
 * indicator that disables itself under prefers-reduced-motion. No percentages
 * are ever shown unless a real stage count exists.
 */
export function ProcessState({
  status,
  onRetry,
  retrying = false,
  className,
  compact = false,
}: {
  status: ProcessStatus;
  onRetry?: () => void;
  /** Disables the retry control while a retry is already in flight. */
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const def = processDefinition(status.process);
  const stage = stageProgress(status);
  const failed = status.phase === "failed";
  const done = status.phase === "done";
  const background = status.phase === "background";

  if (status.phase === "idle") return null;

  const Icon = failed ? AlertTriangle : done ? CheckCircle2 : background ? Clock : Loader2;

  return (
    <div
      data-process={def.key}
      data-phase={status.phase}
      aria-busy={status.phase === "running" || background}
      className={cn(
        "rounded-xl border bg-card/60 text-left",
        failed && "border-destructive/40",
        done && "taas-bd-success-soft",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {announcement(status)}
      </div>

      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            failed && "text-destructive",
            done && "taas-tx-success",
            !failed && !done && "text-primary",
            status.phase === "running" && "animate-spin motion-reduce:animate-none",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {failed ? def.failed : done ? def.done : def.running}
          </p>

          {stage && !done && !failed ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stage {stage.index + 1} of {stage.total} · {stage.current.label} —{" "}
              {stage.current.detail}
            </p>
          ) : null}

          {!stage && !done && !failed ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              We do not show a countdown we cannot stand behind — this stays up until the work
              finishes.
            </p>
          ) : null}

          {status.note ? (
            <p className="mt-1 text-xs text-foreground/80">{status.note}</p>
          ) : null}

          {failed && status.errorMessage ? (
            <p className="mt-1 text-xs text-destructive">{status.errorMessage}</p>
          ) : null}

          {!done ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {failed ? "Nothing was part-applied — retrying starts clean." : def.navigationNote}
              {def.typicalTiming && !failed ? ` ${def.typicalTiming}` : ""}
            </p>
          ) : null}

          {failed && onRetry ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? "Retrying…" : def.retryLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {stage && !done && !failed ? (
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
          {processDefinition(status.process).stages.map((s, i) => (
            <li
              key={s.key}
              className={cn(
                "h-1.5 flex-1 min-w-8 rounded-full",
                i < stage.index && "bg-primary",
                i === stage.index && "bg-primary/50",
                i > stage.index && "bg-muted",
              )}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * Inline running indicator for buttons and table headers, where a full frame
 * would be too heavy. Announces politely and reserves its own width.
 */
export function ProcessInline({
  process,
  label,
  className,
}: {
  process: ProcessKey;
  label?: string;
  className?: string;
}) {
  const def = processDefinition(process);
  const text = label ?? def.running;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      {text}
    </span>
  );
}

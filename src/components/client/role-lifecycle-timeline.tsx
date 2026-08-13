import { useState } from "react";
import { useJustChanged } from "@/lib/motion/use-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  MinusCircle,
  Circle,
  XCircle,
} from "lucide-react";
import {
  formatLifecycleDate,
  type LifecycleStage,
  type LifecycleState,
  type RoleLifecycle,
} from "@/lib/role-lifecycle/role-lifecycle";

/**
 * Role lifecycle timeline — Intake > Blueprint > Discovery > Evidence >
 * Scoring > Review > Interview > Decision > Hire.
 *
 * A vertical timeline at every width: accessible on mobile, no wide horizontal
 * diagram. State is communicated with an icon and a written label, never colour
 * alone. Each stage expands in place so the user never leaves the role.
 */

const STATE_ICON: Record<LifecycleState, typeof Check> = {
  completed: Check,
  active: Loader2,
  waiting: Clock,
  blocked: AlertTriangle,
  skipped: MinusCircle,
  failed: XCircle,
  not_started: Circle,
};

const STATE_DOT: Record<LifecycleState, string> = {
  completed: "border-primary/40 bg-primary/10 text-primary",
  active: "border-primary bg-primary/15 text-primary",
  waiting: "border-warning/50 bg-warning/10 text-warning-strong",
  blocked: "border-destructive/50 bg-destructive/10 text-destructive",
  skipped: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/60 bg-destructive/10 text-destructive",
  not_started: "border-border bg-background text-muted-foreground/60",
};

const STATE_BADGE: Record<LifecycleState, "default" | "secondary" | "outline" | "destructive"> = {
  completed: "secondary",
  active: "default",
  waiting: "outline",
  blocked: "destructive",
  skipped: "outline",
  failed: "destructive",
  not_started: "outline",
};

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-xs leading-snug text-foreground/80">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageRow({
  stage,
  isLast,
  isCurrent,
}: {
  stage: LifecycleStage;
  isLast: boolean;
  isCurrent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = STATE_ICON[stage.state];
  // Only the stage that actually changed state animates — never the whole list.
  const advanced = useJustChanged(stage.state);
  const started = formatLifecycleDate(stage.startedAt);
  const completed = formatLifecycleDate(stage.completedAt);
  const times =
    completed && started
      ? `${started} → ${completed}`
      : started
        ? `Started ${started}`
        : completed
          ? `Completed ${completed}`
          : "No dates recorded yet";
  const panelId = `lifecycle-${stage.key}`;

  return (
    <li className="relative pl-9">
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "motion-connector absolute left-[13px] top-7 bottom-0 w-px",
            stage.state === "completed" ? "bg-primary/40" : "bg-border",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1 grid h-7 w-7 place-items-center rounded-full border",
          STATE_DOT[stage.state],
          advanced && "motion-stage-advance",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            stage.state === "active" && "animate-spin motion-reduce:animate-none",
          )}
        />
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <span
              className={cn(
                "truncate text-sm font-semibold",
                stage.state === "not_started" || stage.state === "skipped"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {stage.label}
            </span>
            {isCurrent && (
              <span className="ml-2 text-[11px] font-medium text-primary">Here now</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={STATE_BADGE[stage.state]} className="whitespace-nowrap text-[10px]">
              {stage.stateLabel}
            </Badge>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {stage.owner} · {times}
        </p>
        {(stage.pendingApprovals.length > 0 || stage.blockers.length > 0) && !open && (
          <p className="mt-1 text-xs font-medium text-warning-strong">
            {[...stage.blockers, ...stage.pendingApprovals][0]}
          </p>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="motion-expand mb-2 ml-2 mt-1 space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3"
        >
          <p className="text-xs leading-snug text-foreground/80">{stage.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailList title="Inputs" items={stage.inputs} />
            <DetailList title="Outputs" items={stage.outputs} />
            <DetailList title="Blockers" items={stage.blockers} />
            <DetailList title="Pending approvals" items={stage.pendingApprovals} />
          </div>
          <div className="grid gap-1 text-xs">
            <p>
              <span className="font-semibold">Responsible:</span> {stage.owner}
            </p>
            <p>
              <span className="font-semibold">Started:</span>{" "}
              {started || "Not recorded"}
            </p>
            <p>
              <span className="font-semibold">Completed:</span>{" "}
              {completed || "Not yet"}
            </p>
          </div>
          {stage.nextAction && (
            <p className="rounded-md bg-background px-2 py-1.5 text-xs">
              <span className="font-semibold">Next:</span> {stage.nextAction}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function RoleLifecycleTimeline({
  lifecycle,
  isLoading,
  error,
  onRetry,
  className,
}: {
  lifecycle: RoleLifecycle | null | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-48" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-border p-4", className)} role="alert">
        <p className="text-sm font-medium">We couldn't load the role workflow.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing has changed on the role. Try again in a moment.
        </p>
        {onRetry && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!lifecycle) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border p-4", className)}>
        <p className="text-sm font-medium">No workflow to show yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stages appear here as soon as work is recorded on this role.
        </p>
      </div>
    );
  }

  return (
    <section className={cn("min-w-0", className)} aria-label="Role workflow">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">Workflow</h3>
          <p className="truncate text-xs text-muted-foreground">{lifecycle.caption}</p>
        </div>
        {lifecycle.attentionCount > 0 && (
          <Badge variant="outline" className="shrink-0 whitespace-nowrap text-[10px]">
            {lifecycle.attentionCount} need
            {lifecycle.attentionCount === 1 ? "s" : ""} attention
          </Badge>
        )}
      </header>

      <ol className="mt-3 space-y-1">
        {lifecycle.stages.map((stage, i) => (
          <StageRow
            key={stage.key}
            stage={stage}
            isLast={i === lifecycle.stages.length - 1}
            isCurrent={i === lifecycle.currentIndex && !lifecycle.inactive}
          />
        ))}
      </ol>
    </section>
  );
}

import { formatCalendarDate } from "@/lib/calendar-date";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { CalendarCheck, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/client/states";
import {
  HANDOFF_GUARANTEE_HIDDEN,
  HANDOFF_NO_START_DATE,
  UNASSIGNED_OWNER,
  remainingSteps,
  type PositionHandoff,
} from "@/lib/hire-handoff";
import { getPositionHandoff, setHandoffStep } from "@/lib/hire-handoff.functions";
import { formatEnumLabel } from "@/lib/human-labels";

/**
 * Post-hire handoff view.
 *
 * Replaces the search view once a hire is confirmed, so the role never goes
 * quiet. It shows only what is recorded: the confirmed start date, the agreed
 * compensation, the guarantee window derived from that start date, and the
 * remaining steps the plan includes — unassigned ones included.
 */

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return formatCalendarDate(iso, "") || null;
}

export function HandoffSkeleton() {
  return (
    <div className="space-y-4" data-testid="handoff-skeleton">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function HireHandoffPanel({
  orgId,
  positionId,
  canEdit,
}: {
  orgId: string;
  positionId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const loadFn = useServerFn(getPositionHandoff);
  const queryKey = ["client-position-handoff", orgId, positionId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => loadFn({ data: { orgId, positionId } }),
  });

  const stepFn = useServerFn(setHandoffStep);
  const toggle = useMutation({
    mutationFn: (v: { stepKey: "references" | "background_check" | "paperwork"; done: boolean }) =>
      stepFn({ data: { orgId, positionId, stepKey: v.stepKey, done: v.done } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "That did not save. Please try again." }),
  });

  if (isLoading) return <HandoffSkeleton />;
  if (isError || !data) {
    return (
      <ErrorState
        title="We couldn't load the handoff for this role"
        onRetry={() => void refetch()}
      />
    );
  }

  return <HandoffView handoff={data} canEdit={canEdit} onToggle={toggle.mutate} busy={toggle.isPending} />;
}

export function HandoffView({
  handoff,
  canEdit,
  onToggle,
  busy,
}: {
  handoff: PositionHandoff;
  canEdit: boolean;
  onToggle: (v: { stepKey: "references" | "background_check" | "paperwork"; done: boolean }) => void;
  busy?: boolean;
}) {
  const outstanding = useMemo(() => remainingSteps(handoff.steps), [handoff.steps]);
  const start = fmtDate(handoff.start_date);
  const guarantee = handoff.guarantee;

  return (
    <section className="space-y-4" data-testid="hire-handoff">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Hired</Badge>
          <h2 className="text-lg font-semibold tracking-tight">
            {handoff.candidate_name} is joining as {handoff.position_title}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The search is closed. What remains is the handoff below — you can still open this role at
          any time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Fact
          label="Confirmed start date"
          value={start ?? "Not confirmed yet"}
          {...(start
            ? handoff.start_date_confirmed
              ? {}
              : { hint: "Provisional until the candidate confirms" }
            : { hint: HANDOFF_NO_START_DATE })}
        />
        <Fact
          label="Agreed compensation"
          value={handoff.compensation.label || "Not recorded"}
          {...(handoff.employment_type ? { hint: `${handoff.compensation.period === "monthly" ? "per month" : handoff.compensation.period === "hourly" ? "per hour" : "per year"} / ${formatEnumLabel(handoff.employment_type)}` } : {})}
        />
        <Fact
          label="Replacement guarantee"
          value={
            guarantee
              ? `${guarantee.days} days · ends ${fmtDate(guarantee.ends_on)}`
              : handoff.guarantee_visible
                ? "Begins on their start date"
                : HANDOFF_GUARANTEE_HIDDEN
          }
          {...(guarantee
            ? {
                hint:
                  guarantee.state === "active"
                    ? `${guarantee.days_remaining} days remaining`
                    : guarantee.state === "not_started"
                      ? "Starts the day they join"
                      : "Window has elapsed",
              }
            : handoff.guarantee_terms
              ? { hint: handoff.guarantee_terms }
              : {})}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Remaining steps</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          These come from what your plan includes
          {handoff.plan_label ? ` (${handoff.plan_label})` : ""}. They stay here until they are
          completed.
        </p>
        <ul className="mt-4 space-y-2">
          {handoff.steps.map((step) => {
            const done = Boolean(step.completed_at);
            return (
              <li
                key={step.key}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                data-testid={`handoff-step-${step.key}`}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs text-muted-foreground">{step.detail}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Owner:{" "}
                      {step.owner_name ? (
                        step.owner_name
                      ) : (
                        <span className="text-foreground/80">{UNASSIGNED_OWNER}</span>
                      )}
                      {done && step.completed_at
                        ? ` · completed ${fmtDate(step.completed_at)}`
                        : ""}
                    </div>
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant={done ? "ghost" : "outline"}
                    disabled={busy}
                    onClick={() => onToggle({ stepKey: step.key, done: !done })}
                  >
                    {done ? "Reopen" : "Mark complete"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {outstanding.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Every step on this handoff is complete.
          </p>
        ) : null}
      </div>
    </section>
  );
}

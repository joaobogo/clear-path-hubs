import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CalendarClock } from "lucide-react";
import {
  getInterviewExceptions,
  nudgeInterview,
  recordInterviewOutcomeFn,
} from "@/lib/interview-exceptions.functions";
import {
  EXCEPTION_LABEL,
  OUTCOMES,
  type InterviewExceptionRow,
  type InterviewOutcome,
} from "@/lib/interview-exceptions";

function useExceptions(positionId?: string) {
  return useQuery({
    queryKey: ["interview-exceptions", positionId ?? "all"],
    queryFn: () =>
      getInterviewExceptions({ data: positionId ? { position_id: positionId } : {} }),
  });
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/** Compact count badge for a position header. */
export function InterviewExceptionsBadge({ positionId }: { positionId: string }) {
  const query = useExceptions(positionId);
  const count = query.data?.rows.length ?? 0;
  if (query.isPending || query.isError || count === 0) return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <CalendarClock className="h-3 w-3" />
      {count} interview exception{count === 1 ? "" : "s"}
    </Badge>
  );
}

export function InterviewExceptionsPanel({ positionId }: { positionId?: string }) {
  const queryClient = useQueryClient();
  const query = useExceptions(positionId);
  const [outcomeFor, setOutcomeFor] = useState<InterviewExceptionRow | null>(null);
  const [outcome, setOutcome] = useState<InterviewOutcome>("completed");
  const [reason, setReason] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["interview-exceptions"] });

  const nudge = useMutation({
    mutationFn: (vars: { interview_id: string; kind: "confirmation" | "scorecard" }) =>
      nudgeInterview({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.kind === "confirmation" ? "Confirmation nudge recorded" : "Scorecard chase recorded",
      );
      void invalidate();
    },
    onError: (e: unknown) =>
      toast.error("Could not record the nudge", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const record = useMutation({
    mutationFn: (vars: { interview_id: string; outcome: InterviewOutcome; reason: string }) =>
      recordInterviewOutcomeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Outcome recorded", { description: "Status history updated." });
      setOutcomeFor(null);
      setReason("");
      void invalidate();
    },
    onError: (e: unknown) =>
      toast.error("Could not record the outcome", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  if (query.isPending) {
    return (
      <section className="rounded-lg border p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <h3 className="font-medium">Interview exceptions could not be loaded</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.error instanceof Error ? query.error.message : "Unexpected error."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const { rows, cancellations_7d } = query.data;

  return (
    <section className="rounded-lg border" data-qa="interview-exceptions">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h3 className="font-medium">Interviews</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Unconfirmed within 24h of the slot, completed over 24h ago with no scorecard, or two or
            more reschedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={rows.length > 0 ? "destructive" : "secondary"}>
            {rows.length} exception{rows.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">{cancellations_7d} cancelled (7d)</Badge>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No interview exceptions</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.interview_id} className="flex flex-wrap gap-4 p-4">
              <div className="min-w-[16rem] flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.kinds.map((k) => (
                    <Badge key={k} variant="destructive">
                      {EXCEPTION_LABEL[k]}
                    </Badge>
                  ))}
                  <Badge variant="outline">{r.status}</Badge>
                  {r.reschedule_count > 0 && (
                    <Badge variant="secondary">{r.reschedule_count} reschedules</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium">
                  {r.candidate_match_id ? (
                    <Link
                      to="/admin/candidates/$id"
                      params={{ id: r.candidate_match_id }}
                      className="hover:underline"
                    >
                      {r.candidate_name}
                    </Link>
                  ) : (
                    r.candidate_name
                  )}
                  {" · "}
                  <Link
                    to="/admin/positions/$id"
                    params={{ id: r.position_id }}
                    className="text-muted-foreground hover:underline"
                  >
                    {r.position_title}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.organization_name}
                  {r.interview_type ? ` · ${r.interview_type}` : ""}
                  {r.interviewer ? ` · ${r.interviewer}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.status === "completed"
                    ? `Completed ${fmt(r.completed_at)}${
                        r.hours_since_completed != null
                          ? ` (${Math.round(r.hours_since_completed)}h ago)`
                          : ""
                      }`
                    : `Slot ${fmt(r.scheduled_at)}${r.timezone ? ` ${r.timezone}` : ""} · ${
                        r.confirmation_state === "awaiting"
                          ? "awaiting confirmation"
                          : r.confirmation_state
                      }`}
                </p>
                {(r.last_confirmation_nudge_at || r.last_scorecard_chase_at) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.last_confirmation_nudge_at &&
                      `Last confirmation nudge ${fmt(r.last_confirmation_nudge_at)}. `}
                    {r.last_scorecard_chase_at &&
                      `Last scorecard chase ${fmt(r.last_scorecard_chase_at)}.`}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-start gap-2">
                {r.kinds.includes("unconfirmed") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!r.nudge_allowed || nudge.isPending}
                    title={r.nudge_allowed ? undefined : "Already nudged in the last 24 hours"}
                    onClick={() =>
                      nudge.mutate({ interview_id: r.interview_id, kind: "confirmation" })
                    }
                  >
                    Nudge for confirmation
                  </Button>
                )}
                {r.kinds.includes("missing_scorecard") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!r.chase_allowed || nudge.isPending}
                    title={r.chase_allowed ? undefined : "Already chased in the last 24 hours"}
                    onClick={() =>
                      nudge.mutate({ interview_id: r.interview_id, kind: "scorecard" })
                    }
                  >
                    Chase scorecard
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOutcomeFor(r);
                    setOutcome("needs_rescheduling");
                    setReason("");
                  }}
                >
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setOutcomeFor(r);
                    setOutcome(r.status === "completed" ? "completed" : "no_show");
                    setReason("");
                  }}
                >
                  Record outcome
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!outcomeFor} onOpenChange={(open) => !open && setOutcomeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record interview outcome</DialogTitle>
            <DialogDescription>
              {outcomeFor
                ? `${outcomeFor.candidate_name} · ${outcomeFor.position_title}. This writes status history; nothing is sent to the candidate.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="iv-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as InterviewOutcome)}>
                <SelectTrigger id="iv-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-reason">
                Reason <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="iv-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What happened, in one line"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 3 || record.isPending}
              onClick={() =>
                outcomeFor &&
                record.mutate({
                  interview_id: outcomeFor.interview_id,
                  outcome,
                  reason: reason.trim(),
                })
              }
            >
              Save outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

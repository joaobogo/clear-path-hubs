/**
 * Processing exceptions board.
 *
 * Reads real processing_jobs rows. Retry re-enqueues through the existing
 * worker path — the UI never edits pipeline state directly.
 */
import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getProcessingExceptions,
  markProcessingJobPermanentlyFailed,
  retryPositionProcessingExceptions,
  retryProcessingException,
} from "@/lib/admin-processing-exceptions.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Ban, Loader2, RefreshCw, RotateCw } from "lucide-react";

type Board = Awaited<ReturnType<typeof getProcessingExceptions>>;
type Row = Board["active"][number];

const REASON_TONE: Record<string, string> = {
  failed: "border-destructive/40 text-destructive",
  stuck_queued: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  attempt_ceiling: "border-destructive/40 text-destructive",
};

function ageLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

export function ProcessingExceptionsBoard({ className }: { className?: string }) {
  const qc = useQueryClient();
  const queryKey = ["admin", "processing-exceptions"] as const;
  const query = useQuery<Board>({
    queryKey,
    queryFn: () => getProcessingExceptions(),
    staleTime: 20_000,
  });

  const retryFn = useServerFn(retryProcessingException);
  const retryPositionFn = useServerFn(retryPositionProcessingExceptions);
  const failFn = useServerFn(markProcessingJobPermanentlyFailed);

  const [failFor, setFailFor] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const retry = useMutation({
    mutationFn: (jobId: string) => retryFn({ data: { job_id: jobId } }),
    onSuccess: async (r) => {
      if (r.result === "requeued") toast.success(r.detail);
      else toast.message(r.detail);
      await invalidate();
    },
    onError: (e: Error) => toast.error(`Retry failed: ${e.message}`),
  });

  const retryPosition = useMutation({
    mutationFn: (positionId: string) => retryPositionFn({ data: { position_id: positionId } }),
    onSuccess: async ({ outcomes }) => {
      const requeued = outcomes.filter((o) => o.result === "requeued").length;
      toast.success(
        `${requeued} of ${outcomes.length} job${outcomes.length === 1 ? "" : "s"} re-enqueued.`,
      );
      await invalidate();
    },
    onError: (e: Error) => toast.error(`Retry failed: ${e.message}`),
  });

  const markFailed = useMutation({
    mutationFn: (v: { job_id: string; reason: string }) => failFn({ data: v }),
    onSuccess: async () => {
      toast.success("Marked permanently failed. It stays visible in history.");
      setFailFor(null);
      setReason("");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const board = query.data;
  const active = board?.active ?? [];
  const permanent = board?.permanent ?? [];

  // Position grouping powers the "retry all failed for a position" action.
  const positionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of active) if (r.position_id) map.set(r.position_id, (map.get(r.position_id) ?? 0) + 1);
    return map;
  }, [active]);

  return (
    <section className={`rounded-lg border bg-card ${className ?? ""}`} aria-label="Processing exceptions">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Processing exceptions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Failed jobs, jobs queued longer than {board?.rules.stuck_queued_minutes ?? 15} minutes,
            and jobs at the {board?.rules.attempt_ceiling ?? 3}-attempt ceiling. Retry re-enqueues
            through the existing worker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {board ? (
            <Badge variant="outline" className="text-xs font-normal">
              {board.scoring_orphans} scoring orphan{board.scoring_orphans === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {query.isPending ? (
        <div className="divide-y" aria-busy="true" aria-label="Loading processing exceptions">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">
                Processing exceptions could not be loaded
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {query.error instanceof Error ? query.error.message : "Unknown error"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
                onClick={() => query.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : active.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">
            No processing exceptions in the last {board?.window_days ?? 7} days
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The board fills only when the worker leaves a job failed or unclaimed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-medium">Job</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Candidate · Position</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Why</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Attempts</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Age</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {active.map((r) => (
                <Fragment key={r.job_id}>
                  <tr className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{r.job_type}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.status} · {r.entity_type}
                      </p>
                      {r.trace_id ? (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {r.trace_id}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {r.match_id ? (
                        <Link
                          to="/admin/candidates/$id"
                          params={{ id: r.match_id }}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {r.candidate_name ?? "Candidate"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">No candidate record</span>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.position_title ?? "Position unknown"}
                        {r.organization_name ? ` · ${r.organization_name}` : ""}
                      </p>
                      {r.processing_state ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          State: {r.processing_state.replace(/_/g, " ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[26rem] px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.reasons.map((reasonKey) => (
                          <Badge
                            key={reasonKey}
                            variant="outline"
                            className={`text-[10px] font-normal ${REASON_TONE[reasonKey] ?? ""}`}
                          >
                            {reasonKey.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      {r.error_code ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {r.error_code}
                        </p>
                      ) : null}
                      {r.error_message ? (
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {r.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.attempts}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{ageLabel(r.age_minutes)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          disabled={!r.retryable || retry.isPending}
                          title={
                            r.retryable
                              ? "Re-enqueue for the existing worker"
                              : "No application row behind this job"
                          }
                          onClick={() => retry.mutate(r.job_id)}
                        >
                          {retry.isPending && retry.variables === r.job_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5" />
                          )}
                          Retry
                        </Button>
                        {r.position_id && (positionCounts.get(r.position_id) ?? 0) > 1 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={retryPosition.isPending}
                            onClick={() => retryPosition.mutate(r.position_id!)}
                          >
                            Retry all {positionCounts.get(r.position_id)}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs text-muted-foreground"
                          onClick={() => {
                            setFailFor(r);
                            setReason("");
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Mark failed
                        </Button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {permanent.length > 0 ? (
        <div className="border-t px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Permanently failed ({permanent.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {permanent.map((r) => (
              <li key={r.job_id} className="text-xs">
                <span className="font-medium">{r.job_type}</span>
                {" · "}
                {r.match_id ? (
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: r.match_id }}
                    className="underline-offset-2 hover:underline"
                  >
                    {r.candidate_name ?? "Candidate"}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">No candidate record</span>
                )}
                {r.position_title ? ` · ${r.position_title}` : ""}
                <p className="mt-0.5 text-muted-foreground">
                  {r.permanent_reason ?? "No reason recorded"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={!!failFor} onOpenChange={(o) => !o && setFailFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark permanently failed</DialogTitle>
            <DialogDescription>
              The job stops being retryable and stays listed in history with your reason. No
              pipeline state is changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="permanent-fail-reason">Reason (required)</Label>
            <Textarea
              id="permanent-fail-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why this job cannot succeed — e.g. the CV file is corrupt and the candidate withdrew."
            />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 10 || markFailed.isPending}
              onClick={() =>
                failFor && markFailed.mutate({ job_id: failFor.job_id, reason: reason.trim() })
              }
            >
              {markFailed.isPending ? "Saving…" : "Mark permanently failed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

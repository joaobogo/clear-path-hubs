/**
 * Grouped scoring review list.
 *
 * Rows arrive already grouped by the server's derived `blocking` flag
 * (position has an open client commitment due within 3 days). Claims hide a
 * review from every other reviewer; stale claims (>2h) are ignored and can be
 * released in bulk.
 *
 * One primary action per row — "Open review". Claiming is a secondary control,
 * and rows keep the keyboard path (j/k/Enter/o) shared by every admin queue.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  claimScoringReview,
  listReviewTriage,
  releaseScoringReview,
  releaseStaleScoringClaims,
} from "@/lib/scoring-review-triage.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ds";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveQueueState, resolveQueueVariant } from "@/lib/empty-states/queue-states";
import { QueueShortcuts } from "@/components/admin/queue-shortcuts";
import {
  QUEUE_ROW_ACTIVE_CLASS,
  useQueueKeyboard,
  type QueueKeyboard,
} from "@/lib/admin/queue-keyboard";
import { AlertTriangle, Clock, Loader2, Lock, TimerReset } from "lucide-react";

type Triage = Awaited<ReturnType<typeof listReviewTriage>>;
type Row = Triage["rows"][number];


export function ReviewTriageList({
  queue,
  q,
  sort,
  page,
  pageSize,
  onPageChange,
}: {
  queue: string;
  q: string;
  sort: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const qc = useQueryClient();
  const queryKey = ["review-triage", queue, q, sort, page] as const;
  const list = useQuery<Triage>({
    queryKey,
    queryFn: () =>
      listReviewTriage({
        data: {
          queue,
          ...(q ? { q } : {}),
          sort: sort as never,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
      }),
    staleTime: 15_000,
  });

  const claimFn = useServerFn(claimScoringReview);
  const releaseFn = useServerFn(releaseScoringReview);
  const releaseStaleFn = useServerFn(releaseStaleScoringClaims);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["review-triage"] });
    void qc.invalidateQueries({ queryKey: ["review-queue-counts"] });
  };

  const claim = useMutation({
    mutationFn: (matchId: string) => claimFn({ data: { match_id: matchId } }),
    onSuccess: () => {
      toast.success("Review claimed — it is hidden from other reviewers");
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not claim this review" }),
  });

  const release = useMutation({
    mutationFn: (matchId: string) => releaseFn({ data: { match_id: matchId } }),
    onSuccess: () => {
      toast.success("Claim released");
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not release the claim" }),
  });

  const releaseStale = useMutation({
    mutationFn: () => releaseStaleFn({}),
    onSuccess: (res) => {
      toast.success(
        res.released === 0
          ? "No stale claims to release"
          : `${res.released} stale claim(s) released`,
      );
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not release stale claims" }),
  });

  if (list.isError) {
    return (
      <ErrorState
        title="We couldn't load this queue"
        description="The review queue didn't come back. Nothing is lost — try again."
        onRetry={() => void list.refetch()}
      />
    );
  }

  if (list.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading review queue">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const data = list.data!;
  const blocking = data.rows.filter((r) => r.blocking);
  const standard = data.rows.filter((r) => !r.blocking);
  const pages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {data.total} in queue · {data.blocking_count} blocking a client deliverable
          {data.hidden_claimed_count > 0
            ? ` · ${data.hidden_claimed_count} claimed by other reviewers`
            : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => releaseStale.mutate()}
          disabled={releaseStale.isPending}
          title="Release every claim older than 2 hours"
        >
          {releaseStale.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TimerReset className="h-3.5 w-3.5" />
          )}
          Release stale claims{data.stale_claim_count > 0 ? ` (${data.stale_claim_count})` : ""}
        </Button>
      </div>

      {data.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Review queue clear.</Card>
      ) : (
        <>
          <Group
            title="Blocking a client deliverable"
            hint="The position has an open commitment due within 3 days."
            tone="danger"
            rows={blocking}
            onClaim={(id) => claim.mutate(id)}
            onRelease={(id) => release.mutate(id)}
            busyId={
              claim.isPending
                ? (claim.variables ?? null)
                : release.isPending
                  ? (release.variables ?? null)
                  : null
            }
            queue={queue}
            q={q}
            sort={sort}
            page={page}
          />
          <Group
            title="Standard review"
            hint="No commitment due in the next 3 days."
            tone="default"
            rows={standard}
            onClaim={(id) => claim.mutate(id)}
            onRelease={(id) => release.mutate(id)}
            busyId={
              claim.isPending
                ? (claim.variables ?? null)
                : release.isPending
                  ? (release.variables ?? null)
                  : null
            }
            queue={queue}
            q={q}
            sort={sort}
            page={page}
          />
        </>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Group({
  title,
  hint,
  tone,
  rows,
  onClaim,
  onRelease,
  busyId,
  queue,
  q,
  sort,
  page,
}: {
  title: string;
  hint: string;
  tone: "danger" | "default";
  rows: Row[];
  onClaim: (matchId: string) => void;
  onRelease: (matchId: string) => void;
  busyId: string | null;
  queue: string;
  q: string;
  sort: string;
  page: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2" aria-label={title}>
      <header className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.match_id}
            className={`rounded-lg border bg-card px-4 py-3 ${
              tone === "danger" ? "border-destructive/40" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {r.blocking ? (
                    <span className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Blocking
                      {r.commitment_days_left !== null
                        ? r.commitment_days_left < 0
                          ? ` · ${Math.abs(r.commitment_days_left)}d overdue`
                          : ` · due in ${r.commitment_days_left}d`
                        : ""}
                    </span>
                  ) : null}
                  <p className="truncate text-sm font-medium">{r.candidate_name}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.position_title} · {r.client_name}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {r.score_band ?? "no band"}
                  {r.final_score !== null ? ` · ${r.final_score}` : ""}
                </Badge>
                <span title="Evidence items resolved">
                  evidence{" "}
                  {r.evidence_completeness === null
                    ? "—"
                    : `${Math.round(r.evidence_completeness * 100)}%`}
                  {r.evidence_items > 0 ? ` (${r.evidence_resolved}/${r.evidence_items})` : ""}
                </span>
                <span className="inline-flex items-center gap-1" title="Hours since scored">
                  <Clock className="h-3 w-3" />
                  {r.hours_since_scored === null ? "not scored" : `${r.hours_since_scored}h`}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {r.claim?.is_mine ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Claimed by you
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={busyId === r.match_id}
                      onClick={() => onRelease(r.match_id)}
                    >
                      Release
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={busyId === r.match_id}
                    onClick={() => onClaim(r.match_id)}
                  >
                    {busyId === r.match_id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Claim
                  </Button>
                )}
                <Button asChild size="sm" className="h-7 text-xs">
                  <Link
                    to="/admin/scoring/review/$matchId"
                    params={{ matchId: r.match_id }}
                    search={{ queue, q, sort, page }}
                  >
                    Open review
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Needs attention" queue — the five-or-so open roles that are actually stalling.
 *
 * Reasons are derived server-side and shown as labelled chips. No score, no
 * ranking by drag, no auto-close.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import {
  getPositionsNeedingAttention,
  listPositionOwnerOptions,
  markPositionReviewed,
  reassignPositionOwner,
} from "@/lib/admin-attention.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { ArrowUpRight, Check } from "lucide-react";

type Queue = Awaited<ReturnType<typeof getPositionsNeedingAttention>>;
type Row = Queue["rows"][number];
type Reason = Row["reasons"][number];

const REASON_TEXT: Record<Reason, string> = {
  no_new_candidates: "No new candidate in 7 days",
  zero_submissions: "Zero submissions, open > 10 days",
  no_client_decision: "No client decision in 5 days",
  published_without_owner: "Published without an owner",
  payment_gate: "Payment gate blocking publish",
};

const UNASSIGNED = "__unassigned__";

function ReasonChip({ reason }: { reason: Reason }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
      {REASON_TEXT[reason]}
    </span>
  );
}

export function PositionsAttentionQueue({ includeTest }: { includeTest: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getPositionsNeedingAttention);
  const loadOwners = useServerFn(listPositionOwnerOptions);
  const review = useServerFn(markPositionReviewed);
  const reassign = useServerFn(reassignPositionOwner);

  const queue = useQuery({
    queryKey: ["admin", "positions-attention", includeTest],
    queryFn: () => load({ data: { include_test: includeTest } }),
    staleTime: 30_000,
  });

  const owners = useQuery({
    queryKey: ["admin", "position-owner-options"],
    queryFn: () => loadOwners(),
    staleTime: 5 * 60_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "positions-attention"] });

  const reviewMutation = useMutation({
    mutationFn: (position_id: string) => review({ data: { position_id } }),
    onSuccess: () => {
      toast.success("Marked reviewed — hidden until tomorrow (UTC)");
      void invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not save the review" }),
  });

  const ownerMutation = useMutation({
    mutationFn: (v: { position_id: string; owner_user_id: string | null }) =>
      reassign({ data: v }),
    onSuccess: () => {
      toast.success("Owner updated");
      void invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not reassign the owner" }),
  });

  const data = queue.data;

  return (
    <PanelState
      query={queue}
      isEmpty={(data?.rows.length ?? 0) === 0}
      empty={
        <div className="rounded-lg border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">No jobs need attention right now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data ? `${data.checked.toLocaleString()} open job${data.checked === 1 ? "" : "s"} checked` : ""}
            {data && data.reviewed_today > 0 ? ` · ${data.reviewed_today} marked reviewed today` : ""}
          </p>
        </div>
      }
    >
    {data && (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data.rows.length} of {data.checked.toLocaleString()} open jobs need attention
        {data.reviewed_today > 0 ? ` · ${data.reviewed_today} reviewed today and hidden` : ""}
      </p>

      {data.rows.map((row) => (
        <AttentionCard
          key={row.position_id}
          row={row}
          owners={owners.data ?? []}
          ownersError={owners.isError}
          busy={
            (reviewMutation.isPending && reviewMutation.variables === row.position_id) ||
            (ownerMutation.isPending && ownerMutation.variables?.position_id === row.position_id)
          }
          onReview={() => reviewMutation.mutate(row.position_id)}
          onOwnerChange={(owner_user_id) =>
            ownerMutation.mutate({ position_id: row.position_id, owner_user_id })
          }
        />
      ))}
    </div>
    )}
    </PanelState>
  );
}

function AttentionCard({
  row,
  owners,
  ownersError,
  busy,
  onReview,
  onOwnerChange,
}: {
  row: Row;
  owners: Array<{ user_id: string; name: string }>;
  ownersError: boolean;
  busy: boolean;
  onReview: () => void;
  onOwnerChange: (ownerUserId: string | null) => void;
}) {
  const [owner, setOwner] = useState(row.owner_user_id ?? UNASSIGNED);

  return (
    <article className="rounded-lg border bg-card p-4" data-position-id={row.position_id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/admin/positions/$id"
            params={{ id: row.position_id }}
            className="text-sm font-medium hover:underline"
          >
            {row.title}
          </Link>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <Link
              to="/admin/clients/$id"
              params={{ id: row.organization_id }}
              className="hover:underline"
            >
              {row.organization_name}
            </Link>
            {" · "}
            {row.days_open} day{row.days_open === 1 ? "" : "s"} open
            {row.is_test_record ? " · test" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {row.status.replace(/_/g, " ")}
            {row.published_at ? " · published" : " · not published"}
            {row.payment_status ? ` · ${row.payment_status}` : ""}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.reasons.map((r) => (
          <ReasonChip key={r} reason={r} />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt className="inline">Sourced </dt>
          <dd className="inline font-medium text-foreground tabular-nums">
            {row.candidates_sourced}
          </dd>
        </div>
        <div>
          <dt className="inline">Submitted </dt>
          <dd className="inline font-medium text-foreground tabular-nums">
            {row.submitted_to_client}
          </dd>
        </div>
        <div>
          <dt className="inline">In interview </dt>
          <dd className="inline font-medium text-foreground tabular-nums">{row.in_interview}</dd>
        </div>
        <div>
          <dt className="inline">Last movement </dt>
          <dd className="inline font-medium text-foreground">
            {row.last_movement_at
              ? new Date(row.last_movement_at).toLocaleDateString()
              : "none yet"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select
          value={owner}
          disabled={busy || ownersError}
          onValueChange={(v) => {
            setOwner(v);
            onOwnerChange(v === UNASSIGNED ? null : v);
          }}
        >
          <SelectTrigger
            className="h-8 w-full text-xs sm:w-56"
            aria-label={`Recruiter owner for ${row.title}`}
          >
            <SelectValue placeholder={ownersError ? "Owners unavailable" : "Unassigned"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.user_id} value={o.user_id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={onReview}
          data-qa-action="mark-reviewed"
        >
          <Check className="h-3.5 w-3.5" />
          Reviewed today
        </Button>

        <Button asChild size="sm" variant="secondary" className="ml-auto h-8 text-xs">
          <Link to="/admin/positions/$id" params={{ id: row.position_id }}>
            Open <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

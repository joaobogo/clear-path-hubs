/**
 * Workload table — how open roles and active candidates are distributed across
 * platform staff, plus an "Unassigned" aggregate for ownerless open roles.
 *
 * Deliberately not a leaderboard: no ranking badges, no productivity score, no
 * activity feed. Just counts, an owner reassignment, and links into the
 * filtered position list.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  getRecruiterWorkload,
  listOwnedOpenPositions,
} from "@/lib/admin-workload.functions";
import {
  listPositionOwnerOptions,
  reassignPositionOwner,
} from "@/lib/admin-attention.functions";
import { Card } from "@/components/ui/card";
import { humanizeCode } from "@/lib/humanize-codes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/ds";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { TestScopeEmptyNote } from "@/components/admin/test-records-toggle";
import { useScopedIncludeTest } from "@/lib/admin-scope";

const UNASSIGNED = "__unassigned__";

type Workload = Awaited<ReturnType<typeof getRecruiterWorkload>>;
type Row = Workload["rows"][number];

export function WorkloadTable({ includeTest: explicit }: { includeTest?: boolean } = {}) {
  // Falls back to the admin-wide scope instead of a hardcoded false.
  const includeTest = useScopedIncludeTest(explicit);
  const load = useServerFn(getRecruiterWorkload);
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "recruiter-workload", includeTest],
    queryFn: () => load({ data: { include_test: includeTest } }),
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Workload</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open roles owned, active candidates, and what has gone quiet. Counts
            come straight from positions, matches and tasks.
          </p>
        </div>
        {q.data && (
          <p className="text-xs text-muted-foreground">
            {q.data.totals.open_positions} open role
            {q.data.totals.open_positions === 1 ? "" : "s"} ·{" "}
            {q.data.totals.active_candidates} active candidates ·{" "}
            {q.data.totals.submissions_this_week} submitted this week
          </p>
        )}
      </div>

      <PanelState
        query={q}
        isEmpty={(q.data?.rows ?? []).length === 0}
        empty={<PanelEmpty className="mt-6" title="No staff with active assignments" />}
      >
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Open positions and pipeline load per staff member
            </caption>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Owner</th>
                <th className="py-2 text-right">Open roles</th>
                <th className="py-2 text-right">Active candidates</th>
                <th className="py-2 text-right">Submitted 7d</th>
                <th className="py-2 text-right">Scoring reviews</th>
                <th className="py-2 text-right">Overdue tasks</th>
                <th className="py-2">Oldest untouched</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.rows ?? []).map((row) => (
                <WorkloadRowView
                  key={row.key}
                  row={row}
                  includeTest={includeTest}
                  expanded={open === row.key}
                  onToggle={() => setOpen(open === row.key ? null : row.key)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>
    </Card>
  );
}

function WorkloadRowView({
  row,
  includeTest,
  expanded,
  onToggle,
}: {
  row: Row;
  includeTest: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const oldest = row.oldest_untouched;
  return (
    <>
      <tr className={`border-t ${row.is_unassigned ? "bg-warning/5" : ""}`}>
        <td className="py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-left font-medium hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {row.name}
          </button>
          {row.is_unassigned ? (
            <Badge variant="outline" className="ml-2 text-[10px]">
              No owner assigned
            </Badge>
          ) : row.role ? (
            <span className="ml-2 text-xs text-muted-foreground">{humanizeCode(row.role)}</span>
          ) : null}
        </td>
        <td className="py-2.5 text-right tabular-nums">{row.open_positions}</td>
        <td className="py-2.5 text-right tabular-nums">{row.active_candidates}</td>
        <td className="py-2.5 text-right tabular-nums">{row.submissions_this_week}</td>
        <td className="py-2.5 text-right tabular-nums">{row.pending_scoring_reviews}</td>
        <td className="py-2.5 text-right tabular-nums">
          {row.is_unassigned ? (
            <span className="text-muted-foreground">—</span>
          ) : row.overdue_tasks > 0 ? (
            <span className="font-medium text-warning-foreground">{row.overdue_tasks}</span>
          ) : (
            0
          )}
        </td>
        <td className="py-2.5">
          {oldest ? (
            <Link
              to="/admin/positions/$id"
              params={{ id: oldest.position_id }}
              className="hover:underline"
            >
              {oldest.title}
              <span className="text-muted-foreground">
                {" "}
                · {oldest.days_untouched}d
                {oldest.organization_name ? ` · ${oldest.organization_name}` : ""}
              </span>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2.5 text-right">
          <Button asChild size="sm" variant="outline">
            <Link
              to="/admin/positions"
              search={{ owner: row.is_unassigned ? UNASSIGNED : row.key }}
            >
              Positions <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/30">
          <td colSpan={8} className="p-4">
            <OwnedPositions owner={row.key} includeTest={includeTest} />
          </td>
        </tr>
      )}
    </>
  );
}

function OwnedPositions({ owner, includeTest }: { owner: string; includeTest: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(listOwnedOpenPositions);
  const loadOwners = useServerFn(listPositionOwnerOptions);
  const reassign = useServerFn(reassignPositionOwner);

  const list = useQuery({
    queryKey: ["admin", "workload-positions", owner, includeTest],
    queryFn: () => load({ data: { owner, include_test: includeTest } }),
  });
  const owners = useQuery({
    queryKey: ["admin", "position-owner-options"],
    queryFn: () => loadOwners(),
    staleTime: 60_000,
  });

  const mut = useMutation({
    mutationFn: (input: { position_id: string; owner_user_id: string | null }) =>
      reassign({ data: input }),
    onSuccess: () => {
      toast.success("Owner reassigned");
      void queryClient.invalidateQueries({ queryKey: ["admin", "recruiter-workload"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "workload-positions"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const rows = list.data ?? [];

  return (
    <PanelState
      query={list}
      isEmpty={rows.length === 0}
      empty={
        <div>
          <PanelEmpty title="No open positions." />
          <TestScopeEmptyNote />
        </div>
      }
    >
      <ul className="space-y-2">
        {rows.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/admin/positions/$id"
              params={{ id: p.id }}
              className="font-medium hover:underline"
            >
              {p.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {p.organization_name ?? "—"} · {p.status}
            </span>
          </div>
          <Select
            value={p.owner_user_id ?? UNASSIGNED}
            disabled={mut.isPending}
            onValueChange={(v) =>
              mut.mutate({
                position_id: p.id,
                owner_user_id: v === UNASSIGNED ? null : v,
              })
            }
          >
            <SelectTrigger className="h-8 w-[210px] text-xs" aria-label={`Owner for ${p.title}`}>
              <SelectValue placeholder="Assign owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {(owners.data ?? []).map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </li>
        ))}
      </ul>
    </PanelState>
  );
}

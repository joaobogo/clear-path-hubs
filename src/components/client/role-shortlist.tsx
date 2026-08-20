import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateCard } from "@/components/client/candidate-card";
import { getClientCandidates } from "@/lib/client-candidates.functions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RoleComparePanel } from "@/components/client/role-compare-panel";
import { ROLE_COMPARE_MAX, roleCompareDisabledReason } from "@/lib/client-compare";
import { AlertCircle, Columns3 } from "lucide-react";
import { formatDate } from "@/lib/format/datetime";

function shortlistDate(iso: string | null | undefined): string | null {
  return formatDate(iso) || null;
}

/**
 * Delivered candidates for one role, on the standard shortlist card:
 * verified evidence bullets, stage, days waiting, availability. No scores.
 */
export function RoleShortlist({
  orgId,
  positionId,
  firstShortlistExpectedAt,
}: {
  orgId: string | null;
  positionId: string;
  firstShortlistExpectedAt?: string | null;
}) {
  const fetchCandidates = useServerFn(getClientCandidates);
  const q = useQuery({
    queryKey: ["client", "position-shortlist", orgId, positionId],
    enabled: Boolean(orgId),
    queryFn: () => fetchCandidates({ data: { orgId: orgId!, positionId } }),
  });

  // Compare selection — capped at three, cleared when the panel closes.
  const [selected, setSelected] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const disabledReason = roleCompareDisabledReason(selected.length);
  const selectedCandidates = (q.data ?? []).filter((c) => selected.includes(c.match_id));

  const toggle = (matchId: string) => {
    setSelected((prev) => {
      if (prev.includes(matchId)) return prev.filter((id) => id !== matchId);
      if (prev.length >= ROLE_COMPARE_MAX) return prev;
      return [...prev, matchId];
    });
  };

  const closeCompare = () => {
    setCompareOpen(false);
    setSelected([]);
  };

  return (
    <section aria-label="Shortlist" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shortlist</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Evidence from your brief · Client-visible only
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(disabledReason)}
                    onClick={() => setCompareOpen(true)}
                  >
                    <Columns3 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Compare{selected.length > 0 ? ` (${selected.length})` : ""}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {disabledReason ?? `Compare ${selected.length} candidates side by side`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {q.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
            <div>
              <p className="text-sm font-medium">Shortlist unavailable</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We could not load candidates for this role.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void q.refetch()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : q.isLoading || !q.data ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-10/12" />
              </div>
              <Skeleton className="mt-4 h-8 w-24" />
            </div>
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No candidates delivered yet</p>
          <p className="mt-1">
            {formatDate(firstShortlistExpectedAt)
              ? `First shortlist expected by ${formatDate(firstShortlistExpectedAt)}.`
              : "Date confirmed once sourcing starts."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((c) => {
            const isSelected = selected.includes(c.match_id);
            const atCap = !isSelected && selected.length >= ROLE_COMPARE_MAX;
            return (
              <div key={c.match_id} className="relative">
                <label className="mb-1.5 flex min-h-11 items-center gap-2 text-xs text-muted-foreground sm:min-h-0">
                  <Checkbox
                    checked={isSelected}
                    disabled={atCap}
                    onCheckedChange={() => toggle(c.match_id)}
                    aria-label={`Select ${c.candidate.display_name} to compare`}
                    className="touch-target"
                  />
                  {atCap ? `Compare limit is ${ROLE_COMPARE_MAX}` : "Compare"}
                </label>
                <CandidateCard candidate={c} />
              </div>
            );
          })}
        </div>
      )}
      <RoleComparePanel
        open={compareOpen}
        onOpenChange={(o) => (o ? setCompareOpen(true) : closeCompare())}
        candidates={selectedCandidates}
        isLoading={q.isFetching && selectedCandidates.length === 0}
        error={q.isError ? q.error : null}
        onRetry={() => void q.refetch()}
      />
    </section>
  );
}

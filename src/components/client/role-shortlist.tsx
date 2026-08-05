import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateCard } from "@/components/client/candidate-card";
import { getClientCandidates } from "@/lib/client.functions";
import { AlertCircle } from "lucide-react";

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

  return (
    <section aria-label="Shortlist" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shortlist</h2>
        <span className="text-xs text-muted-foreground">
          Evidence from your brief · Client-visible only
        </span>
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
          {q.data.map((c) => (
            <CandidateCard key={c.match_id} candidate={c} />
          ))}
        </div>
      )}
    </section>
  );
}

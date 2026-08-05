/**
 * "Previously considered" — earlier candidates for this client, suggested for
 * this brief by must-have overlap.
 *
 * Read-only by design. There is no score on screen, no re-approach button, and
 * every person listed was already visible to this client for an earlier role.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Pause, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/client/states";
import { listPreviouslyConsidered } from "@/lib/previously-considered.functions";

export function PreviouslyConsidered({
  orgId,
  positionId,
}: {
  orgId: string;
  positionId: string;
}) {
  const listFn = useServerFn(listPreviouslyConsidered);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["previously-considered", orgId, positionId],
    queryFn: () => listFn({ data: { orgId, positionId } }),
  });
  const rows = data?.candidates ?? [];

  return (
    <section aria-label="Previously considered" className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em]">
          <History className="h-4 w-4 text-primary" aria-hidden />
          Previously considered
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          People you already saw for an earlier role, suggested here because
          their brief shared must-haves with this one. Tell your recruiting team
          if you want any of them revisited — nobody is contacted automatically.
        </p>
      </header>

      {isPending ? (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-lg border bg-muted/50" />
          ))}
        </ul>
      ) : isError ? (
        <ErrorState
          title="We couldn't load earlier candidates"
          onRetry={() => void refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No earlier candidates match this brief.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.candidate_profile_id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.candidate_name}</p>
                  {r.headline && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.headline}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.decision_label} for{" "}
                    <span className="font-medium text-foreground">{r.prior_position_title}</span>{" "}
                    · {r.when_label}
                    {r.reason_label ? ` · ${r.reason_label}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.suggested_because}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
                  {r.decision === "hold" ? (
                    <Pause className="h-3 w-3" aria-hidden />
                  ) : (
                    <XCircle className="h-3 w-3" aria-hidden />
                  )}
                  {r.decision === "hold" ? "On hold" : "Passed"}
                </Badge>
              </div>
              {r.overlap.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.overlap.slice(0, 6).map((label) => (
                    <Badge key={label} variant="secondary" className="text-[10px] font-normal">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

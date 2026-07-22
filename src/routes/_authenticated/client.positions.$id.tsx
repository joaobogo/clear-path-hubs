import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  getClientContext,
  getClientPositionDetail,
  moveMatchStage,
  type MatchStage,
} from "@/lib/client.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/client/positions/$id")({
  head: () => ({
    meta: [
      { title: "Position · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="p-8">Position not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load: {error.message}</div>
  ),
  component: PositionDetailPage,
});

const KANBAN_COLUMNS: { key: MatchStage; label: string }[] = [
  { key: "delivered", label: "Delivered" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_process", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "not_moving_forward", label: "Not moving forward" },
];

const NEXT_STAGE: Partial<Record<MatchStage, { to: MatchStage; label: string }[]>> = {
  delivered: [
    { to: "shortlisted", label: "Shortlist" },
    { to: "not_moving_forward", label: "Not moving forward" },
  ],
  shortlisted: [
    { to: "interview_process", label: "Request interview" },
    { to: "not_moving_forward", label: "Not moving forward" },
  ],
  interview_process: [
    { to: "offer", label: "Make offer" },
    { to: "not_moving_forward", label: "Not moving forward" },
  ],
  offer: [
    { to: "hired", label: "Mark hired" },
    { to: "not_moving_forward", label: "Not moving forward" },
  ],
  hired: [],
  not_moving_forward: [{ to: "shortlisted", label: "Reopen to shortlist" }],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const ctxFn = useServerFn(getClientContext);
  const detailFn = useServerFn(getClientPositionDetail);
  const moveFn = useServerFn(moveMatchStage);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const { data, refetch } = useQuery({
    queryKey: ["client-position", orgId, id],
    queryFn: () => detailFn({ data: { orgId: orgId!, positionId: id } }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const move = useMutation({
    mutationFn: (v: { matchId: string; toStage: MatchStage }) =>
      moveFn({ data: { orgId: orgId!, matchId: v.matchId, toStage: v.toStage } }),
    onSuccess: () => {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["client-position", orgId, id] });
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data.position) throw notFound();

  const { position, matches } = data;
  const byStage: Record<string, AnyRow[]> = {};
  for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
  for (const m of matches as AnyRow[]) {
    const s = m.stage as string;
    if (byStage[s]) byStage[s].push(m);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4">
        <Link to="/client/positions" className="text-sm text-muted-foreground hover:underline">
          ← All positions
        </Link>
      </div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{position.title}</h1>
            <Badge variant="secondary" className="capitalize">{position.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {[position.location, position.work_model, position.seniority]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.key} className="rounded-lg bg-muted/40 p-2 min-h-[300px]">
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="text-xs font-medium uppercase tracking-wide">{col.label}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {byStage[col.key].length}
              </div>
            </div>
            <div className="space-y-2">
              {byStage[col.key].map((m) => (
                <div key={m.id} className="rounded border bg-card p-3">
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: m.id }}
                    className="block text-sm font-medium hover:underline"
                  >
                    {m.candidate_profiles?.full_name ?? "Candidate"}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.candidate_profiles?.headline}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {m.score_runs?.score != null && (
                      <span className="tabular-nums">{m.score_runs.score.toFixed(0)}</span>
                    )}
                    {m.score_runs?.fit_label && (
                      <span className="capitalize text-muted-foreground">
                        {m.score_runs.fit_label}
                      </span>
                    )}
                  </div>
                  {(NEXT_STAGE[col.key] ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(NEXT_STAGE[col.key] ?? []).map((n) => (
                        <Button
                          key={n.to}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={move.isPending}
                          onClick={() =>
                            move.mutate({ matchId: m.id, toStage: n.to })
                          }
                        >
                          {n.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {byStage[col.key].length === 0 && (
                <div className="text-xs text-muted-foreground px-1 py-4 text-center">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

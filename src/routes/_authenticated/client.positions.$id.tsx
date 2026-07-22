import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getClientContext,
  getClientPositionDetail,
  moveMatchStage,
  type MatchStage,
} from "@/lib/client.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  { key: "interview_process", label: "Interview Process" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "not_moving_forward", label: "Not Moving Forward" },
];

// Canonical transition matrix (mirrors server STAGE_GRAPH in client.functions.ts).
const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
  delivered: ["shortlisted", "interview_process", "not_moving_forward"],
  shortlisted: ["interview_process", "not_moving_forward"],
  interview_process: ["offer", "shortlisted", "not_moving_forward"],
  offer: ["hired", "not_moving_forward"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

const STAGE_LABELS: Record<MatchStage, string> = {
  delivered: "Delivered",
  shortlisted: "Shortlist",
  interview_process: "Move to Interview Process",
  offer: "Make offer",
  hired: "Mark hired",
  not_moving_forward: "Not moving forward",
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
  const queryKey = ["client-position", orgId, id];
  const { data, refetch } = useQuery({
    queryKey,
    queryFn: () => detailFn({ data: { orgId: orgId!, positionId: id } }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const [dragOver, setDragOver] = useState<MatchStage | null>(null);

  const move = useMutation({
    mutationFn: (v: { matchId: string; toStage: MatchStage }) =>
      moveFn({ data: { orgId: orgId!, matchId: v.matchId, toStage: v.toStage } }),
    // Optimistic update with snapshot for rollback.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<AnyRow>(queryKey);
      qc.setQueryData<AnyRow>(queryKey, (prev: AnyRow) => {
        if (!prev) return prev;
        return {
          ...prev,
          matches: prev.matches.map((m: AnyRow) =>
            m.id === v.matchId ? { ...m, stage: v.toStage } : m,
          ),
        };
      });
      return { snapshot };
    },
    onError: (e: Error, _v, ctx) => {
      // Roll the card back to its original column visually.
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot);
      const raw = e.message.replace(/^Error: /, "");
      const msg = raw.startsWith("invalid_transition")
        ? "That move is not allowed for this stage."
        : raw === "forbidden"
          ? "You do not have permission to move candidates."
          : raw === "match_not_visible"
            ? "This candidate is no longer available."
            : raw;
      toast.error(msg);
    },
    onSuccess: () => {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
    },
    // Always resync with server truth so counts and KPI drift stay at 0.
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data.position) throw notFound();

  const canEdit =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "client_editor" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";

  const { position, matches } = data;
  const byStage: Record<string, AnyRow[]> = {};
  for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
  for (const m of matches as AnyRow[]) {
    const s = m.stage as string;
    if (byStage[s]) byStage[s].push(m);
  }

  const attemptMove = (matchId: string, from: MatchStage, to: MatchStage) => {
    if (from === to) return;
    const allowed = STAGE_GRAPH[from] ?? [];
    if (!allowed.includes(to)) {
      toast.error(`Cannot move from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`);
      return;
    }
    move.mutate({ matchId, toStage: to });
  };

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
          {!canEdit && (
            <div className="mt-2 text-xs text-muted-foreground">
              Read-only view — you do not have edit permission for this workspace.
            </div>
          )}
        </div>
      </header>

      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        role="list"
        aria-label="Candidate pipeline"
      >
        {KANBAN_COLUMNS.map((col) => {
          const isDropTarget = dragOver === col.key;
          return (
            <div
              key={col.key}
              role="listitem"
              aria-label={`${col.label} column, ${byStage[col.key].length} candidates`}
              className={`rounded-lg p-2 min-h-[300px] transition-colors ${
                isDropTarget ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/40"
              }`}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (!canEdit) return;
                const matchId = e.dataTransfer.getData("text/match-id");
                const from = e.dataTransfer.getData("text/from-stage") as MatchStage;
                if (matchId && from) attemptMove(matchId, from, col.key);
              }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="text-xs font-medium uppercase tracking-wide">{col.label}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {byStage[col.key].length}
                </div>
              </div>
              <div className="space-y-2">
                {byStage[col.key].map((m) => {
                  const from = col.key;
                  const allowed = STAGE_GRAPH[from] ?? [];
                  return (
                    <div
                      key={m.id}
                      draggable={canEdit && !move.isPending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/match-id", m.id);
                        e.dataTransfer.setData("text/from-stage", from);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={`rounded border bg-card p-3 ${
                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                      }`}
                    >
                      <Link
                        to="/client/candidates/$id"
                        params={{ id: m.id }}
                        className="block text-sm font-medium hover:underline"
                      >
                        {m.candidate_profiles?.full_name ?? "Candidate"}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.candidate_profiles?.headline ?? ""}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {m.score_runs?.score != null && (
                          <span className="tabular-nums">
                            {Number(m.score_runs.score).toFixed(0)}
                          </span>
                        )}
                        {m.score_runs?.fit_label && (
                          <span className="capitalize text-muted-foreground">
                            {m.score_runs.fit_label}
                          </span>
                        )}
                      </div>
                      {canEdit && allowed.length > 0 && (
                        <div className="mt-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full text-xs"
                                disabled={move.isPending}
                                aria-label={`Change stage for ${m.candidate_profiles?.full_name ?? "candidate"}`}
                              >
                                Change stage
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {allowed.map((to) => (
                                <DropdownMenuItem
                                  key={to}
                                  onSelect={() => attemptMove(m.id, from, to)}
                                >
                                  {STAGE_LABELS[to]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  );
                })}
                {byStage[col.key].length === 0 && (
                  <div className="text-xs text-muted-foreground px-1 py-4 text-center">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

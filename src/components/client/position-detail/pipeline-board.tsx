import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users } from "lucide-react";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { type MatchStage } from "@/lib/client-match-stage";
import { KANBAN_COLUMNS, STAGE_GRAPH, STAGE_LABELS } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function PipelineBoard({
  matches,
  byStage,
  canEdit,
  dragOver,
  setDragOver,
  movePending,
  attemptMove,
}: {
  matches: AnyRow[];
  byStage: Record<string, AnyRow[]>;
  canEdit: boolean;
  dragOver: MatchStage | null;
  setDragOver: (updater: MatchStage | null | ((c: MatchStage | null) => MatchStage | null)) => void;
  movePending: boolean;
  attemptMove: (matchId: string, from: MatchStage, to: MatchStage) => void;
}) {
  return (
    <section aria-label="Pipeline">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <div className="text-xs text-muted-foreground">
          <Users className="inline h-3.5 w-3.5 mr-1" />
          {matches.length} candidate{matches.length === 1 ? "" : "s"} visible
        </div>
      </div>
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
              className={`rounded-lg p-2 min-h-[280px] transition-colors ${
                isDropTarget
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-muted/40"
              }`}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() =>
                setDragOver((c) => (c === col.key ? null : c))
              }
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (!canEdit) return;
                const matchId = e.dataTransfer.getData("text/match-id");
                const from = e.dataTransfer.getData(
                  "text/from-stage",
                ) as MatchStage;
                if (matchId && from) attemptMove(matchId, from, col.key);
              }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="text-xs font-medium uppercase tracking-wide">
                  {col.label}
                </div>
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
                      draggable={canEdit && !movePending}
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
                        {m.candidate_profiles?.headline ??
                          m.candidate_profiles?.location ??
                          ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <CandidateScoreBadge
                          score={m.score_runs?.score ?? null}
                          fitLabel={m.score_runs?.fit_label ?? null}
                          unicorn={
                            (m.score_runs?.score ?? 0) >= 95 || m.stage === "hired"
                          }
                        />

                      </div>

                      {canEdit && allowed.length > 0 && (
                        <div className="mt-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full text-xs"
                                disabled={movePending}
                                aria-label={`Change stage for ${m.candidate_profiles?.full_name ?? "candidate"}`}
                              >
                                Change stage
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {allowed.map((to) => (
                                <DropdownMenuItem
                                  key={to}
                                  onSelect={() =>
                                    attemptMove(m.id, from, to)
                                  }
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
    </section>
  );
}

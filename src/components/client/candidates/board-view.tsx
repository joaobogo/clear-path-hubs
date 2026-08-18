/**
 * Board view of the Candidates list.
 *
 * This is a PRESENTATION of the rows the page already fetched, filtered and
 * sorted — there is no second query and no second filter state. It reuses the
 * role board (`PipelineBoard`) and the single stage-move path
 * (`useStageMove`), so a move behaves identically on both surfaces.
 */
import { useState } from "react";
import { toast } from "sonner";
import { PipelineBoard } from "@/components/client/position-detail/pipeline-board";
import { groupRowsByStage, isAllowedTransition } from "./board-grouping";
import { DeclineReasonDialog } from "@/components/client/decline-reason-dialog";
import { useStageMove } from "@/lib/client/use-stage-move";
import type { MatchStage } from "@/lib/client-match-stage";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

/** DTO → the row shape the board reads. Display only. */
function toBoardRow(c: ClientCandidateDTO): AnyRow {
  return {
    id: c.match_id,
    stage: c.stage,
    candidate_profiles: {
      full_name: c.candidate.display_name,
      headline: c.candidate.headline,
      location: c.candidate.location,
      years_experience: c.candidate.years_experience,
      current_role: c.candidate.current_role,
      current_company: c.candidate.current_company,
    },
    score_runs: { score: c.score ?? null, fit_label: c.fit_label ?? c.fit?.band ?? null },
    position: c.position ? { title: c.position.title } : null,
  };
}

export function CandidatesBoardView({
  rows,
  orgId,
  queryKey,
  canEdit,
  refetch,
}: {
  /** The already filtered + sorted rows shown by the list. */
  rows: ClientCandidateDTO[];
  orgId: string;
  queryKey: readonly unknown[];
  canEdit: boolean;
  refetch: () => unknown;
}) {
  const [dragOver, setDragOver] = useState<MatchStage | null>(null);
  const [declining, setDeclining] = useState<{ matchId: string; name: string | null } | null>(null);

  const move = useStageMove({
    orgId,
    queryKey: queryKey as unknown[],
    // The candidates cache is a flat DTO array; alias match_id so the shared
    // optimistic guard can find the grabbed card.
    getMatches: (cached: AnyRow) =>
      ((cached as ClientCandidateDTO[] | undefined) ?? []).map((r) => ({ ...r, id: r.match_id })),
    setMatches: (_cached: AnyRow, next: AnyRow[]) => next,
    refetch,
    invalidateKeys: [["client-overview", orgId], ["client-positions", orgId]],
  });

  const boardRows = rows.map(toBoardRow);
  const { byStage } = groupRowsByStage(boardRows);

  const attemptMove = (matchId: string, from: MatchStage, to: MatchStage) => {
    if (from === to) return;
    if (!isAllowedTransition(from, to)) {
      toast.error(`Cannot move from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`);
      return;
    }

    if (to === "not_moving_forward") {
      const m = rows.find((r) => r.match_id === matchId);
      setDeclining({ matchId, name: m?.candidate.display_name ?? null });
      return;
    }
    move.mutate({ matchId, toStage: to });
  };

  return (
    <>
      <PipelineBoard
        matches={boardRows}
        byStage={byStage}
        canEdit={canEdit}
        dragOver={dragOver}
        setDragOver={setDragOver}
        movePending={move.isPending}
        attemptMove={attemptMove}
        showRole
        emptyHint="No candidates here"
      />
      <DeclineReasonDialog
        open={!!declining}
        onOpenChange={(v) => !v && setDeclining(null)}
        candidateName={declining?.name ?? null}
        pending={move.isPending}
        onConfirm={({ reasonCode, note }) => {
          if (!declining) return;
          move.mutate({
            matchId: declining.matchId,
            toStage: "not_moving_forward",
            reasonCode,
            reason: note || undefined,
          });
          setDeclining(null);
        }}
      />
    </>
  );
}

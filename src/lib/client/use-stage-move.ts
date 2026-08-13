/**
 * The single client-side path for moving a candidate between pipeline stages.
 *
 * The board is mounted in more than one place (role detail, and the Candidates
 * board view), and every mount must behave identically: the same optimistic
 * guard against a stale card, the same rollback, and the same wording when the
 * server refuses. Duplicating that per surface is how the two drift apart, so
 * the mutation lives here and the surfaces only supply their cache shape.
 *
 * Server rules are NOT restated here: the transition matrix and the advance
 * gate stay on the server, and this hook only translates their errors.
 */
import { useRef } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { moveMatchStage } from "@/lib/client-decisions.functions";
import { readAdvanceGateError } from "@/lib/client/advance-gate";
import { readStaleStateError } from "@/lib/decision-concurrency";
import type { MatchStage } from "@/lib/client-match-stage";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export interface StageMoveVars {
  matchId: string;
  toStage: MatchStage;
  reason?: string;
  reasonCode?: string;
}

export interface UseStageMoveOptions {
  /** Active workspace. */
  orgId: string;
  /** The query holding the rows the board renders. */
  queryKey: QueryKey;
  /** Read the match rows out of that query's cached payload. */
  getMatches: (cached: AnyRow) => AnyRow[];
  /**
   * Write the optimistically moved rows back into the cached payload.
   * Defaults to the `{ matches: [...] }` shape used by the role detail payload.
   */
  setMatches?: (cached: AnyRow, rows: AnyRow[]) => AnyRow;
  /** Refetch the owning surface after a stale-state conflict. */
  refetch?: () => unknown;
  /** Extra caches invalidated on success (overview, lists, counters). */
  invalidateKeys?: QueryKey[];
}

export function useStageMove({
  orgId,
  queryKey,
  getMatches,
  setMatches = (cached, rows) => ({ ...cached, matches: rows }),
  refetch,
  invalidateKeys = [],
}: UseStageMoveOptions) {
  const qc = useQueryClient();
  const moveFn = useServerFn(moveMatchStage);
  /**
   * The stage the card sat on when the operator grabbed it, captured in
   * `onMutate` BEFORE the optimistic write. Reading it inside `mutationFn`
   * would read our own optimistic value back and make every move look stale.
   */
  const expectedStages = useRef(new Map<string, string | undefined>());

  return useMutation({
    mutationFn: (v: StageMoveVars) =>
      moveFn({
        data: {
          orgId,
          matchId: v.matchId,
          toStage: v.toStage,
          // If the candidate has already moved elsewhere, the server refuses.
          expectedStage: expectedStages.current.get(v.matchId),
          reason: v.reason,
          reasonCode: v.reasonCode,
        },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<AnyRow>(queryKey);
      expectedStages.current.set(
        v.matchId,
        getMatches(snapshot ?? undefined)?.find((m: AnyRow) => m.id === v.matchId)?.stage as
          | string
          | undefined,
      );
      qc.setQueryData<AnyRow>(queryKey, (prev: AnyRow) => {
        if (!prev) return prev;
        const rows = getMatches(prev) ?? [];
        return setMatches(prev, applyOptimisticStage(rows, v.matchId, v.toStage));
      });
      return { snapshot };
    },

    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot);
      // Someone else already moved this candidate: block the action, restore the
      // board and explain what changed rather than reporting a failed save.
      const stale = readStaleStateError(e);
      if (stale) {
        void refetch?.();
        toast.error("This candidate already moved", {
          description: stale.message,
          duration: 12_000,
        });
        return;
      }
      toast.error(stageMoveErrorMessage(e));
    },
    onSuccess: () => {
      toast.success("Stage updated");
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}

/** The optimistic move: only the grabbed card changes, order is preserved. */
export function applyOptimisticStage(
  rows: AnyRow[],
  matchId: string,
  toStage: MatchStage,
): AnyRow[] {
  return rows.map((m: AnyRow) => (m.id === matchId ? { ...m, stage: toStage } : m));
}

/**
 * Server refusals, in the operator's words. Kept exported so the wording is
 * testable and identical on every surface that moves a candidate.
 */
export function stageMoveErrorMessage(e: Error): string {
  const raw = e.message.replace(/^Error: /, "");
  const gate = readAdvanceGateError(raw);
  return gate
    ? gate
    : raw.startsWith("invalid_transition")
    ? "That move is not allowed for this stage."
    : raw === "reason_required"
    ? "A reason is required to mark a candidate as not moving forward."
    : raw === "SUPPORT_VIEW_READ_ONLY"
    ? "Unavailable while viewing this workspace in read-only support mode."
    : raw === "forbidden"
    ? "You do not have permission to move candidates."
    : raw === "match_not_visible"
    ? "This candidate is no longer available."
    : raw;
}

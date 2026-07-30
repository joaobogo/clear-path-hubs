import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DecisionDialog,
  type DecisionActionKey,
  type DecisionPayload,
} from "@/components/client/decision-dialog";
import { clientAction, undoClientDecision } from "@/lib/client.functions";
import type { MatchStage } from "@/lib/client-kpi.server";

/** How long the Undo affordance stays on screen, in ms. */
const UNDO_TOAST_MS = 12_000;

type AdvanceStep = { action: DecisionActionKey; label: string; done: string };

/** The single forward move available from each stage, in client language. */
export function advanceFor(stage: MatchStage): AdvanceStep | null {
  return (
    {
      delivered: { action: "shortlist", label: "Advance", done: "Added to your shortlist" },
      shortlisted: {
        action: "request_interview",
        label: "Advance",
        done: "Interview requested",
      },
      interview_process: { action: "offer", label: "Advance", done: "Moved to offer stage" },
      offer: { action: "hire", label: "Mark hired", done: "Marked as hired" },
      hired: null,
      not_moving_forward: { action: "shortlist", label: "Reopen", done: "Back on your shortlist" },
    } as const
  )[stage] as AdvanceStep | null;
}

/**
 * Advance / Hold / Decline in one click each.
 *
 * Advance is immediate — no dialog, no confirmation step. Hold and Decline
 * open the structured reason picker, because "why" is the signal that
 * improves the next shortlist. Every outcome lands as a toast carrying an
 * Undo, so no decision here feels final or heavy.
 */
export function DecisionBar({
  orgId,
  matchId,
  stage,
  candidateName,
  compact,
}: {
  orgId: string;
  matchId: string;
  stage: MatchStage;
  candidateName: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const act = useServerFn(clientAction);
  const undo = useServerFn(undoClientDecision);
  const [pending, setPending] = React.useState<null | DecisionActionKey>(null);
  const [dialog, setDialog] = React.useState<DecisionActionKey | null>(null);

  const advance = advanceFor(stage);
  const canHold = stage !== "hired" && stage !== "not_moving_forward";
  const canDecline = stage !== "hired" && stage !== "not_moving_forward";

  async function runUndo(toStage: MatchStage) {
    try {
      await undo({ data: { orgId, matchId, toStage } });
      toast.success("Decision undone", { description: `${candidateName} is back where they were.` });
      await queryClient.invalidateQueries();
    } catch {
      toast.error("That decision can no longer be undone. Your recruiter can reverse it for you.");
    }
  }

  async function run(payload: DecisionPayload, done: string) {
    const fromStage = stage;
    setPending(payload.action);
    try {
      await act({ data: { orgId, matchId, ...payload } });
      setDialog(null);
      toast.success(done, {
        description: candidateName,
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: () => void runUndo(fromStage) },
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.includes("reason")
          ? "Please pick a reason so we can act on it."
          : "We couldn't save that decision. Please try again.",
      );
    } finally {
      setPending(null);
    }
  }

  const size = compact ? "sm" : "default";
  const busy = pending !== null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {advance && (
          <Button
            size={size}
            disabled={busy}
            onClick={() => void run({ action: advance.action }, advance.done)}
          >
            {pending === advance.action ? "Saving…" : advance.label}
          </Button>
        )}
        {canHold && (
          <Button size={size} variant="outline" disabled={busy} onClick={() => setDialog("hold")}>
            Hold
          </Button>
        )}
        {canDecline && (
          <Button
            size={size}
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => setDialog("not_moving_forward")}
          >
            Decline
          </Button>
        )}
      </div>

      <DecisionDialog
        action={dialog}
        open={dialog !== null}
        pending={busy}
        onOpenChange={(v) => !busy && setDialog(v ? dialog : null)}
        onConfirm={(payload) =>
          void run(
            payload,
            payload.action === "hold" ? "Placed on hold" : "Declined for this role",
          )
        }
      />
    </>
  );
}

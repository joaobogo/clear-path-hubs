import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "@tanstack/react-router";
import { clientAction, undoClientDecision } from "@/lib/client-decisions.functions";
import { confirmationLine } from "@/lib/client-next-step";
import {
  isActionTimeout,
  withActionTimeout,
  ACTION_TIMEOUT_MESSAGE,
} from "@/lib/client/action-timeout";
import type { MatchStage } from "@/lib/client-match-stage";
import { isNotRecommendedFit } from "@/lib/client-fit-presentation";

type PrimaryActionKey = "shortlist" | "request_interview" | "offer" | "hire" | "not_moving_forward";

const RESULT_STAGE: Record<PrimaryActionKey, MatchStage> = {
  shortlist: "shortlisted",
  request_interview: "interview_process",
  offer: "offer",
  hire: "hired",
  not_moving_forward: "not_moving_forward",
};

function consequenceFor(action: PrimaryActionKey): string {
  const stage = RESULT_STAGE[action];
  return stage ? confirmationLine(stage) : "";
}

const UNDO_TOAST_MS = 12_000;

type AdvanceStep = { action: PrimaryActionKey; label: string; done: string };

/**
 * The next decision for a candidate, derived from the stage alone. TaaSFlow no
 * longer schedules interviews, so no interview record gates the action: the
 * employer arranges interviews directly with the candidate and moves the
 * candidate on when ready.
 */
export function advanceFor(stage: MatchStage): AdvanceStep | null {
  return (
    {
      delivered: { action: "shortlist", label: "Shortlist", done: "Added to your shortlist" },
      shortlisted: {
        action: "request_interview",
        label: "Move to interview stage",
        done: "Moved to interview stage",
      },
      interview_process: { action: "offer", label: "Make offer", done: "Moved to offer stage" },
      offer: { action: "hire", label: "Mark hired", done: "Marked as hired" },
      hired: null,
      not_moving_forward: {
        action: "shortlist",
        label: "Reopen",
        done: "Back on your shortlist",
      },
    } as const
  )[stage] as AdvanceStep | null;
}

/**
 * One primary action for a candidate card/row: the next sensible decision for
 * the current stage. Mirrors the advance button in DecisionBar so the same
 * server function, timeout, and undo path are used.
 */
export function CandidatePrimaryAction({
  orgId,
  matchId,
  stage,
  candidateName,
  size = "sm",
  fitLabel = null,
  score = null,
}: {
  orgId: string;
  matchId: string;
  stage: MatchStage;
  candidateName: string;
  size?: "sm" | "default";
  /** Raw engine/DB fit label, when the surface has it. */
  fitLabel?: string | null;
  /** Fit score 0-100, when the surface has it. */
  score?: number | null;
}) {
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { org?: string };
  const act = useServerFn(clientAction);
  const undo = useServerFn(undoClientDecision);
  const [pending, setPending] = React.useState<PrimaryActionKey | null>(null);
  const [settled, setSettled] = React.useState<string | null>(null);
  const [optimistic, setOptimistic] = React.useState<MatchStage | null>(null);

  React.useEffect(() => {
    if (!settled) return;
    const t = window.setTimeout(() => setSettled(null), 2400);
    return () => window.clearTimeout(t);
  }, [settled]);

  React.useEffect(() => setOptimistic(null), [stage]);

  const shownStage = optimistic ?? stage;
  const advance = advanceFor(shownStage);
  const notRecommended = isNotRecommendedFit(fitLabel, score);

  async function runUndo(fromStage: MatchStage) {
    toast.dismiss();
    toast.loading("Undoing…");
    try {
      await undo({ data: { orgId, matchId, toStage: fromStage } });
      toast.dismiss();
      toast.success("Undone");
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.dismiss();
      const msg = e instanceof Error ? e.message.replace(/^Error:\s*/, "") : "";
      toast.error("Could not undo", { description: msg || undefined });
    }
  }

  async function run(action: PrimaryActionKey, done: string) {
    setPending(action);
    const fromStage = shownStage;
    const landing = RESULT_STAGE[action];
    if (landing) setOptimistic(landing);
    try {
      await withActionTimeout(() => act({ data: { orgId, matchId, action: action as never } }));
      setSettled(done);
      toast.success(`${done} — ${candidateName}`, {
        description: consequenceFor(action),
        duration: UNDO_TOAST_MS,
        action: {
          label: "Undo",
          onClick: (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Undoing…";
            void runUndo(fromStage).finally(() => {
              btn.disabled = false;
              btn.textContent = originalText;
            });
          },
        },
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      setOptimistic(null);
      setSettled(null);
      const msg = e instanceof Error ? e.message.replace(/^Error:\s*/, "") : "";
      if (msg.includes("reason")) {
        toast.error("Pick a reason so we can act on it.");
        return;
      }
      toast.error(isActionTimeout(e) ? ACTION_TIMEOUT_MESSAGE : "That did not save", {
        description: isActionTimeout(e) ? undefined : msg || undefined,
        duration: UNDO_TOAST_MS,
        action: { label: "Retry", onClick: () => void run(action, done) },
      });
    } finally {
      setPending(null);
    }
  }

  if (settled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        {settled}
      </span>
    );
  }

  if (!advance) {
    // The candidate name already links to the profile; no extra action needed.
    return null;
  }

  const advanceButton = (
    <Button
      size={size}
      variant={notRecommended ? "outline" : "default"}
      disabled={pending !== null}
      onClick={() => void run(advance.action, advance.done)}
    >
      {pending === advance.action ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        advance.label
      )}
    </Button>
  );

  // Not recommended: evidence first. The advance move stays available as a
  // quiet secondary button.
  //
  // The band label used to be repeated here as a trailing caption, so the card
  // read "Not recommended" twice — once in its own band chip and again beside
  // the buttons (audit #4, L11). The chip states the band; this row states the
  // moves available.
  if (notRecommended) {
    return (
      <div className="inline-flex flex-wrap items-center justify-end gap-2">
        <Button asChild size={size}>
          <Link
            to="/client/candidates/$id"
            params={{ id: matchId }}
            search={search.org ? { org: search.org } : undefined}
            hash="sec-evidence"
            preload="intent"
          >
            Review evidence
          </Link>
        </Button>
        {advanceButton}
      </div>
    );
  }

  return advanceButton;
}

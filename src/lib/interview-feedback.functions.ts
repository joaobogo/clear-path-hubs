// Two-minute interview feedback — read the review queue, submit the short form.
//
// Submitting is the whole loop: it records the feedback, closes the interview,
// moves the candidate to the chosen next step, and clears the queue item. The
// recruiting team sees the feedback immediately because it is stored on the
// interview, not emailed around.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistStage } from "@/lib/client/persist-stage";
import { reconcileHireRecordForStage } from "@/lib/hires/stage-reconcile.server";
import type { MatchStage } from "@/lib/client-match-stage";
import { z } from "zod";
import {
  DECLINE_CONCERN_MIN,
  FEEDBACK_TEXT_MAX,
  type FeedbackNextStep,
  type FeedbackRecommendation,
} from "./interview-feedback";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { assertEditor } from "@/lib/client-shared.server";
import { parseFeedbackTarget } from "@/lib/interview-feedback-queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const traceId = () => `fb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const DAY = 86_400_000;

export type FeedbackQueueItem = {
  interview_id: string;
  candidate_match_id: string;
  candidate_name: string;
  position_id: string | null;
  position_title: string;
  interview_type: string | null;
  /** When the interview happened (completed, else its scheduled time). */
  happened_at: string | null;
  /** Prompted the day after the interview — a date, never an email nag. */
  prompt_from: string | null;
  status: string;
};

export type SubmittedFeedback = {
  id: string;
  interview_id: string;
  reviewer_name: string | null;
  recommendation: FeedbackRecommendation;
  next_step: FeedbackNextStep | null;
  strengths: string | null;
  concerns: string | null;
  submitted_at: string;
};

const RECOMMENDATIONS = ["advance", "hold", "decline"] as const;
const NEXT_STEPS = ["another_interview", "make_offer", "stop_here"] as const;

/**
 * The scorecard table stores the five-point interview vocabulary
 * (strong_yes … strong_no). The client feedback form speaks in three
 * outcomes. Translate both ways at the boundary.
 */
function encodeRecommendation(v: FeedbackRecommendation): string {
  return v === "advance" ? "yes" : v === "decline" ? "no" : "no_decision";
}
function normRecommendation(v: unknown): FeedbackRecommendation {
  if (v === "advance" || v === "hold" || v === "decline") return v;
  if (v === "strong_yes" || v === "yes") return "advance";
  if (v === "no" || v === "strong_no") return "decline";
  return "hold";
}
function normNextStep(v: unknown): FeedbackNextStep | null {
  return v === "another_interview" || v === "make_offer" || v === "stop_here" ? v : null;
}

function nameOf(match: AnyRow): string {
  const cp = match?.candidate_profiles ?? null;
  return (cp?.full_name as string) || "Candidate";
}

/**
 * An interview happened at its scheduled time. `completed_at` is only an
 * administrative stamp and can disagree with the meeting time, which is how a
 * future meeting once surfaced in the feedback queue as already held.
 */
function happenedAt(iv: AnyRow): string | null {
  return (iv.scheduled_at as string | null) ?? null;
}

/**
 * Employer roles hold no RLS read on candidate_profiles, so the nested embed
 * comes back null and every queue row said "Candidate". Resolve names for the
 * already-authorized matches through the shared hydration helper.
 */
async function nameByMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  matchIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(matchIds.filter(Boolean)));
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name)")
    .in("id", ids);
  const { hydrateClientCandidateProfiles } = await import(
    "@/lib/client-candidate-hydrate.server"
  );
  for (const m of await hydrateClientCandidateProfiles((data as AnyRow[]) ?? [])) {
    const name = (m as AnyRow).candidate_profiles?.full_name as string | undefined;
    if (name) out.set(m.id as string, name);
  }
  return out;
}

/**
 * Interviews that have happened and still have no feedback from anyone on the
 * client side. Prompted from the day after the interview.
 */
export const listInterviewsAwaitingFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<FeedbackQueueItem[]> => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const { getInterviewsAwaitingFeedback } = await import("./client/interviews-awaiting-feedback.server");
    return getInterviewsAwaitingFeedback(context.supabase, data.orgId);
  });

/** Everything the candidate page needs: what is open, and what was already said. */
export const getMatchFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ pending: FeedbackQueueItem[]; submitted: SubmittedFeedback[] }> => {
      await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
      const sel = (s: string): string => s;
      const nowIso = new Date().toISOString();

      const { data: ivs } = await context.supabase
        .from("interviews")
        .select(
          sel(
            "id, candidate_match_id, position_id, status, scheduled_at, completed_at, interview_type, candidate_matches:candidate_match_id(candidate_profiles:candidate_profile_id(full_name)), positions:position_id(title)",
          ),
        )
        .eq("organization_id", data.orgId)
        .eq("candidate_match_id", data.matchId)
        .in("status", ["scheduled", "completed"])
        .order("scheduled_at", { ascending: true })
        .limit(20);

      const { data: cards } = await context.supabase
        .from("interview_scorecards")
        .select(
          sel(
            "id, interview_id, reviewer_name, recommendation, next_step, strengths, concerns, submitted_at",
          ),
        )
        .eq("organization_id", data.orgId)
        .eq("candidate_match_id", data.matchId)
        .order("submitted_at", { ascending: false });

      const submitted: SubmittedFeedback[] = ((cards as AnyRow[] | null) ?? []).map((r) => ({
        id: r.id as string,
        interview_id: r.interview_id as string,
        reviewer_name: (r.reviewer_name as string) ?? null,
        recommendation: normRecommendation(r.recommendation),
        next_step: normNextStep(r.next_step),
        strengths: (r.strengths as string) ?? null,
        concerns: (r.concerns as string) ?? null,
        submitted_at: r.submitted_at as string,
      }));
      const done = new Set(submitted.map((s) => s.interview_id));

      const matchNames = await nameByMatch(context.supabase, [data.matchId]);
      const pending: FeedbackQueueItem[] = ((ivs as AnyRow[] | null) ?? [])
        .filter((iv) => {
          const happened = happenedAt(iv);
          return !!happened && happened < nowIso && !done.has(iv.id as string);
        })
        .map((iv) => {
          const happened = happenedAt(iv);
          return {
            interview_id: iv.id as string,
            candidate_match_id: iv.candidate_match_id as string,
            candidate_name:
              matchNames.get(data.matchId) ?? nameOf(iv.candidate_matches),
            position_id: (iv.position_id as string) ?? null,
            position_title: iv.positions?.title ?? "Your role",
            interview_type: (iv.interview_type as string) ?? null,
            happened_at: happened,
            prompt_from: happened
              ? new Date(new Date(happened).getTime() + DAY).toISOString()
              : null,
            status: iv.status as string,
          };
        });

      // Interviews happen off system: a match at (or past) the interview stage
      // with no feedback yet is also open, even with no interview row.
      const { getStageMatchesAwaitingFeedback } = await import(
        "./client/interviews-awaiting-feedback.server"
      );
      const stagePending =
        submitted.length > 0
          ? []
          : await getStageMatchesAwaitingFeedback(context.supabase, data.orgId, {
              matchId: data.matchId,
              stages: ["interview_process", "offer", "hired"],
              coveredMatchIds: pending.length > 0 ? new Set([data.matchId]) : undefined,
            });

      return { pending: [...pending, ...stagePending], submitted };
    },
  );

const NEXT_STEP_TO_STAGE: Record<FeedbackNextStep, string | null> = {
  another_interview: null, // stays in the interview process
  make_offer: "offer",
  stop_here: "not_moving_forward",
};

export const submitInterviewFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      interviewId: string;
      recommendation: FeedbackRecommendation;
      nextStep: FeedbackNextStep;
      strengths?: string;
      concerns?: string;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          interviewId: z.string().min(1).max(80),
          recommendation: z.enum(RECOMMENDATIONS),
          nextStep: z.enum(NEXT_STEPS),
          strengths: z.string().max(FEEDBACK_TEXT_MAX).default(""),
          concerns: z.string().max(FEEDBACK_TEXT_MAX).default(""),
        })
        .superRefine((v, ctx) => {
          if (v.recommendation === "decline" && v.concerns.trim().length < DECLINE_CONCERN_MIN) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["concerns"],
              message: `Add at least ${DECLINE_CONCERN_MIN} characters on what concerned you.`,
            });
          }
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const sel = (s: string): string => s;
    await assertEditor(context.supabase, context.userId, data.orgId);

    // The target is a real interview row (legacy) or a match at the interview
    // stage, in which case one completed record is created on first submit.
    const target = parseFeedbackTarget(data.interviewId);
    let interviewId: string;
    let row: AnyRow;
    if (target.kind === "match") {
      if (!z.string().uuid().safeParse(target.matchId).success) throw new Error("interview_not_found");
      const { ensureCompletedInterviewForMatch } = await import("./interview-record.server");
      const ensured = await ensureCompletedInterviewForMatch(context.supabase, {
        orgId: data.orgId,
        matchId: target.matchId,
        userId: context.userId,
      });
      interviewId = ensured.interviewId;
      row = {
        id: interviewId,
        candidate_match_id: ensured.matchId,
        position_id: ensured.positionId,
        status: "completed",
      };
    } else {
      interviewId = target.interviewId;
      if (!z.string().uuid().safeParse(interviewId).success) throw new Error("interview_not_found");
      const { data: iv, error: ivErr } = await context.supabase
        .from("interviews")
        .select(sel("id, candidate_match_id, organization_id, position_id, status"))
        .eq("id", interviewId)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      if (ivErr) throw new Error(ivErr.message);
      if (!iv) throw new Error("interview_not_found");
      row = iv as AnyRow;
    }
    const matchId = row.candidate_match_id as string;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select(sel("full_name"))
      .eq("id", context.userId)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const strengths = data.strengths.trim() || null;
    const concerns = data.concerns.trim() || null;

    const { error: upsertErr } = await context.supabase.from("interview_scorecards").upsert(
      {
        interview_id: interviewId,
        candidate_match_id: matchId,
        organization_id: data.orgId,
        position_id: (row.position_id as string) ?? null,
        reviewer_user_id: context.userId,
        reviewer_name: (profile as AnyRow)?.full_name ?? null,
        criteria: [],
        recommendation: encodeRecommendation(data.recommendation),
        next_step: data.nextStep,
        strengths,
        concerns,
        summary: null,
        submitted_at: nowIso,
      } as never,
      { onConflict: "interview_id,reviewer_user_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    // Close the interview so the same item cannot be prompted twice.
    if (row.status === "scheduled") {
      await context.supabase
        .from("interviews")
        .update({
          status: "completed",
          completed_at: nowIso,
          feedback: strengths ?? concerns,
          updated_by: context.userId,
        } as never)
        .eq("id", interviewId)
        .eq("organization_id", data.orgId);
    }

    // Move the candidate to the chosen next step.
    let movedTo: string | null = null;
    const targetStage = NEXT_STEP_TO_STAGE[data.nextStep];
    if (targetStage) {
      const { data: match } = await context.supabase
        .from("candidate_matches")
        .select(sel("id, stage, position_id, candidate_profile_id"))
        .eq("id", matchId)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      const from = (match as AnyRow)?.stage as string | undefined;
      const allowed: Record<string, string[]> = {
        delivered: ["shortlisted", "interview_process", "not_moving_forward"],
        shortlisted: ["interview_process", "not_moving_forward"],
        interview_process: ["offer", "shortlisted", "not_moving_forward"],
        offer: ["hired", "not_moving_forward"],
        hired: [],
        not_moving_forward: ["shortlisted"],
      };
      if (from && from !== targetStage && (allowed[from] ?? []).includes(targetStage)) {
        // `movedTo` is reported back to the caller, so it must reflect a move
        // that actually happened. A no-error/zero-row update set it anyway.
        let moved = true;
        try {
          await persistStage(context.supabase, {
            matchId,
            orgId: data.orgId,
            toStage: targetStage,
          });
        } catch {
          moved = false;
        }
        if (moved) {
          movedTo = targetStage;
          // The third path that moves a stage, and the one the shared helper's
          // docstring warned about. "Make an offer" from interview feedback
          // left no hire_records row, so the candidate sat in the Offer column
          // while the Offers board — which reads hire_records — showed nobody.
          //
          // The feedback itself is already committed above, so a failure here
          // must not report the whole submission as failed and invite a
          // double-submit. On failure this simply leaves the behaviour that
          // shipped before; on success the two records agree.
          try {
            await reconcileHireRecordForStage(context.supabase, {
              matchId,
              orgId: data.orgId,
              positionId: ((match as AnyRow)?.position_id as string | null) ?? null,
              candidateProfileId:
                ((match as AnyRow)?.candidate_profile_id as string | null) ?? null,
              toStage: targetStage as MatchStage,
            });
          } catch {
            // Reconciliation is best-effort here, deliberately.
          }
          await context.supabase.from("client_decisions").insert({
            candidate_match_id: matchId,
            organization_id: data.orgId,
            decision: (targetStage === "offer" ? "offer" : "not_moving_forward") as never,
            actor_user_id: context.userId,
            feedback: concerns ?? strengths,
          } as never);
        }
      }
    }

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "interview.feedback_submitted",
      entity_type: "interview_scorecards",
      entity_id: interviewId,
      organization_id: data.orgId,
      after_state: {
        recommendation: data.recommendation,
        next_step: data.nextStep,
        moved_to: movedTo,
      } as never,
      trace_id: trace,
    } as never);

    return { ok: true as const, moved_to: movedTo, trace_id: trace };
  });

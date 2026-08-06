// Two-minute interview feedback — read the review queue, submit the short form.
//
// Submitting is the whole loop: it records the feedback, closes the interview,
// moves the candidate to the chosen next step, and clears the queue item. The
// recruiting team sees the feedback immediately because it is stored on the
// interview, not emailed around.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  DECLINE_CONCERN_MIN,
  FEEDBACK_TEXT_MAX,
  type FeedbackNextStep,
  type FeedbackRecommendation,
} from "./interview-feedback";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { assertEditor } from "@/lib/client-shared.server";

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

function normRecommendation(v: unknown): FeedbackRecommendation {
  return v === "advance" || v === "hold" || v === "decline" ? v : "hold";
}
function normNextStep(v: unknown): FeedbackNextStep | null {
  return v === "another_interview" || v === "make_offer" || v === "stop_here" ? v : null;
}

function nameOf(match: AnyRow): string {
  const cp = match?.candidate_profiles ?? null;
  return cp?.display_name ?? cp?.full_name ?? "Candidate";
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
    const sel = (s: string): string => s;
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await context.supabase
      .from("interviews")
      .select(
        sel(
          "id, candidate_match_id, position_id, status, scheduled_at, completed_at, interview_type, candidate_matches:candidate_match_id(candidate_profiles:candidate_profile_id(display_name, full_name)), positions:position_id(title)",
        ),
      )
      .eq("organization_id", data.orgId)
      .in("status", ["scheduled", "completed"])
      .order("scheduled_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);

    const list = ((rows as AnyRow[] | null) ?? []).filter((iv) => {
      const happened = (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null);
      return !!happened && happened < nowIso;
    });
    if (list.length === 0) return [];

    const { data: cards } = await context.supabase
      .from("interview_scorecards")
      .select(sel("interview_id"))
      .eq("organization_id", data.orgId)
      .in(
        "interview_id",
        list.map((i) => i.id as string),
      );
    const done = new Set(((cards as AnyRow[] | null) ?? []).map((c) => c.interview_id as string));

    return list
      .filter((iv) => !done.has(iv.id as string))
      .map((iv) => {
        const happened = (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null);
        return {
          interview_id: iv.id as string,
          candidate_match_id: iv.candidate_match_id as string,
          candidate_name: nameOf(iv.candidate_matches),
          position_id: (iv.position_id as string) ?? null,
          position_title: iv.positions?.title ?? "Your role",
          interview_type: (iv.interview_type as string) ?? null,
          happened_at: happened,
          prompt_from: happened ? new Date(new Date(happened).getTime() + DAY).toISOString() : null,
          status: iv.status as string,
        };
      })
      .sort((a, b) => (a.happened_at ?? "").localeCompare(b.happened_at ?? ""));
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
            "id, candidate_match_id, position_id, status, scheduled_at, completed_at, interview_type, candidate_matches:candidate_match_id(candidate_profiles:candidate_profile_id(display_name, full_name)), positions:position_id(title)",
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

      const pending: FeedbackQueueItem[] = ((ivs as AnyRow[] | null) ?? [])
        .filter((iv) => {
          const happened = (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null);
          return !!happened && happened < nowIso && !done.has(iv.id as string);
        })
        .map((iv) => {
          const happened = (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null);
          return {
            interview_id: iv.id as string,
            candidate_match_id: iv.candidate_match_id as string,
            candidate_name: nameOf(iv.candidate_matches),
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

      return { pending, submitted };
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
          interviewId: z.string().uuid(),
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

    const { data: iv, error: ivErr } = await context.supabase
      .from("interviews")
      .select(sel("id, candidate_match_id, organization_id, position_id, status"))
      .eq("id", data.interviewId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (ivErr) throw new Error(ivErr.message);
    if (!iv) throw new Error("interview_not_found");
    const row = iv as AnyRow;
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
        interview_id: data.interviewId,
        candidate_match_id: matchId,
        organization_id: data.orgId,
        position_id: (row.position_id as string) ?? null,
        reviewer_user_id: context.userId,
        reviewer_name: (profile as AnyRow)?.full_name ?? null,
        criteria: [],
        recommendation: data.recommendation,
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
        .eq("id", data.interviewId)
        .eq("organization_id", data.orgId);
    }

    // Move the candidate to the chosen next step.
    let movedTo: string | null = null;
    const targetStage = NEXT_STEP_TO_STAGE[data.nextStep];
    if (targetStage) {
      const { data: match } = await context.supabase
        .from("candidate_matches")
        .select(sel("id, stage"))
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
        const { error: moveErr } = await context.supabase
          .from("candidate_matches")
          .update({ stage: targetStage } as never)
          .eq("id", matchId)
          .eq("organization_id", data.orgId);
        if (!moveErr) {
          movedTo = targetStage;
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
      entity_id: data.interviewId,
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

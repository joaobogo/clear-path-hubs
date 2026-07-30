// Interview scorecards — structured feedback captured right after an interview,
// then carried into the hire record as part of the handoff.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildCriteria,
  mergeCriteria,
  emptyScorecard,
  type Scorecard,
  type ScorecardCriterion,
  type Recommendation,
} from "@/lib/interview-scorecard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const traceId = () => `sc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const CriterionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  kind: z.enum(["must", "nice"]),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null()]),
  note: z.string().max(1000).default(""),
});

const ScorecardSchema = z.object({
  criteria: z.array(CriterionSchema).max(60),
  recommendation: z.enum(["strong_yes", "yes", "no_decision", "no", "strong_no"]),
  strengths: z.string().max(2000).default(""),
  concerns: z.string().max(2000).default(""),
  summary: z.string().max(4000).default(""),
});

export type ScorecardContext = {
  interview_id: string;
  candidate_match_id: string;
  candidate_name: string;
  position_title: string;
  scheduled_at: string | null;
  status: string;
  scorecard: Scorecard;
  existing: boolean;
  submitted_at: string | null;
};

export const getScorecardContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; interviewId: string }) =>
    z.object({ orgId: z.string().uuid(), interviewId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ScorecardContext | null> => {
    const sel = (s: string): string => s;
    const { data: iv } = await context.supabase
      .from("interviews")
      .select(
        sel(
          "id, candidate_match_id, organization_id, position_id, status, scheduled_at, candidate_matches:candidate_match_id(candidate_profiles:candidate_profile_id(display_name, full_name)), positions:position_id(title, requirements, preferred_requirements)",
        ),
      )
      .eq("id", data.interviewId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!iv) return null;
    const row = iv as AnyRow;

    const base = buildCriteria(
      row.positions?.requirements ?? null,
      row.positions?.preferred_requirements ?? null,
    );

    const { data: saved } = await context.supabase
      .from("interview_scorecards")
      .select(sel("criteria, recommendation, strengths, concerns, summary, submitted_at"))
      .eq("interview_id", data.interviewId)
      .eq("reviewer_user_id", context.userId)
      .maybeSingle();

    const s = saved as AnyRow | null;
    const scorecard: Scorecard = s
      ? {
          criteria: mergeCriteria(base, s.criteria),
          recommendation: (s.recommendation ?? "no_decision") as Recommendation,
          strengths: s.strengths ?? "",
          concerns: s.concerns ?? "",
          summary: s.summary ?? "",
        }
      : emptyScorecard(base);

    const cp = row.candidate_matches?.candidate_profiles ?? null;
    return {
      interview_id: row.id,
      candidate_match_id: row.candidate_match_id,
      candidate_name: cp?.display_name ?? cp?.full_name ?? "Candidate",
      position_title: row.positions?.title ?? "Position",
      scheduled_at: row.scheduled_at ?? null,
      status: row.status,
      scorecard,
      existing: !!s,
      submitted_at: s?.submitted_at ?? null,
    };
  });

export const submitScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; interviewId: string; scorecard: Scorecard; complete?: boolean }) =>
      z
        .object({
          orgId: z.string().uuid(),
          interviewId: z.string().uuid(),
          scorecard: ScorecardSchema,
          // Also mark the interview completed when it is still scheduled.
          complete: z.boolean().default(true),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const sel = (s: string): string => s;

    const { data: iv, error: ivErr } = await context.supabase
      .from("interviews")
      .select(sel("id, candidate_match_id, organization_id, position_id, status"))
      .eq("id", data.interviewId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (ivErr) throw new Error(ivErr.message);
    if (!iv) throw new Error("interview_not_found");
    const row = iv as AnyRow;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select(sel("full_name"))
      .eq("id", context.userId)
      .maybeSingle();

    const payload = {
      interview_id: data.interviewId,
      candidate_match_id: row.candidate_match_id,
      organization_id: data.orgId,
      position_id: row.position_id ?? null,
      reviewer_user_id: context.userId,
      reviewer_name: (profile as AnyRow)?.full_name ?? null,
      criteria: data.scorecard.criteria as unknown as ScorecardCriterion[],
      recommendation: data.scorecard.recommendation,
      strengths: data.scorecard.strengths || null,
      concerns: data.scorecard.concerns || null,
      summary: data.scorecard.summary || null,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await context.supabase
      .from("interview_scorecards")
      .upsert(payload as never, { onConflict: "interview_id,reviewer_user_id" });
    if (error) throw new Error(error.message);

    if (data.complete && row.status === "scheduled") {
      await context.supabase
        .from("interviews")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          feedback: data.scorecard.summary || null,
          updated_by: context.userId,
        } as never)
        .eq("id", data.interviewId)
        .eq("organization_id", data.orgId);
    }

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "interview.scorecard_submitted",
      entity_type: "interview_scorecards",
      entity_id: data.interviewId,
      organization_id: data.orgId,
      after_state: {
        recommendation: data.scorecard.recommendation,
        rated: data.scorecard.criteria.filter((c) => c.rating != null).length,
        total: data.scorecard.criteria.length,
      } as never,
      trace_id: trace,
    } as never);

    return { ok: true, trace_id: trace };
  });

export type MatchScorecard = {
  id: string;
  interview_id: string;
  reviewer_name: string | null;
  recommendation: Recommendation;
  criteria: ScorecardCriterion[];
  strengths: string | null;
  concerns: string | null;
  summary: string | null;
  submitted_at: string;
};

export const listScorecardsForMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<MatchScorecard[]> => {
    const sel = (s: string): string => s;
    const { data: rows } = await context.supabase
      .from("interview_scorecards")
      .select(
        sel(
          "id, interview_id, reviewer_name, recommendation, criteria, strengths, concerns, summary, submitted_at",
        ),
      )
      .eq("organization_id", data.orgId)
      .eq("candidate_match_id", data.matchId)
      .order("submitted_at", { ascending: false });
    return ((rows as AnyRow[] | null) ?? []).map((r) => ({
      id: r.id,
      interview_id: r.interview_id,
      reviewer_name: r.reviewer_name ?? null,
      recommendation: (r.recommendation ?? "no_decision") as Recommendation,
      criteria: Array.isArray(r.criteria) ? (r.criteria as ScorecardCriterion[]) : [],
      strengths: r.strengths ?? null,
      concerns: r.concerns ?? null,
      summary: r.summary ?? null,
      submitted_at: r.submitted_at,
    }));
  });

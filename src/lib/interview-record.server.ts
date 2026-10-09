/**
 * Makes sure an `interviews` row exists, completed, for a candidate match when
 * feedback is submitted. Interviews are arranged off system, so the row is a
 * lightweight record, created once. The lifecycle trigger forbids inserting
 * "completed" and requires a time for "scheduled", so the row is created as
 * scheduled (now) and then completed.
 */
import { planInterviewRecord } from "@/lib/interview-feedback-queue";
import { isInterviewOrLaterStage } from "@/lib/consent/cv-consent-gate";
import { matchReachedInterview } from "@/lib/consent/interview-evidence.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export async function ensureCompletedInterviewForMatch(
  supabase: AnyDb,
  args: { orgId: string; matchId: string; userId: string },
): Promise<{ interviewId: string; positionId: string | null; matchId: string }> {
  const { orgId, matchId, userId } = args;
  const { data: match, error: mErr } = await supabase
    .from("candidate_matches")
    .select("id, position_id, application_id, client_visibility, stage")
    .eq("id", matchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!match) throw new Error("match_not_found");
  if (match.client_visibility !== "visible") throw new Error("match_not_visible");
  // Feedback is only for candidates who reached the interview stage (now, or
  // earlier in their history — a candidate can be declined after interview).
  // Without this, any editor could mint a "completed interview", and with it CV
  // access and interview KPIs, for a candidate who was never interviewed.
  if (!isInterviewOrLaterStage(match.stage)) {
    // Interview rows are excluded: this function is what creates them, so they
    // cannot be the proof. Undone requests are accounted for by the helper.
    if (!(await matchReachedInterview(matchId, { includeInterviewRows: false }))) {
      throw new Error("match_not_at_interview_stage");
    }
  }

  const load = async () => {
    const { data, error } = await supabase
      .from("interviews")
      .select("id, status, created_at, position_id")
      .eq("organization_id", orgId)
      .eq("candidate_match_id", matchId);
    if (error) throw new Error(error.message);
    return (data as Array<{ id: string; status: string; created_at: string }>) ?? [];
  };

  let plan = planInterviewRecord(await load());
  const nowIso = new Date().toISOString();
  const step = async (id: string, to: "scheduled" | "completed") => {
    let patch: Record<string, unknown>;
    if (to === "scheduled") {
      patch = { status: "scheduled", scheduled_at: new Date().toISOString(), updated_by: userId };
    } else {
      // completed_at must not precede scheduled_at (database constraint). A
      // legacy row may still be scheduled in the future, and a concurrent
      // submit may have scheduled it a moment ago, so read it and take the later.
      const { data: row, error: rErr } = await supabase
        .from("interviews")
        .select("scheduled_at")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (rErr) throw new Error(rErr.message);
      const nowAt = new Date().toISOString();
      const scheduledAt = (row?.scheduled_at as string | null | undefined) ?? null;
      const completedAt =
        scheduledAt && Date.parse(scheduledAt) > Date.parse(nowAt) ? scheduledAt : nowAt;
      patch = { status: "completed", completed_at: completedAt, updated_by: userId };
    }
    const { error } = await supabase
      .from("interviews")
      .update(patch as never)
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
  };

  if (plan.kind === "create") {
    const { data: created, error } = await supabase
      .from("interviews")
      .insert({
        candidate_match_id: matchId,
        organization_id: orgId,
        position_id: match.position_id,
        candidate_submission_id: match.application_id ?? null,
        status: "scheduled",
        scheduled_at: nowIso,
        requested_at: nowIso,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) {
      // A concurrent submit created it first (unique active row per match): reuse that one.
      plan = planInterviewRecord(await load());
      if (plan.kind === "create") throw new Error(error.message);
    } else {
      await step(created.id as string, "completed");
      return { interviewId: created.id as string, positionId: match.position_id ?? null, matchId };
    }
  }
  if (plan.kind === "reuse") {
    for (const to of plan.advance) await step(plan.id, to);
    return { interviewId: plan.id, positionId: match.position_id ?? null, matchId };
  }
  throw new Error("interview_record_unavailable");
}

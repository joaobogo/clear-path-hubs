/**
 * recomputeScreeningEligibility — idempotent repair of candidate_matches
 * eligibility across ALL positions using the dealbreaker-only rule. Staff
 * only. Writes eligibility_checks for every not_eligible decision, removes
 * screening checks no longer supported, and logs each change to audit_events.
 * Never touches score runs, approvals or client visibility.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaff } from "@/lib/admin-ops.server";
import { planEligibilityRecompute } from "./screening-eligibility";

export const recomputeScreeningEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        position_id: z.string().uuid().optional(),
        dry_run: z.boolean().default(true),
        limit: z.number().int().min(1).max(500).default(200),
        after_id: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any;

    let q = s
      .from("candidate_matches")
      .select("id,application_id,position_id,organization_id,eligibility_status")
      .order("id")
      .limit(data.limit);
    if (data.position_id) q = q.eq("position_id", data.position_id);
    if (data.after_id) q = q.gt("id", data.after_id);
    const { data: matches, error } = await q;
    if (error) throw new Error(error.message);

    const results: Array<{ match_id: string; from: string | null; to: string | null; added: number; removed: number }> = [];
    for (const m of matches ?? []) {
      const [{ data: answers, error: aErr }, { data: checks, error: cErr }] = await Promise.all([
        s.from("application_answers")
          .select("question_id,answer,screening_questions(question,answer_type,dealbreaker,preferred_answer)")
          .eq("application_id", m.application_id),
        s.from("eligibility_checks").select("qualifier_key,status").eq("candidate_match_id", m.id),
      ]);
      if (aErr) throw new Error(aErr.message);
      if (cErr) throw new Error(cErr.message);
      const plan = planEligibilityRecompute({
        current_status: m.eligibility_status,
        existing_checks: checks ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        answers: (answers ?? []).map((r: any) => {
          const sq = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
          return {
            question_id: r.question_id,
            question: sq?.question ?? "",
            dealbreaker: sq?.dealbreaker ?? false,
            answer_type: sq?.answer_type ?? "text",
            preferred_answer: sq?.preferred_answer ?? null,
            value: r.answer,
          };
        }),
      });
      if (!plan.changed) continue;
      results.push({ match_id: m.id, from: m.eligibility_status, to: plan.next_status ?? m.eligibility_status, added: plan.upserts.length, removed: plan.stale_keys.length });
      if (data.dry_run) continue;

      if (plan.upserts.length) {
        const { error: uErr } = await s.from("eligibility_checks").upsert(
          plan.upserts.map((c) => ({ ...c, candidate_match_id: m.id, position_id: m.position_id, organization_id: m.organization_id, actor_user_id: context.userId })),
          { onConflict: "candidate_match_id,qualifier_key" },
        );
        if (uErr) throw new Error(uErr.message);
      }
      if (plan.stale_keys.length) {
        const { error: dErr } = await s.from("eligibility_checks").delete().eq("candidate_match_id", m.id).in("qualifier_key", plan.stale_keys);
        if (dErr) throw new Error(dErr.message);
      }
      if (plan.next_status && plan.next_status !== m.eligibility_status) {
        const { error: mErr } = await s.from("candidate_matches")
          .update({ eligibility_status: plan.next_status, eligibility_updated_at: new Date().toISOString() })
          .eq("id", m.id);
        if (mErr) throw new Error(mErr.message);
      }
      const { error: auditErr } = await s.from("audit_events").insert({
        actor_user_id: context.userId,
        organization_id: m.organization_id,
        entity_type: "candidate_match",
        entity_id: m.id,
        action: "eligibility_recomputed",
        before_state: { eligibility_status: m.eligibility_status },
        after_state: { eligibility_status: plan.next_status ?? m.eligibility_status, added_checks: plan.upserts.map((c) => c.qualifier_key), removed_checks: plan.stale_keys, rule: "dealbreaker_only" },
      });
      if (auditErr) throw new Error(auditErr.message);
    }
    const last = matches?.[matches.length - 1]?.id ?? null;
    return { examined: matches?.length ?? 0, changed: results.length, dry_run: data.dry_run, next_after_id: (matches?.length ?? 0) === data.limit ? last : null, results };
  });

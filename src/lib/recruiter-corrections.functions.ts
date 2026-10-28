import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireStaff } from "./admin-ops.server";
async function getAdmin() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin as any; }
type AnyRow = any;
// Staff-only editorial corrections leave score runs and release gates untouched.
export const updateRecruiterBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    match_id: z.string().uuid(),
    evidence_id: z.string().uuid(),
    expected_extracted: z.record(z.string(), z.unknown()),
    extracted: z.record(z.string(), z.unknown()),
    profile: z.object({
      linkedin_url: z.string().url().optional(),
      location: z.string().optional(), city: z.string().optional(),
      region: z.string().optional(), country: z.string().optional(),
      years_experience: z.number().int().min(0).max(60).optional(),
      full_name: z.string().min(1).max(200).optional(),
      portfolio_url: z.string().url().optional(),
    }),
    note: z.string().min(1).max(30000),
    reason: z.string().min(1).max(200),
    changes: z.array(z.object({
      field: z.string(), old: z.unknown(), new: z.unknown(), change_id: z.string(),
    })).max(100),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: match, error: matchError } = await s.from("candidate_matches")
      .select("id,candidate_profile_id,organization_id") .eq("id", data.match_id).single();
    if (matchError || !match) throw new Error("Candidate not found.");
    const { data: evidence, error: evidenceError } = await s.from("candidate_evidence")
      .select("id,extracted").eq("id", data.evidence_id)
      .eq("candidate_match_id", data.match_id).single();
    if (evidenceError || !evidence) throw new Error("Candidate evidence not found.");
    const stable = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
      if (value && typeof value === "object") return `{${Object.keys(value).sort()
        .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
      return JSON.stringify(value);
    };
    if (stable(evidence.extracted) !== stable(data.expected_extracted) &&
        stable(evidence.extracted) !== stable(data.extracted)) {
      throw new Error("Evidence changed. Reload before saving.");
    }
    const { error, data: updated } = await s.from("candidate_evidence")
      .update({ extracted: data.extracted as never })
      .eq("id", evidence.id).select("id");
    if (error) throw new Error(error.message);
    if (updated?.length !== 1) throw new Error("Evidence changed. Reload before saving.");
    if (Object.keys(data.profile).length) {
      const { error: profileError } = await s.from("candidate_profiles")
        .update(data.profile).eq("id", match.candidate_profile_id);
      if (profileError) throw new Error(profileError.message);
    }
    const { data: notes } = await s.from("candidate_notes").select("id,body")
      .eq("candidate_match_id", match.id);
    if (!notes?.some((n: AnyRow) => n.body === data.note)) {
      const { error: noteError } = await s.from("candidate_notes").insert({
        candidate_match_id: match.id, organization_id: match.organization_id,
        body: data.note, visibility: "internal", author_user_id: context.userId,
        note_type: "screening", client_shareable: false,
        revision_group_id: crypto.randomUUID(), revision_number: 1,
      });
      if (noteError) throw new Error(noteError.message);
    }
    for (const change of data.changes) {
      const { data: previous } = await s.from("audit_events").select("after_state")
        .eq("entity_id", match.id).eq("action", "recruiter_dossier_field_edit");
      if (previous?.some((event: AnyRow) => event.after_state?.reason === data.reason &&
          event.after_state?.change_id === change.change_id && event.after_state?.field === change.field)) continue;
      const { error: auditError } = await s.from("audit_events").insert({
        actor_user_id: context.userId, organization_id: match.organization_id,
        entity_type: "candidate_match", entity_id: match.id,
        action: "recruiter_dossier_field_edit",
        before_state: { field: change.field, value: change.old } as never,
        after_state: { field: change.field, value: change.new, reason: data.reason,
          change_id: change.change_id } as never,
      });
      if (auditError) throw new Error(auditError.message);
    }
    return { ok: true, changed_fields: data.changes.length };
  });

export const reassessRecruiterCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { executeScoring } = await import("./scoring-service.server");
    return executeScoring(data.match_id, { force: true, actor_user_id: context.userId,
      reason: "Recruiter review against current approved criteria" });
  });

export const sanitizePositionBriefings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ position_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { sanitizeGeneratedText } = await import("./scoring/protected-attributes");
    const { data: matches, error: matchError } = await s.from("candidate_matches")
      .select("id,organization_id").eq("position_id", data.position_id);
    if (matchError) throw new Error(matchError.message);
    let changed = 0;
    for (const match of matches ?? []) {
      const { data: evidenceRows, error: readError } = await s.from("candidate_evidence")
        .select("id,extracted").eq("candidate_match_id", match.id);
      if (readError) throw new Error(readError.message);
      for (const row of evidenceRows ?? []) {
        if (!row.extracted?.insights) continue;
        const insights = sanitizeGeneratedText(row.extracted.insights);
        if (JSON.stringify(insights) === JSON.stringify(row.extracted.insights)) continue;
        const { error } = await s.from("candidate_evidence").update({
          extracted: { ...row.extracted, insights },
        }).eq("id", row.id);
        if (error) throw new Error(error.message);
        const { error: auditError } = await s.from("audit_events").insert({
          actor_user_id: context.userId, organization_id: match.organization_id,
          entity_type: "candidate_match", entity_id: match.id,
          action: "briefing_protected_attributes_removed",
          after_state: { reason: "Removed protected-attribute text from generated briefing", evidence_id: row.id },
        });
        if (auditError) throw new Error(auditError.message);
        changed++;
      }
    }
    return { checked: matches?.length ?? 0, changed };
  });

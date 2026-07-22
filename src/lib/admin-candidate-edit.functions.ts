// Canonical admin candidate update service.
// Single write path for candidate_profiles edits from the admin drawer.
// - Validates fields
// - Preserves user-locked fields via `locked_fields` metadata on candidate_profiles.consent
// - Writes an audit event with actor/source-surface/trace id
// - Marks affected score runs stale via the parent match when scoring-relevant fields change
// - Returns read-after-write state
// - Explicit Legacy Bridge Repair path when no canonical profile exists
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

const traceId = () =>
  `ace_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// Fields the admin drawer may write. Everything is optional; only present keys are applied.
const editSchema = z.object({
  candidate_profile_id: z.string().uuid(),
  source_surface: z.enum([
    "admin_drawer_overview",
    "admin_drawer_contact",
    "admin_drawer_parsed_cv",
    "admin_drawer_enrichment",
    "admin_drawer_admin",
    "legacy_bridge_repair",
  ]),
  match_id: z.string().uuid().optional(),
  patch: z
    .object({
      full_name: z.string().trim().min(1).max(200).optional(),
      email: z.string().trim().email().max(320).optional(),
      phone: z.string().trim().max(80).optional().nullable(),
      location: z.string().trim().max(200).optional().nullable(),
      timezone: z.string().trim().max(80).optional().nullable(),
      headline: z.string().trim().max(300).optional().nullable(),
      summary: z.string().trim().max(4000).optional().nullable(),
      years_experience: z.number().int().min(0).max(80).optional().nullable(),
      linkedin_url: z.string().trim().url().max(500).optional().nullable(),
      experience: z.array(z.record(z.string(), z.unknown())).optional(),
      skills: z.array(z.string().min(1).max(80)).max(200).optional(),
      languages: z.array(z.record(z.string(), z.unknown())).optional(),
      education: z.array(z.record(z.string(), z.unknown())).optional(),
      work_authorization: z.record(z.string(), z.unknown()).optional(),
      availability: z.record(z.string(), z.unknown()).optional(),
      compensation_preferences: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: "patch cannot be empty" }),

  // Fields to lock against future auto-enrichment overwrites (["email","phone"] etc.)
  lock_fields: z.array(z.string()).max(30).optional(),
  // Explicit override — set true only for legacy_bridge_repair to allow overwriting a locked field.
  force_unlock: z.boolean().optional(),
});

// Fields whose change invalidates a score run.
const SCORING_RELEVANT = new Set([
  "skills",
  "experience",
  "education",
  "languages",
  "headline",
  "summary",
  "years_experience",
  "work_authorization",
]);


export const updateCandidateAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => editSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace = traceId();
    const s = await getAdmin();

    // 1. Resolve canonical profile
    const { data: before, error: readErr } = await s
      .from("candidate_profiles")
      .select("*")
      .eq("id", data.candidate_profile_id)
      .maybeSingle();
    if (readErr) return { ok: false, code: "read_failed", message: readErr.message, trace_id: trace };
    if (!before) {
      return {
        ok: false,
        code: "profile_missing",
        message:
          "No canonical candidate_profiles row. Use legacy_bridge_repair via updateCandidateAsAdmin to create one first.",
        trace_id: trace,
      };
    }

    // 2. Enforce locked-field policy
    const consent = (before.consent as AnyRow) ?? {};
    const locked: string[] = Array.isArray(consent.locked_fields) ? consent.locked_fields : [];
    if (!data.force_unlock) {
      for (const key of Object.keys(data.patch)) {
        if (locked.includes(key)) {
          return {
            ok: false,
            code: "field_locked",
            message: `Field "${key}" is user-confirmed locked. Retry with force_unlock=true (legacy bridge only) or unlock first.`,
            trace_id: trace,
          };
        }
      }
    }

    // 3. Build update payload; merge new locks into consent.locked_fields
    const updatePayload: AnyRow = { ...data.patch, updated_at: new Date().toISOString() };
    if (data.lock_fields && data.lock_fields.length > 0) {
      const merged = Array.from(new Set([...(locked as string[]), ...data.lock_fields]));
      updatePayload.consent = { ...consent, locked_fields: merged };
    }

    // 4. Apply update transactionally (Supabase single-row update is atomic)
    const { data: after, error: updErr } = await s
      .from("candidate_profiles")
      .update(updatePayload)
      .eq("id", data.candidate_profile_id)
      .select("*")
      .maybeSingle();
    if (updErr || !after) {
      return {
        ok: false,
        code: "write_failed",
        message: updErr?.message ?? "no row returned",
        trace_id: trace,
      };
    }

    // 5. Read-after-write verification (fresh SELECT confirms fields persisted)
    const { data: verify, error: verifyErr } = await s
      .from("candidate_profiles")
      .select("*")
      .eq("id", data.candidate_profile_id)
      .maybeSingle();
    if (verifyErr || !verify) {
      // Roll back the write
      await s.from("candidate_profiles").update(before).eq("id", data.candidate_profile_id);
      return {
        ok: false,
        code: "verify_failed",
        message: verifyErr?.message ?? "readback missing",
        trace_id: trace,
      };
    }
    const drift: string[] = [];
    for (const [k, v] of Object.entries(data.patch)) {
      const persisted = (verify as AnyRow)[k];
      if (JSON.stringify(persisted) !== JSON.stringify(v)) drift.push(k);
    }
    if (drift.length > 0) {
      // Roll back on partial persistence to avoid stale UI
      await s.from("candidate_profiles").update(before).eq("id", data.candidate_profile_id);
      return {
        ok: false,
        code: "readback_drift",
        message: `Fields did not persist: ${drift.join(", ")}`,
        trace_id: trace,
      };
    }

    // 6. Audit event (persisted with returned id)
    const { data: audit } = await s
      .from("audit_events")
      .insert({
        actor_user_id: context.userId,
        entity_type: "candidate_profiles",
        entity_id: data.candidate_profile_id,
        action: "candidate.update",
        before_state: before,
        after_state: verify,
        trace_id: trace,
        metadata: {
          source_surface: data.source_surface,
          patched_fields: Object.keys(data.patch),
          locked_fields_added: data.lock_fields ?? [],
          match_id: data.match_id ?? null,
        },
      })
      .select("id")
      .maybeSingle();

    // 7. Mark affected score runs stale when scoring-relevant fields changed
    const scoringChanged = Object.keys(data.patch).some((k) => SCORING_RELEVANT.has(k));
    let stale_marked = 0;
    if (scoringChanged) {
      const { data: matches } = await s
        .from("candidate_matches")
        .select("id,current_score_run_id")
        .eq("candidate_profile_id", data.candidate_profile_id);
      for (const m of (matches ?? []) as AnyRow[]) {
        if (m.current_score_run_id) {
          await s
            .from("score_runs")
            .update({ contradiction_status: "stale_inputs" })
            .eq("id", m.current_score_run_id)
            .in("status", ["completed"]);
          stale_marked++;
        }
      }
    }

    return {
      ok: true,
      trace_id: trace,
      audit_event_id: audit?.id ?? null,
      profile: verify,
      scoring_relevant: scoringChanged,
      stale_marked,
    };
  });


// Legacy Bridge Repair — resolve or create the canonical candidate_profiles row,
// then relink an orphan match/application to that profile.
export const repairCandidateIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        full_name: z.string().trim().min(1).max(200),
        phone: z.string().trim().max(80).optional(),
        // Optional: relink these to the resolved profile atomically.
        match_id: z.string().uuid().optional(),
        application_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace = traceId();
    const s = await getAdmin();

    // Idempotent resolve by lowercased email
    const { data: existing } = await s
      .from("candidate_profiles")
      .select("*")
      .ilike("email", data.email)
      .maybeSingle();

    let profile = existing;
    let created = false;
    if (!profile) {
      const { data: inserted, error } = await s
        .from("candidate_profiles")
        .insert({
          full_name: data.full_name,
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
        })
        .select("*")
        .maybeSingle();
      if (error || !inserted) {
        return { ok: false, code: "insert_failed", message: error?.message, trace_id: trace };
      }
      profile = inserted;
      created = true;
    }

    // Relink orphan rows to the resolved profile (never silently creates duplicates)
    const relinked: { match?: string; application?: string } = {};
    if (data.match_id) {
      const { data: m } = await s
        .from("candidate_matches")
        .update({ candidate_profile_id: profile.id })
        .eq("id", data.match_id)
        .select("id")
        .maybeSingle();
      if (m) relinked.match = m.id;
    }
    if (data.application_id) {
      const { data: a } = await s
        .from("applications")
        .update({ candidate_profile_id: profile.id })
        .eq("id", data.application_id)
        .select("id")
        .maybeSingle();
      if (a) relinked.application = a.id;
    }

    const { data: audit } = await s
      .from("audit_events")
      .insert({
        actor_user_id: context.userId,
        entity_type: "candidate_profiles",
        entity_id: profile.id,
        action: created ? "candidate.repair_identity_create" : "candidate.repair_identity_relink",
        after_state: profile,
        trace_id: trace,
        metadata: { source_surface: "legacy_bridge_repair", relinked },
      })
      .select("id")
      .maybeSingle();

    return {
      ok: true,
      created,
      profile,
      relinked,
      audit_event_id: audit?.id ?? null,
      trace_id: trace,
    };
  });


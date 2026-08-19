// Admin candidate database — list index, notes, contact release and profile extras.
// Every read/mutation is staff-gated. The list reads the flattened
// v_admin_candidate_index view so filtering, sorting, counting and pagination
// all happen in Postgres: the displayed total always reconciles with the rows.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

// One shared server-side staff guard for the whole admin surface.
async function requireStaff(userId: string) {
  const { requireStaff: guard } = await import("./admin-ops.server");
  await guard(userId);
}

async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_id: string;
  organization_id?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "candidate_match",
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
  });
}

// ─── List ────────────────────────────────────────────────────────────────────

export const CANDIDATE_SORTS = [
  "updated_desc",
  "updated_asc",
  "created_desc",
  "created_asc",
  "score_desc",
  "score_asc",
  "name_asc",
] as const;

const listInput = z.object({
  q: z.string().max(200).optional(),
  organization_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  stage: z.string().optional(),
  admin_status: z.string().optional(),
  processing_state: z.string().optional(),
  client_visibility: z.string().optional(),
  eligibility_status: z.string().optional(),
  recommendation: z.string().optional(),
  score_band: z.string().optional(),
  fit_label: z.string().optional(),
  confidence: z.string().optional(), // high | medium | low
  contact_released: z.string().optional(), // released | withheld
  critical: z.string().optional(), // flagged | clear
  country: z.string().optional(),
  source: z.string().optional(),
  rejection_reason: z.string().max(64).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort: z.enum(CANDIDATE_SORTS).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export type CandidateIndexFilters = z.infer<typeof listInput>;

const SORTS: Record<
  (typeof CANDIDATE_SORTS)[number],
  { col: string; asc: boolean }
> = {
  updated_desc: { col: "updated_at", asc: false },
  updated_asc: { col: "updated_at", asc: true },
  created_desc: { col: "created_at", asc: false },
  created_asc: { col: "created_at", asc: true },
  score_desc: { col: "score", asc: false },
  score_asc: { col: "score", asc: true },
  name_asc: { col: "full_name", asc: true },
};

export const searchCandidateIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { loadTestScope } = await import("./admin-test-scope.server");
    const scope = await loadTestScope(s);
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    const sort = SORTS[data.sort ?? "updated_desc"];

    let q = s.from("v_admin_candidate_index").select("*", { count: "exact" });

    // The global "Show test records" preference hides QA fixtures from
    // default admin lists and pickers, so the total matches the visible rows.
    if (!scope.includeTest) {
      q = q.eq("is_test_record", false);
    }

    if (data.rejection_reason) {
      // Reason lives on the decision rows, not on the match — resolve the ids
      // first so the filter can never silently return an unfiltered page.
      const { data: decisions, error: decisionError } = await s
        .from("v_rejection_decisions")
        .select("match_id")
        .eq("reason_code", data.rejection_reason)
        .limit(5000);
      if (decisionError) throw new Error(decisionError.message);
      const ids = [...new Set(((decisions ?? []) as AnyRow[]).map((r) => r.match_id as string))];
      if (ids.length === 0) return { rows: [], total: 0, limit, offset };
      q = q.in("match_id", ids);
    }
    if (data.q) {
      const { ilikeValue } = await import("./search/postgrest-filter");
      const val = ilikeValue(data.q);
      if (val) {
        // Multi-column search across name, email, organization and full index.
        // B2: Ensure every query is quoted safely and matches the view columns.
        q = q.or(
          `full_name.ilike.${val},email.ilike.${val},org_name.ilike.${val},search_vector.ilike.${val}`
        );
      }
    }

    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (data.position_id) q = q.eq("position_id", data.position_id);
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.admin_status) q = q.eq("admin_status", data.admin_status);
    if (data.processing_state) q = q.eq("processing_state", data.processing_state);
    if (data.client_visibility) q = q.eq("client_visibility", data.client_visibility);
    if (data.eligibility_status) q = q.eq("eligibility_status", data.eligibility_status);
    if (data.recommendation) q = q.eq("recommendation", data.recommendation);
    if (data.score_band) q = q.eq("score_band", data.score_band);
    if (data.fit_label) q = q.eq("fit_label", data.fit_label);
    if (data.country) q = q.eq("country", data.country);
    if (data.source) q = q.eq("source_kind", data.source);
    if (data.contact_released === "released") q = q.eq("contact_released", true);
    if (data.contact_released === "withheld") q = q.eq("contact_released", false);
    if (data.critical === "flagged") q = q.eq("has_critical_flag", true);
    if (data.critical === "clear") q = q.eq("has_critical_flag", false);
    if (data.confidence === "high") q = q.gte("confidence", 0.8);
    if (data.confidence === "medium") q = q.gte("confidence", 0.5).lt("confidence", 0.8);
    if (data.confidence === "low") q = q.lt("confidence", 0.5);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);

    q = q
      .order(sort.col, { ascending: sort.asc, nullsFirst: false })
      .order("match_id", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as AnyRow[],
      total: count ?? 0,
      limit,
      offset,
    };
  });

/** Distinct countries present in the index — powers the location filter. */
export const listCandidateCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { loadTestScope } = await import("./admin-test-scope.server");
    const scope = await loadTestScope(s);
    let q = s
      .from("v_admin_candidate_index")
      .select("country")
      .not("country", "is", null)
      .limit(5000);
    if (!scope.includeTest) {
      q = q.eq("is_test_record", false);
    }
    const { data } = await q;
    const set = new Set<string>();
    for (const r of (data ?? []) as AnyRow[]) if (r.country) set.add(r.country);
    return [...set].sort();
  });

// ─── Bulk actions ────────────────────────────────────────────────────────────

/**
 * Bulk publish / unpublish. Each row is evaluated independently against the
 * same publish gate as the single-row action; failures are reported per row and
 * never silently swallowed.
 */
export const bulkSetClientVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_ids: z.array(z.string().uuid()).min(1).max(50),
        visibility: z.enum(["visible", "hidden"]),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const id of data.match_ids) {
      const { data: before } = await s
        .from("candidate_matches")
        .select("id,organization_id,client_visibility,canonical_state,approved_score_run_id,integrity_status")
        .eq("id", id)
        .maybeSingle();
      if (!before) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      if (data.visibility === "visible" && !before.approved_score_run_id) {
        results.push({ id, ok: false, error: "No approved score run" });
        continue;
      }
      const patch =
        data.visibility === "visible"
          ? {
              client_visibility: "visible",
              canonical_state: "published_to_client",
              contact_released_at: new Date().toISOString(),
              contact_released_by: context.userId,
              contact_release_reason: "Released automatically at bulk publish to client",
            }
          : { client_visibility: "hidden" };
      const { error } = await s.from("candidate_matches").update(patch).eq("id", id);
      if (error) {
        results.push({ id, ok: false, error: error.message });
        continue;
      }
      await writeAudit({
        actor: context.userId,
        action: data.visibility === "visible" ? "bulk_publish" : "bulk_unpublish",
        entity_id: id,
        organization_id: before.organization_id,
        before,
        after: { ...patch, reason: data.reason ?? null },
      });
      results.push({ id, ok: true });
    }

    return {
      results,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    };
  });

// ─── Contact release ─────────────────────────────────────────────────────────

export const setContactRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        released: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: before } = await s
      .from("candidate_matches")
      .select("id,organization_id,contact_released_at,client_visibility")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!before) throw new Error("not_found");
    if (data.released && before.client_visibility !== "visible") {
      throw new Error("Publish the candidate to the client before releasing contact details.");
    }
    if (data.released && !data.reason?.trim()) {
      throw new Error("A reason is required when releasing contact details.");
    }
    const patch = data.released
      ? {
          contact_released_at: new Date().toISOString(),
          contact_released_by: context.userId,
          contact_release_reason: data.reason?.trim() ?? null,
        }
      : { contact_released_at: null, contact_released_by: null, contact_release_reason: null };

    const { error } = await s.from("candidate_matches").update(patch).eq("id", data.match_id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: data.released ? "contact_released" : "contact_release_revoked",
      entity_id: data.match_id,
      organization_id: before.organization_id,
      before,
      after: patch,
    });
    return { ok: true as const, released: data.released };
  });

// ─── Notes ───────────────────────────────────────────────────────────────────

export const listCandidateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("candidate_notes")
      .select("id,body,visibility,author_user_id,created_at,updated_at")
      .eq("candidate_match_id", data.match_id)
      .order("created_at", { ascending: false });
    return (rows ?? []) as AnyRow[];
  });

export const addCandidateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        body: z.string().trim().min(2).max(8000),
        visibility: z.enum(["internal", "client_visible"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: m } = await s
      .from("candidate_matches")
      .select("id,organization_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("not_found");
    const { data: row, error } = await s
      .from("candidate_notes")
      .insert({
        candidate_match_id: data.match_id,
        organization_id: m.organization_id,
        body: data.body,
        visibility: data.visibility,
        author_user_id: context.userId,
      })
      .select("id,body,visibility,author_user_id,created_at")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: "candidate_note_added",
      entity_id: data.match_id,
      organization_id: m.organization_id,
      after: { visibility: data.visibility, note_id: row.id },
    });
    return row as AnyRow;
  });

export const deleteCandidateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ note_id: z.string().uuid(), match_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: before } = await s
      .from("candidate_notes")
      .select("id,body,visibility,organization_id")
      .eq("id", data.note_id)
      .maybeSingle();
    if (!before) throw new Error("not_found");
    await s.from("candidate_notes").delete().eq("id", data.note_id);
    await writeAudit({
      actor: context.userId,
      action: "candidate_note_deleted",
      entity_id: data.match_id,
      organization_id: before.organization_id,
      before,
    });
    return { ok: true as const };
  });

// ─── Profile extras: intake answers, duplicates, audit, interviews, messages ──

export const getCandidateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // The staff gate and the admin client are independent; awaiting them
    // together removes a round trip before the first read.
    const [, s] = await Promise.all([requireStaff(context.userId), getAdmin()]);


    const { data: m } = await s
      .from("candidate_matches")
      .select(
        "id,application_id,candidate_profile_id,organization_id,position_id,stage,contact_released_at,contact_released_by,contact_release_reason,client_visibility,eligibility_status,recommendation,recommendation_reason,integrity_status,evidence_confidence,canonical_state",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("not_found");

    const [profileRes, appRes, answersRes, notesRes, auditRes, interviewsRes, filesRes] =
      await Promise.all([
        s
          .from("candidate_profiles")
          .select(
            "id,full_name,email,phone,country,region,city,location,linkedin_url,portfolio_url,website_url,created_at,updated_at,current_cv_file_id,consent",

          )
          .eq("id", m.candidate_profile_id)
          .maybeSingle(),
        s
          .from("applications")
          .select(
            "id,source,source_kind,source_channel,status,applied_at,cover_letter,portfolio_url,accommodation_request,question_version,consent",
          )
          .eq("id", m.application_id)
          .maybeSingle(),
        s
          .from("application_answers")
          .select("id,question_id,answer,created_at,screening_questions(question,answer_type,required,dealbreaker,preferred_answer)")
          .eq("application_id", m.application_id)
          .order("created_at", { ascending: true }),


        s
          .from("candidate_notes")
          .select("id,body,visibility,author_user_id,created_at")
          .eq("candidate_match_id", data.match_id)
          .order("created_at", { ascending: false }),
        s
          .from("audit_events")
          .select("id,action,actor_user_id,created_at,before_state,after_state")
          .eq("entity_type", "candidate_match")
          .eq("entity_id", data.match_id)
          .order("created_at", { ascending: false })
          .limit(50),
        s
          .from("interviews")
          .select("id,status,scheduled_at,completed_at,interview_type,created_at")
          .eq("candidate_match_id", data.match_id)
          .order("created_at", { ascending: false })
          .limit(20),
        s
          .from("files")
          .select("id,filename,parse_state,parse_error,parser,parser_version,page_count,extraction_completed_at,created_at,size")
          .eq("candidate_profile_id", m.candidate_profile_id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    // Potential duplicates — surfaced for manual resolution only. Never merged.
    const profile = profileRes.data as AnyRow | null;
    let duplicates: AnyRow[] = [];
    if (profile) {
      const orParts: string[] = [];
      const { eqValue } = await import("./search/postgrest-filter");
      if (profile.email) orParts.push(`email.eq.${eqValue(String(profile.email))}`);
      if (profile.phone) orParts.push(`phone.eq.${eqValue(String(profile.phone))}`);
      if (profile.full_name) orParts.push(`full_name.eq.${eqValue(String(profile.full_name))}`);
      if (orParts.length) {
        const { data: dupes } = await s
          .from("candidate_profiles")
          .select("id,full_name,email,phone,created_at")
          .or(orParts.join(","))
          .neq("id", profile.id)
          .limit(10);
        duplicates = ((dupes ?? []) as AnyRow[]).map((d) => ({
          ...d,
          reasons: [
            d.email && d.email === profile.email ? "Same email" : null,
            d.phone && d.phone === profile.phone ? "Same phone" : null,
            d.full_name && d.full_name === profile.full_name ? "Same name" : null,
          ].filter(Boolean),
        }));
      }
    }

    return {
      match: m as AnyRow,
      profile,
      application: (appRes.data ?? null) as AnyRow,
      answers: (answersRes.data ?? []) as AnyRow[],
      notes: (notesRes.data ?? []) as AnyRow[],
      audit: (auditRes.data ?? []) as AnyRow[],
      interviews: (interviewsRes.data ?? []) as AnyRow[],
      documents: (filesRes.data ?? []) as AnyRow[],
      duplicates,
    };
  });

// ─── Profile field editing (admin) ───────────────────────────────────────────
// Minimal inline edit for LinkedIn and location on the candidate detail page.
// These fields are surfaced to clients, so admin must be able to correct them.

const adminProfileFieldSchema = z.object({
  candidate_profile_id: z.string().uuid(),
  linkedin_url: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), {
      message: "Enter a full URL starting with https://",
    }),
  location: z.string().trim().max(200).optional().nullable(),
});

export const updateCandidateProfileField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminProfileFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const patch: Record<string, unknown> = {};
    if (data.linkedin_url !== undefined) patch.linkedin_url = data.linkedin_url || null;
    if (data.location !== undefined) patch.location = data.location || null;

    if (Object.keys(patch).length === 0) return { ok: true as const, updated: [] as string[] };

    const { data: before } = await s
      .from("candidate_profiles")
      .select("id,linkedin_url,location")
      .eq("id", data.candidate_profile_id)
      .maybeSingle();

    const { error } = await s
      .from("candidate_profiles")
      .update(patch)
      .eq("id", data.candidate_profile_id);
    if (error) throw new Error(error.message);

    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "candidate_profiles",
      entity_id: data.candidate_profile_id,
      action: "admin_profile_field_edit",
      before_state: { linkedin_url: before?.linkedin_url ?? null, location: before?.location ?? null } as never,
      after_state: patch as never,
    });

    return { ok: true as const, updated: Object.keys(patch) };
  });

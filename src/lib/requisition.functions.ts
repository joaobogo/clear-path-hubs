// Phase 8 — requisition (job) structured layer: multi-location, evaluation
// priorities, ownership, compensation permissioning, versioning + rescore.
// Auth: platform staff OR client_editor on the position's organization.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  assessJobQuality,
  balanceWeights,
  normalizeWeights,
  requisitionMetaSchema,
  type EvaluationWeights,
  countryName,
  type RequisitionLocation,
} from "@/lib/requisition-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function assertCanEdit(userId: string, positionId: string) {
  const s = await admin();
  const { data: pos } = await s
    .from("positions")
    .select("id,organization_id,title,department,status,visibility")
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { data: staff } = await s.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return { pos, isStaff: true as const };
  const { data: editor } = await s.rpc("is_org_editor", { _user: userId, _org: pos.organization_id });
  if (editor !== true) throw new Error("forbidden");
  return { pos, isStaff: false as const };
}

const traceId = () => `rq_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

function rowsToLocations(rows: AnyRow[]): RequisitionLocation[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    country_code: r.country_code,
    region: r.region ?? "",
    city: r.city ?? "",
    work_model: r.work_model,
    is_primary: !!r.is_primary,
    headcount: r.headcount ?? null,
    timezone: r.timezone ?? "",
    onsite_days_per_week: r.onsite_days_per_week ?? null,
    notes: r.notes ?? "",
  }));
}

export type RequisitionMeta = {
  position_id: string;
  organization_id: string;
  organization_name: string;
  status: string;
  reference_code: string;
  owner_user_id: string | null;
  travel_expectation: string;
  primary_timezone: string;
  timezone_overlap_hours: number | null;
  target_start_date: string;
  compensation_collected: boolean;
  compensation_visibility: "internal" | "client" | "public";
  currency: string;
  budget_min: string;
  budget_max: string;
  evaluation_weights: EvaluationWeights;
  locations: RequisitionLocation[];
  content_version: number;
  rescore_state: string;
  rescore_requested_at: string | null;
  can_edit_compensation: boolean;
  owners: Array<{ id: string; name: string }>;
  versions: Array<{ version_number: number; created_at: string; title: string; created_by_name: string }>;
};

export const getRequisitionMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<RequisitionMeta> => {
    const { isStaff } = await assertCanEdit(context.userId, data.id);
    const s = await admin();

    const [posRes, locRes, verRes, staffRes] = await Promise.all([
      s.from("positions").select("*,organizations(id,name)").eq("id", data.id).maybeSingle(),
      s.from("position_locations").select("*").eq("position_id", data.id).order("display_order", { ascending: true }),
      s
        .from("position_versions")
        .select("version_number,created_at,title,created_by")
        .eq("position_id", data.id)
        .order("version_number", { ascending: false })
        .limit(25),
      s.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const p = posRes.data as AnyRow;
    if (!p) throw new Error("position_not_found");

    const staffIds = ((staffRes.data ?? []) as AnyRow[]).map((r) => r.user_id);
    const versionUserIds = ((verRes.data ?? []) as AnyRow[]).map((r) => r.created_by).filter(Boolean);
    const profileIds = Array.from(new Set([...staffIds, ...versionUserIds]));
    const { data: profiles } = profileIds.length
      ? await s.from("profiles").select("auth_user_id,full_name,email").in("auth_user_id", profileIds)
      : { data: [] as AnyRow[] };
    const nameOf = new Map(
      ((profiles ?? []) as AnyRow[]).map((r) => [r.auth_user_id, r.full_name || r.email || "Unknown"]),
    );

    const comp = (p.compensation ?? {}) as AnyRow;

    return {
      position_id: p.id,
      organization_id: p.organization_id,
      organization_name: p.organizations?.name ?? "",
      status: p.status ?? "draft",
      reference_code: p.reference_code ?? "",
      owner_user_id: p.owner_user_id ?? null,
      travel_expectation: p.travel_expectation ?? "",
      primary_timezone: p.primary_timezone ?? "",
      timezone_overlap_hours: p.timezone_overlap_hours ?? null,
      target_start_date: p.target_start_date ?? "",
      compensation_collected: !!p.compensation_collected,
      compensation_visibility: (p.compensation_visibility ?? "internal") as RequisitionMeta["compensation_visibility"],
      currency: typeof comp.currency === "string" && comp.currency ? comp.currency : "USD",
      budget_min: typeof comp.budget_min === "string" ? comp.budget_min : "",
      budget_max: typeof comp.budget_max === "string" ? comp.budget_max : "",
      evaluation_weights: normalizeWeights(p.evaluation_weights),
      locations: rowsToLocations(locRes.data as AnyRow[]),
      content_version: p.content_version ?? 1,
      rescore_state: p.rescore_state ?? "current",
      rescore_requested_at: p.rescore_requested_at ?? null,
      can_edit_compensation: isStaff,
      owners: isStaff ? staffIds.map((id: string) => ({ id, name: nameOf.get(id) ?? "Unknown" })) : [],
      versions: ((verRes.data ?? []) as AnyRow[]).map((r) => ({
        version_number: r.version_number,
        created_at: r.created_at,
        title: r.title ?? "",
        created_by_name: r.created_by ? (nameOf.get(r.created_by) ?? "Unknown") : "System",
      })),
    };
  });

/** Duplicate-requisition guard used before creating or renaming a job. */
export const checkRequisitionDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        department: z.string().trim().max(200).default(""),
        reference_code: z.string().trim().max(40).default(""),
        exclude_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const s = await admin();
    const { data: staff } = await s.rpc("is_platform_staff", { _user: context.userId });
    if (staff !== true) {
      const { data: editor } = await s.rpc("is_org_editor", {
        _user: context.userId,
        _org: data.organization_id,
      });
      if (editor !== true) throw new Error("forbidden");
    }

    let q = s
      .from("positions")
      .select("id,title,department,status,reference_code,created_at")
      .eq("organization_id", data.organization_id)
      .in("status", ["draft", "submitted", "under_review", "needs_clarification", "approved", "active", "paused"]);
    if (data.exclude_id) q = q.neq("id", data.exclude_id);
    const { data: rows } = await q;

    const norm = (v: string) => v.trim().toLowerCase();
    const matches = ((rows ?? []) as AnyRow[]).filter(
      (r) =>
        (norm(r.title ?? "") === norm(data.title) &&
          norm(r.department ?? "") === norm(data.department)) ||
        (!!data.reference_code && norm(r.reference_code ?? "") === norm(data.reference_code)),
    );

    return {
      duplicate: matches.length > 0,
      matches: matches.slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title,
        department: r.department ?? "",
        status: r.status,
        reference_code: r.reference_code ?? "",
      })),
    };
  });

export const saveRequisitionMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => requisitionMetaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { pos, isStaff } = await assertCanEdit(context.userId, data.position_id);
    const s = await admin();
    const trace_id = traceId();

    // Reference code must be unique inside the organization.
    if (data.reference_code) {
      const { data: clash } = await s
        .from("positions")
        .select("id")
        .eq("organization_id", pos.organization_id)
        .ilike("reference_code", data.reference_code)
        .neq("id", data.position_id)
        .maybeSingle();
      if (clash) throw new Error(`Reference ID "${data.reference_code}" is already used by another job for this client.`);
    }

    // Weights: enforce safe band + normalise to 100 so ranking stays explainable.
    const weights = balanceWeights(normalizeWeights(data.evaluation_weights));

    const { data: prior } = await s
      .from("positions")
      .select("compensation,evaluation_weights,compensation_collected,compensation_visibility,content_version")
      .eq("id", data.position_id)
      .maybeSingle();
    const priorComp = (prior?.compensation ?? {}) as AnyRow;

    const weightsChanged =
      JSON.stringify(normalizeWeights(prior?.evaluation_weights)) !== JSON.stringify(weights);

    const patch: AnyRow = {
      reference_code: data.reference_code || null,
      owner_user_id: isStaff ? data.owner_user_id : prior?.owner_user_id ?? null,
      travel_expectation: data.travel_expectation || null,
      primary_timezone: data.primary_timezone || null,
      timezone_overlap_hours: data.timezone_overlap_hours,
      target_start_date: data.target_start_date || null,
      evaluation_weights: weights,
      updated_at: new Date().toISOString(),
    };

    // Compensation is only stored when intentionally collected, and only
    // platform staff may change the collection/visibility decision.
    if (isStaff) {
      patch.compensation_collected = data.compensation_collected;
      patch.compensation_visibility = data.compensation_visibility;
      patch.compensation = data.compensation_collected
        ? {
            ...priorComp,
            currency: data.currency || "USD",
            budget_min: data.budget_min || null,
            budget_max: data.budget_max || null,
          }
        : { ...priorComp, currency: null, budget_min: null, budget_max: null };
    }

    const { error: upErr } = await s.from("positions").update(patch).eq("id", data.position_id);
    if (upErr) throw new Error(upErr.message);

    // --- locations: replace-by-diff, keeping stable ids where possible ---
    const { data: existing } = await s
      .from("position_locations")
      .select("id")
      .eq("position_id", data.position_id);
    const existingIds = new Set(((existing ?? []) as AnyRow[]).map((r) => r.id));
    const keptIds = new Set(data.locations.map((l) => l.id).filter((v): v is string => !!v));
    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

    // Clear primary flags first so the single-primary index never trips mid-write.
    await s.from("position_locations").update({ is_primary: false }).eq("position_id", data.position_id);
    if (toDelete.length) {
      const { error } = await s.from("position_locations").delete().in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    const hasPrimary = data.locations.some((l) => l.is_primary);
    for (let i = 0; i < data.locations.length; i++) {
      const l = data.locations[i];
      const row = {
        position_id: data.position_id,
        organization_id: pos.organization_id,
        country_code: l.country_code,
        country: countryName(l.country_code),
        region: l.region || null,
        city: l.city || null,
        work_model: l.work_model,
        is_primary: hasPrimary ? l.is_primary : i === 0,
        headcount: l.headcount,
        timezone: l.timezone || null,
        onsite_days_per_week: l.onsite_days_per_week,
        notes: l.notes || null,
        display_order: i,
      };
      if (l.id && existingIds.has(l.id)) {
        const { error } = await s.from("position_locations").update(row).eq("id", l.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await s.from("position_locations").insert(row);
        if (error) throw new Error(error.message);
      }
    }

    // Keep the legacy single-line location readable for the job board.
    const primary = data.locations.find((l) => l.is_primary) ?? data.locations[0];
    if (primary) {
      const label = [primary.city, primary.region].filter(Boolean).join(", ");
      const extra = data.locations.length > 1 ? ` +${data.locations.length - 1} more` : "";
      await s
        .from("positions")
        .update({
          location: `${label ? `${label}, ` : ""}${primary.country_code}${extra}`,
          work_model: primary.work_model,
        })
        .eq("id", data.position_id);
    }

    const { data: after } = await s.from("positions").select("*").eq("id", data.position_id).maybeSingle();

    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      action: weightsChanged ? "position.weights_changed" : "position.requisition_updated",
      entity_type: "position",
      entity_id: data.position_id,
      organization_id: pos.organization_id,
      before_state: (prior ?? null) as never,
      after_state: { ...patch, locations: data.locations, change_reason: data.change_reason } as never,
      trace_id,
    });

    return {
      ok: true as const,
      trace_id,
      weights,
      rescore_state: (after?.rescore_state ?? "current") as string,
      content_version: (after?.content_version ?? 1) as number,
      rescore_required: (after?.rescore_state ?? "current") !== "current",
    };
  });

/** Acknowledge a pending rescore: creates a controlled rescore event. */
export const requestRequisitionRescore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).default("") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { pos } = await assertCanEdit(context.userId, data.id);
    const s = await admin();
    const trace_id = traceId();

    const { data: p } = await s
      .from("positions")
      .select("content_version,rescore_state")
      .eq("id", data.id)
      .maybeSingle();

    await s.from("positions").update({ rescore_state: "running" }).eq("id", data.id);

    const { count } = await s
      .from("candidate_matches")
      .select("id", { count: "exact", head: true })
      .eq("position_id", data.id);

    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "position.rescore_requested",
      entity_type: "position",
      entity_id: data.id,
      organization_id: pos.organization_id,
      before_state: (p ?? null) as never,
      after_state: {
        reason: data.reason,
        content_version: p?.content_version ?? 1,
        candidates_affected: count ?? 0,
      } as never,
      trace_id,
    });

    await s.from("positions").update({ rescore_state: "current", rescore_requested_at: null }).eq("id", data.id);

    return { ok: true as const, trace_id, candidates_affected: count ?? 0 };
  });

/** Server-side quality read used by list views and the job detail page. */
export const getRequisitionQuality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.userId, data.id);
    const s = await admin();
    const [posRes, locRes, sqRes] = await Promise.all([
      s.from("positions").select("*").eq("id", data.id).maybeSingle(),
      s.from("position_locations").select("*").eq("position_id", data.id),
      s.from("screening_questions").select("id").eq("position_id", data.id),
    ]);
    const p = posRes.data as AnyRow;
    if (!p) throw new Error("position_not_found");
    const ctx = (p.intake_context ?? {}) as AnyRow;
    const labels = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map((x) => (typeof x === "string" ? x : String((x as AnyRow)?.label ?? ""))).filter(Boolean)
        : [];

    const input = {
      title: p.title ?? "",
      description: p.description ?? "",
      seniority: p.seniority ?? "",
      employment_type: p.employment_type ?? "",
      department: p.department ?? "",
      must_have_skills: labels(p.requirements),
      nice_to_have_skills: labels(p.preferred_requirements),
      disqualifier_tags: labels(p.dealbreakers),
      responsibilities: typeof ctx.responsibilities === "string" ? ctx.responsibilities : "",
      experience: typeof ctx.experience === "string" ? ctx.experience : "",
      interview_process: typeof ctx.interview_process === "string" ? ctx.interview_process : "",
      screening_questions: ((sqRes.data ?? []) as AnyRow[]).map((q) => ({
        id: String(q.id ?? ""),
      })),
      locations: rowsToLocations(locRes.data as AnyRow[]),
      travel_expectation: p.travel_expectation ?? "",
      primary_timezone: p.primary_timezone ?? "",
      timezone_overlap_hours: p.timezone_overlap_hours ?? null,
      target_start_date: p.target_start_date ?? "",
      headcount: p.openings ?? null,
      owner_user_id: p.owner_user_id ?? null,
      reference_code: p.reference_code ?? "",
      compensation_collected: !!p.compensation_collected,
    };

    // The assessed input travels back so live editors (the role wizard) can
    // re-run the same pure assessment against unsaved draft values.
    return { ...assessJobQuality(input), input };
  });

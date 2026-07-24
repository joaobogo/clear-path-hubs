// Shared wizard-based position editor. Auth: platform staff OR client_editor
// on the position's organization. Mirrors the public intake wizard 1:1 so
// admins and clients edit positions with the same questions candidates and
// clients answered during intake.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function assertCanEdit(userId: string, positionId: string) {
  const s = await getAdmin();
  const { data: pos } = await s
    .from("positions")
    .select("id,organization_id,title,status")
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { data: staff } = await s.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return pos;
  const { data: editor } = await s.rpc("is_org_editor", {
    _user: userId,
    _org: pos.organization_id,
  });
  if (editor !== true) throw new Error("forbidden");
  return pos;
}

async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_id: string;
  organization_id: string;
  before?: unknown;
  after?: unknown;
  trace_id: string;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "position",
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

const traceId = () =>
  `pe_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export type ScreeningInput = {
  id?: string;
  question: string;
  answer_type: "text" | "boolean" | "number";
  required: boolean;
  dealbreaker: boolean;
};

export type PositionEditInitial = {
  id: string;
  organization_id: string;
  organization_name: string;
  status: string;

  // Step 1 — Role Definition
  title: string;
  department: string;
  location: string;
  work_model: "" | "remote" | "hybrid" | "onsite";
  employment_type: "" | "full_time" | "part_time" | "contract" | "temporary" | "internship";
  seniority: string;
  headcount: number | "";
  description: string;
  open_worldwide: boolean;
  target_countries: string[];
  states_regions: string[];
  metro_areas: string[];
  search_radius: string;
  hiring_urgency: string;
  target_start_date: string;
  time_to_hire: string;

  // Step 2 — Candidate Profile
  must_have_skills: string[];
  nice_to_have_skills: string[];
  certifications_list: string[];
  tools_platforms: string[];
  experience: string;
  education: string;
  timezone_requirements: string;
  responsibilities: string;
  additional_requirements: string;

  // Step 3 — Compensation
  currency: string;
  budget_min: string;
  budget_max: string;
  compensation: string;

  // Step 4 — Search Criteria
  target_titles: string[];
  title_match_timing: "" | "current" | "previous" | "either";
  target_company_types: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  disqualifier_tags: string[];
  interview_process: string;
  additional_context: string;
  screening_questions: ScreeningInput[];
};

function fromJsonArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object" && "label" in (x as AnyRow)
          ? String((x as AnyRow).label ?? "")
          : "",
    )
    .filter(Boolean);
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export const getPositionForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.userId, data.id);
    const s = await getAdmin();
    const [posRes, screeningRes] = await Promise.all([
      s
        .from("positions")
        .select("*,organizations(id,name)")
        .eq("id", data.id)
        .maybeSingle(),
      s
        .from("screening_questions")
        .select("id,question,answer_type,required,dealbreaker,display_order")
        .eq("position_id", data.id)
        .order("display_order", { ascending: true }),
    ]);
    const p = posRes.data as AnyRow;
    if (!p) throw new Error("position_not_found");
    const comp = (p.compensation ?? {}) as AnyRow;
    const wa = (p.work_authorization ?? {}) as AnyRow;
    const ctx = (p.intake_context ?? {}) as AnyRow;

    const initial: PositionEditInitial = {
      id: p.id,
      organization_id: p.organization_id,
      organization_name: p.organizations?.name ?? "",
      status: p.status ?? "draft",

      title: p.title ?? "",
      department: p.department ?? "",
      location: p.location ?? "",
      work_model: (p.work_model ?? "") as PositionEditInitial["work_model"],
      employment_type: (p.employment_type ?? "") as PositionEditInitial["employment_type"],
      seniority: p.seniority ?? "",
      headcount: typeof p.openings === "number" ? p.openings : "",
      description: p.description ?? "",

      open_worldwide: Boolean(ctx.open_worldwide),
      target_countries: fromJsonArray(wa.countries),
      states_regions: asStrArr(ctx.states_regions),
      metro_areas: asStrArr(ctx.metro_areas),
      search_radius: asStr(ctx.search_radius),
      hiring_urgency: asStr(comp.urgency),
      target_start_date: asStr(ctx.target_start_date),
      time_to_hire: asStr(ctx.time_to_hire),

      must_have_skills: fromJsonArray(p.requirements),
      nice_to_have_skills: fromJsonArray(p.preferred_requirements),
      certifications_list: asStrArr(ctx.certifications_list),
      tools_platforms: asStrArr(ctx.tools_platforms),
      experience: asStr(ctx.experience),
      education: asStr(ctx.education),
      timezone_requirements: asStr(ctx.timezone_requirements),
      responsibilities: asStr(ctx.responsibilities),
      additional_requirements: asStr(ctx.additional_requirements),

      currency: asStr(comp.currency) || "USD",
      budget_min: asStr(comp.budget_min),
      budget_max: asStr(comp.budget_max),
      compensation: asStr(comp.summary) || asStr(comp.text) || asStr(comp.note),

      target_titles: fromJsonArray(wa.target_titles),
      title_match_timing: (asStr(ctx.title_match_timing) as PositionEditInitial["title_match_timing"]) || "",
      target_company_types: asStrArr(ctx.target_company_types),
      include_keywords: asStrArr(ctx.include_keywords),
      exclude_keywords: asStrArr(ctx.exclude_keywords),
      disqualifier_tags: fromJsonArray(p.dealbreakers),
      interview_process: asStr(ctx.interview_process),
      additional_context: asStr(ctx.additional_context),
      screening_questions: ((screeningRes.data ?? []) as AnyRow[]).map((r) => ({
        id: r.id,
        question: r.question,
        answer_type: r.answer_type,
        required: !!r.required,
        dealbreaker: !!r.dealbreaker,
      })),
    };

    return initial;
  });

const saveInput = z.object({
  id: z.string().uuid(),

  title: z.string().trim().min(3).max(200),
  department: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  work_model: z.enum(["remote", "hybrid", "onsite"]),
  employment_type: z
    .enum(["full_time", "part_time", "contract", "temporary", "internship", ""])
    .default(""),
  seniority: z.string().trim().max(60).default(""),
  headcount: z.number().int().min(1).max(999).nullable(),
  description: z.string().trim().max(20_000).default(""),

  open_worldwide: z.boolean().default(false),
  target_countries: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  states_regions: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  metro_areas: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  search_radius: z.string().trim().max(80).default(""),
  hiring_urgency: z.string().trim().max(80).default(""),
  target_start_date: z.string().trim().max(40).default(""),
  time_to_hire: z.string().trim().max(80).default(""),

  must_have_skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  nice_to_have_skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  certifications_list: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  tools_platforms: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  experience: z.string().trim().max(200).default(""),
  education: z.string().trim().max(400).default(""),
  timezone_requirements: z.string().trim().max(200).default(""),
  responsibilities: z.string().max(6000).default(""),
  additional_requirements: z.string().max(4000).default(""),

  currency: z.string().trim().max(8).default("USD"),
  budget_min: z.string().trim().max(20).default(""),
  budget_max: z.string().trim().max(20).default(""),
  compensation: z.string().trim().max(2000).default(""),

  target_titles: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  title_match_timing: z.enum(["current", "previous", "either", ""]).default(""),
  target_company_types: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  include_keywords: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  exclude_keywords: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  disqualifier_tags: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  interview_process: z.string().max(2000).default(""),
  additional_context: z.string().max(4000).default(""),
  screening_questions: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        question: z.string().trim().min(3).max(500),
        answer_type: z.enum(["text", "boolean", "number"]).default("text"),
        required: z.boolean().default(false),
        dealbreaker: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
});

export const savePositionEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    const before = await assertCanEdit(context.userId, data.id);
    const trace_id = traceId();
    const s = await getAdmin();

    if (data.must_have_skills.length < 3 && data.description.trim().length < 40) {
      throw new Error(
        "Provide at least 3 must-have skills or a job description of at least 40 characters",
      );
    }

    // Preserve unknown intake_context/compensation/work_authorization fields
    const { data: existing } = await s
      .from("positions")
      .select("intake_context,compensation,work_authorization")
      .eq("id", data.id)
      .maybeSingle();
    const priorCtx = (existing?.intake_context ?? {}) as AnyRow;
    const priorComp = (existing?.compensation ?? {}) as AnyRow;
    const priorWA = (existing?.work_authorization ?? {}) as AnyRow;

    const patch: AnyRow = {
      title: data.title,
      department: data.department || null,
      location: data.location || null,
      work_model: data.work_model,
      employment_type: data.employment_type || null,
      seniority: data.seniority || null,
      description: data.description || null,
      requirements: data.must_have_skills.map((label) => ({ label, kind: "must_have" })),
      preferred_requirements: data.nice_to_have_skills.map((label) => ({ label })),
      dealbreakers: data.disqualifier_tags.map((label) => ({ label })),
      compensation: {
        ...priorComp,
        summary: data.compensation || null,
        urgency: data.hiring_urgency || null,
        currency: data.currency || null,
        budget_min: data.budget_min || null,
        budget_max: data.budget_max || null,
      },
      work_authorization: {
        ...priorWA,
        countries: data.target_countries,
        target_titles: data.target_titles,
      },
      intake_context: {
        ...priorCtx,
        open_worldwide: data.open_worldwide,
        states_regions: data.states_regions,
        metro_areas: data.metro_areas,
        search_radius: data.search_radius || "",
        target_start_date: data.target_start_date || "",
        time_to_hire: data.time_to_hire || "",
        certifications_list: data.certifications_list,
        tools_platforms: data.tools_platforms,
        experience: data.experience || "",
        education: data.education || "",
        timezone_requirements: data.timezone_requirements || "",
        responsibilities: data.responsibilities || "",
        additional_requirements: data.additional_requirements || "",
        title_match_timing: data.title_match_timing || "",
        target_company_types: data.target_company_types,
        include_keywords: data.include_keywords,
        exclude_keywords: data.exclude_keywords,
        interview_process: data.interview_process || "",
        additional_context: data.additional_context || "",
      },
      openings: typeof data.headcount === "number" ? data.headcount : 1,
      updated_at: new Date().toISOString(),
    };

    const { data: after, error } = await s
      .from("positions")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Sync screening questions: delete removed, upsert kept/new, keep order
    const { data: existingSQ } = await s
      .from("screening_questions")
      .select("id")
      .eq("position_id", data.id);
    const existingIds = new Set(((existingSQ ?? []) as AnyRow[]).map((r) => r.id));
    const keepIds = new Set(
      data.screening_questions.map((q) => q.id).filter((v): v is string => !!v),
    );
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      const { error: dErr } = await s
        .from("screening_questions")
        .delete()
        .in("id", toDelete);
      if (dErr) throw new Error(dErr.message);
    }
    for (let i = 0; i < data.screening_questions.length; i++) {
      const q = data.screening_questions[i];
      const row = {
        position_id: data.id,
        question: q.question,
        answer_type: q.answer_type,
        required: q.required,
        dealbreaker: q.dealbreaker,
        display_order: i,
      };
      if (q.id && existingIds.has(q.id)) {
        const { error: uErr } = await s
          .from("screening_questions")
          .update(row)
          .eq("id", q.id);
        if (uErr) throw new Error(uErr.message);
      } else {
        const { error: iErr } = await s.from("screening_questions").insert(row);
        if (iErr) throw new Error(iErr.message);
      }
    }

    await writeAudit({
      actor: context.userId,
      action: "position.edit_wizard",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id,
    });

    return { ok: true as const, trace_id, position: after };
  });

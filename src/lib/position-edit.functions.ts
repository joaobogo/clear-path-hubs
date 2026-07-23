// Shared wizard-based position editor. Auth: platform staff OR client_editor
// on the position's organization. Mirrors the intake wizard shape so admins
// and clients edit positions with the same form they use to create them.
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
  title: string;
  department: string;
  location: string;
  work_model: "" | "remote" | "hybrid" | "onsite";
  employment_type: "" | "full_time" | "part_time" | "contract" | "temporary" | "internship";
  seniority: string;
  headcount: number | "";
  description: string;
  must_have_skills: string[];
  preferred_requirements: string;
  dealbreakers: string;
  compensation: string;
  hiring_urgency: string;
  target_countries: string[];
  work_authorization: string;
  target_titles: string[];
  screening_questions: ScreeningInput[];
  // Extended intake context (mirrors public intake questionnaire)
  responsibilities: string;
  experience: string;
  education: string;
  certifications: string;
  languages: string;
  industry_experience: string;
  hiring_timeline: string;
  timezone_requirements: string;
  reason_for_hiring: "" | "replacement" | "growth" | "backfill" | "new_team";
  hiring_challenges: string;
  interview_process: string;
  decision_makers: string;
  additional_context: string;
  status: string;
};


function fromJsonArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "label" in (x as AnyRow) ? String((x as AnyRow).label ?? "") : ""))
    .filter(Boolean);
}

function joinArrayText(v: unknown): string {
  if (!Array.isArray(v)) return typeof v === "string" ? v : "";
  return (v as unknown[])
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "label" in (x as AnyRow) ? String((x as AnyRow).label ?? "") : ""))
    .filter(Boolean)
    .join("\n");
}

function splitLines(v: string): string[] {
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
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
    const initial: PositionEditInitial = {
      id: p.id,
      organization_id: p.organization_id,
      organization_name: p.organizations?.name ?? "",
      title: p.title ?? "",
      department: p.department ?? "",
      location: p.location ?? "",
      work_model: (p.work_model ?? "") as PositionEditInitial["work_model"],
      employment_type: (p.employment_type ?? "") as PositionEditInitial["employment_type"],
      seniority: p.seniority ?? "",
      headcount: typeof p.openings === "number" ? p.openings : "",
      description: p.description ?? "",
      must_have_skills: fromJsonArray(p.requirements),
      preferred_requirements: joinArrayText(p.preferred_requirements),
      dealbreakers: joinArrayText(p.dealbreakers),
      compensation: comp.summary ?? comp.text ?? "",
      hiring_urgency: comp.urgency ?? "",
      target_countries: fromJsonArray(wa.countries),
      work_authorization: wa.summary ?? wa.text ?? "",
      target_titles: fromJsonArray(wa.target_titles),
      screening_questions: ((screeningRes.data ?? []) as AnyRow[]).map((r) => ({
        id: r.id,
        question: r.question,
        answer_type: r.answer_type,
        required: !!r.required,
        dealbreaker: !!r.dealbreaker,
      })),
      status: p.status ?? "draft",
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
  must_have_skills: z.array(z.string().trim().min(1).max(80)).max(30),
  preferred_requirements: z.string().max(8000).default(""),
  dealbreakers: z.string().max(4000).default(""),
  compensation: z.string().trim().max(240).default(""),
  hiring_urgency: z.string().trim().max(80).default(""),
  target_countries: z.array(z.string().trim().min(1).max(80)).max(30),
  work_authorization: z.string().trim().max(240).default(""),
  target_titles: z.array(z.string().trim().min(1).max(160)).max(30),
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
    .max(30),
});

export const savePositionEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    const before = await assertCanEdit(context.userId, data.id);
    const trace_id = traceId();
    const s = await getAdmin();

    // require enough content to save (approval gate mirrors intake refinement)
    if (data.must_have_skills.length < 3 && data.description.trim().length < 40) {
      throw new Error(
        "Provide at least 3 must-have skills or a job description of at least 40 characters",
      );
    }

    const patch: AnyRow = {
      title: data.title,
      department: data.department || null,
      location: data.location || null,
      work_model: data.work_model,
      employment_type: data.employment_type || null,
      seniority: data.seniority || null,
      description: data.description || null,
      requirements: data.must_have_skills.map((label) => ({ label, kind: "must_have" })),
      preferred_requirements: splitLines(data.preferred_requirements).map((label) => ({ label })),
      dealbreakers: splitLines(data.dealbreakers).map((label) => ({ label })),
      compensation: {
        summary: data.compensation || null,
        urgency: data.hiring_urgency || null,
      },
      work_authorization: {
        summary: data.work_authorization || null,
        countries: data.target_countries,
        target_titles: data.target_titles,
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
    const { data: existing } = await s
      .from("screening_questions")
      .select("id")
      .eq("position_id", data.id);
    const existingIds = new Set(((existing ?? []) as AnyRow[]).map((r) => r.id));
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

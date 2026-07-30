// Client + admin position lifecycle actions (publish, pause, resume, close,
// reopen, archive) and position duplication. Every transition is validated
// against the DB lifecycle guard, permission-checked (platform staff OR
// org editor) and written to audit_events with the actor's reason.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function assertCanManage(userId: string, positionId: string) {
  const s = await getAdmin();
  const { data: pos } = await s
    .from("positions")
    .select("*")
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { data: staff } = await s.rpc("is_platform_staff", { _user: userId });
  if (staff !== true) {
    const { data: editor } = await s.rpc("is_org_editor", {
      _user: userId,
      _org: pos.organization_id,
    });
    if (editor !== true) throw new Error("forbidden");
  }
  return pos as AnyRow;
}

const traceId = () =>
  `pl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export type LifecycleAction =
  | "submit"
  | "publish"
  | "pause"
  | "resume"
  | "close"
  | "reopen"
  | "archive";

/** action -> [allowed current statuses, target status, human label] */
const ACTIONS: Record<
  LifecycleAction,
  { from: string[]; to: string; label: string }
> = {
  submit: { from: ["draft", "needs_clarification"], to: "submitted", label: "Submitted for review" },
  publish: { from: ["approved"], to: "active", label: "Published" },
  pause: { from: ["active"], to: "paused", label: "Paused" },
  resume: { from: ["paused"], to: "active", label: "Resumed" },
  close: { from: ["active", "paused", "filled"], to: "closed", label: "Closed" },
  reopen: { from: ["closed"], to: "active", label: "Reopened" },
  archive: {
    from: ["draft", "submitted", "under_review", "needs_clarification", "approved", "active", "paused", "filled", "closed"],
    to: "archived",
    label: "Archived",
  },
};

/** Actions the current status allows — used to render only valid controls. */
export function availableLifecycleActions(status: string): LifecycleAction[] {
  return (Object.keys(ACTIONS) as LifecycleAction[]).filter((a) =>
    ACTIONS[a].from.includes(status),
  );
}

export const setPositionLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        action: z.enum([
          "submit",
          "publish",
          "pause",
          "resume",
          "close",
          "reopen",
          "archive",
        ]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const pos = await assertCanManage(context.userId, data.positionId);
    const rule = ACTIONS[data.action as LifecycleAction];
    if (!rule.from.includes(pos.status)) {
      throw new Error(`invalid_transition_from_${pos.status}`);
    }
    const s = await getAdmin();
    const patch: AnyRow = { status: rule.to };
    const now = new Date().toISOString();
    if (rule.to === "submitted") patch.submitted_at = now;
    if (rule.to === "active" && !pos.published_at) patch.published_at = now;
    if (rule.to === "closed") patch.closed_at = now;
    if (rule.to === "active") patch.visibility = pos.visibility ?? "public";

    const { data: updated, error } = await s
      .from("positions")
      .update(patch)
      .eq("id", data.positionId)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      action: `position.${data.action}`,
      entity_type: "position",
      entity_id: data.positionId,
      organization_id: pos.organization_id,
      before_state: { status: pos.status } as never,
      after_state: { status: rule.to, reason: data.reason ?? null } as never,
      trace_id: traceId(),
    });

    return { id: data.positionId, status: updated?.status ?? rule.to, label: rule.label };
  });

export const duplicatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        title: z.string().trim().min(2).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const pos = await assertCanManage(context.userId, data.positionId);
    const s = await getAdmin();

    // Copy only content fields — never identity, lifecycle, scoring, blueprint
    // or migration state. The copy always starts life as a fresh draft.
    const copy: AnyRow = {
      organization_id: pos.organization_id,
      title: data.title?.trim() || `${pos.title} (copy)`,
      department: pos.department,
      location: pos.location,
      work_model: pos.work_model,
      employment_type: pos.employment_type,
      seniority: pos.seniority,
      description: pos.description,
      requirements: pos.requirements ?? [],
      preferred_requirements: pos.preferred_requirements ?? [],
      dealbreakers: pos.dealbreakers ?? [],
      compensation: pos.compensation ?? {},
      work_authorization: pos.work_authorization ?? {},
      intake_context: pos.intake_context ?? {},
      evaluation_weights: pos.evaluation_weights ?? {},
      openings: pos.openings ?? 1,
      business_unit: pos.business_unit,
      region: pos.region,
      owner_user_id: pos.owner_user_id,
      travel_expectation: pos.travel_expectation,
      primary_timezone: pos.primary_timezone,
      timezone_overlap_hours: pos.timezone_overlap_hours,
      compensation_collected: pos.compensation_collected ?? false,
      compensation_visibility: pos.compensation_visibility ?? "internal",
      jd_source: pos.jd_source,
      jd_text: pos.jd_text,
      status: "draft",
      visibility: "private",
      created_by: context.userId,
      is_test_record: pos.is_test_record ?? false,
    };

    const { data: created, error } = await s
      .from("positions")
      .insert(copy)
      .select("id,title")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const newId = created!.id as string;

    const [{ data: questions }, { data: locations }] = await Promise.all([
      s
        .from("screening_questions")
        .select("question,answer_type,required,options,preferred_answer,dealbreaker,scoring_weight,display_order")
        .eq("position_id", data.positionId),
      s
        .from("position_locations")
        .select("country_code,country,region,city,work_model,is_primary,headcount,timezone,onsite_days_per_week,notes,display_order")
        .eq("position_id", data.positionId),
    ]);

    if (questions?.length) {
      await s
        .from("screening_questions")
        .insert(questions.map((q: AnyRow) => ({ ...q, position_id: newId })));
    }
    if (locations?.length) {
      await s.from("position_locations").insert(
        locations.map((l: AnyRow) => ({
          ...l,
          position_id: newId,
          organization_id: pos.organization_id,
        })),
      );
    }

    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "position.duplicated",
      entity_type: "position",
      entity_id: newId,
      organization_id: pos.organization_id,
      before_state: { source_position_id: data.positionId } as never,
      after_state: { id: newId, title: created!.title, status: "draft" } as never,
      trace_id: traceId(),
    });

    return { id: newId, title: created!.title as string };
  });

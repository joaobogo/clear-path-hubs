// Server-only implementation for position lifecycle transitions and
// duplication. Never imported by client code — only dynamically imported
// from inside server-function handlers.
import { LIFECYCLE_ACTIONS, type LifecycleAction } from "./position-lifecycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function assertCanManage(userId: string, positionId: string) {
  const s = await getAdmin();
  const { data: pos } = await s.from("positions").select("*").eq("id", positionId).maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { assertWorkspaceWrite } = await import("@/lib/authz/workspace-access");
  await assertWorkspaceWrite(s, userId, pos.organization_id as string);
  return pos as AnyRow;
}

const traceId = () => `pl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export async function runLifecycleTransition(input: {
  userId: string;
  positionId: string;
  action: LifecycleAction;
  reason?: string;
}) {
  const pos = await assertCanManage(input.userId, input.positionId);
  const rule = LIFECYCLE_ACTIONS[input.action];
  if (!rule.from.includes(pos.status)) {
    throw new Error(`invalid_transition_from_${pos.status}`);
  }
  const s = await getAdmin();
  const now = new Date().toISOString();
  const patch: AnyRow = { status: rule.to };
  if (rule.to === "submitted") patch.submitted_at = now;
  if (rule.to === "active") {
    if (!pos.published_at) patch.published_at = now;
    patch.visibility = pos.visibility === "private" ? "public" : pos.visibility;
  }
  if (rule.to === "closed") patch.closed_at = now;

  const { data: updated, error } = await s
    .from("positions")
    .update(patch)
    .eq("id", input.positionId)
    .select("id,status")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await s.from("audit_events").insert({
    actor_user_id: input.userId,
    action: `position.${input.action}`,
    entity_type: "position",
    entity_id: input.positionId,
    organization_id: pos.organization_id,
    before_state: { status: pos.status } as never,
    after_state: { status: rule.to, reason: input.reason ?? null } as never,
    trace_id: traceId(),
  });

  return { id: input.positionId, status: (updated?.status ?? rule.to) as string, label: rule.label };
}

export async function runDuplicatePosition(input: {
  userId: string;
  positionId: string;
  title?: string;
}) {
  const pos = await assertCanManage(input.userId, input.positionId);
  const s = await getAdmin();

  // Copy content only — never identity, lifecycle, scoring, blueprint or
  // migration state. The copy always starts life as a fresh private draft.
  const copy: AnyRow = {
    organization_id: pos.organization_id,
    title: input.title?.trim() || `${pos.title} (copy)`,
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
    created_by: input.userId,
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
      .select(
        "question,answer_type,required,options,preferred_answer,dealbreaker,scoring_weight,display_order",
      )
      .eq("position_id", input.positionId),
    s
      .from("position_locations")
      .select(
        "country_code,country,region,city,work_model,is_primary,headcount,timezone,onsite_days_per_week,notes,display_order",
      )
      .eq("position_id", input.positionId),
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
    actor_user_id: input.userId,
    action: "position.duplicated",
    entity_type: "position",
    entity_id: newId,
    organization_id: pos.organization_id,
    before_state: { source_position_id: input.positionId } as never,
    after_state: { id: newId, title: created!.title, status: "draft" } as never,
    trace_id: traceId(),
  });

  return { id: newId, title: created!.title as string };
}

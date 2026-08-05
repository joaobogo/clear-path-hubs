/**
 * Server-side loader and mutations for the candidate next-action bar.
 *
 * Reads only the records the derivation needs, plus the persisted "next step"
 * task used for reassignment and blocking notes. Reassignment and blocking
 * notes always write an audit event.
 */
import { deriveNextAction, type NextAction, type NextActionFacts } from "./candidate-next-action";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; rpc?: (n: string, a?: unknown) => any };

export const NEXT_STEP_TASK_TYPE_META_KEY = "next_step";

export type NextStepTask = {
  id: string;
  title: string;
  status: string;
  blocking: boolean;
  assignee_user_id: string | null;
  assignee_name: string | null;
  created_at: string;
};

export type NextActionPayload = {
  match_id: string;
  organization_id: string;
  position_id: string;
  candidate_profile_id: string;
  candidate_name: string | null;
  action: NextAction;
  facts: NextActionFacts;
  step_task: NextStepTask | null;
  generated_at: string;
};

async function personName(admin: Admin, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const res = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("auth_user_id", userId)
    .maybeSingle();
  const p = res.data as { full_name?: string | null; email?: string | null } | null;
  return p?.full_name?.trim() || p?.email?.trim() || "Unknown user";
}

export async function loadNextAction(
  admin: Admin,
  matchId: string,
): Promise<NextActionPayload | null> {
  const matchRes = await admin
    .from("candidate_matches")
    .select(
      "id, organization_id, position_id, candidate_profile_id, stage, processing_state, processing_updated_at, admin_status, client_visibility, integrity_status, current_score_run_id, approved_score_run_id, delivered_at, created_at, updated_at, candidate_profiles(full_name)",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (matchRes.error) throw new Error(matchRes.error.message);
  const m = matchRes.data as Record<string, unknown> | null;
  if (!m) return null;

  const [stageRes, decisionRes, interviewRes, scorecardRes, hireRes, taskRes] = await Promise.all([
    admin
      .from("candidate_stage_history")
      .select("to_stage, created_at")
      .eq("candidate_match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("client_decisions")
      .select("decision, created_at")
      .eq("candidate_match_id", matchId)
      .is("reversed_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("interviews")
      .select("id, status, scheduled_at, completed_at")
      .eq("candidate_match_id", matchId),
    admin.from("interview_scorecards").select("id").eq("candidate_match_id", matchId),
    admin
      .from("hire_records")
      .select("status, created_at")
      .eq("candidate_match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("tasks")
      .select("id, title, status, blocking, assignee_user_id, created_at, metadata")
      .eq("candidate_match_id", matchId)
      .is("deleted_at", null)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  for (const r of [stageRes, decisionRes, interviewRes, scorecardRes, hireRes, taskRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const interviews = (interviewRes.data ?? []) as Array<{
    status: string;
    scheduled_at: string | null;
    completed_at: string | null;
  }>;
  const now = Date.now();
  const upcoming = interviews.filter(
    (i) =>
      !i.completed_at &&
      i.status !== "cancelled" &&
      i.scheduled_at !== null &&
      new Date(i.scheduled_at).getTime() > now,
  ).length;
  const completedList = interviews
    .filter((i) => Boolean(i.completed_at))
    .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1));

  const stageRow = ((stageRes.data ?? []) as Array<{ created_at: string }>)[0] ?? null;
  const decisionRow =
    ((decisionRes.data ?? []) as Array<{ decision: string; created_at: string }>)[0] ?? null;
  const hireRow = ((hireRes.data ?? []) as Array<{ status: string; created_at: string }>)[0] ?? null;

  const facts: NextActionFacts = {
    stage: String(m.stage ?? "new"),
    processing_state: String(m.processing_state ?? "queued"),
    admin_status: String(m.admin_status ?? "pending"),
    client_visibility: String(m.client_visibility ?? "hidden"),
    integrity_status: (m.integrity_status as string | null) ?? null,
    has_score_run: Boolean(m.current_score_run_id || m.approved_score_run_id),
    delivered_at: (m.delivered_at as string | null) ?? null,
    processing_updated_at: (m.processing_updated_at as string | null) ?? null,
    stage_changed_at: stageRow?.created_at ?? null,
    created_at: (m.created_at as string | null) ?? null,
    last_decision: decisionRow
      ? { decision: decisionRow.decision, created_at: decisionRow.created_at }
      : null,
    interviews: {
      total: interviews.length,
      upcoming,
      completed: completedList.length,
      last_completed_at: completedList[0]?.completed_at ?? null,
    },
    scorecards: ((scorecardRes.data ?? []) as unknown[]).length,
    hire_record: hireRow ? { status: hireRow.status, created_at: hireRow.created_at } : null,
  };

  const tasks = (taskRes.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    blocking: boolean;
    assignee_user_id: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;
  const stepRow =
    tasks.find((t) => (t.metadata ?? {})[NEXT_STEP_TASK_TYPE_META_KEY] !== undefined) ??
    tasks.find((t) => t.blocking) ??
    null;

  const step_task: NextStepTask | null = stepRow
    ? {
        id: stepRow.id,
        title: stepRow.title,
        status: stepRow.status,
        blocking: stepRow.blocking,
        assignee_user_id: stepRow.assignee_user_id,
        assignee_name: await personName(admin, stepRow.assignee_user_id),
        created_at: stepRow.created_at,
      }
    : null;

  const profile = m.candidate_profiles as { full_name?: string | null } | null;

  return {
    match_id: String(m.id),
    organization_id: String(m.organization_id),
    position_id: String(m.position_id),
    candidate_profile_id: String(m.candidate_profile_id),
    candidate_name: profile?.full_name ?? null,
    action: deriveNextAction(facts),
    facts,
    step_task,
    generated_at: new Date().toISOString(),
  };
}

async function writeAudit(
  admin: Admin,
  opts: {
    actor: string;
    action: string;
    matchId: string;
    organizationId: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const ins = await admin.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "candidate_match",
    entity_id: opts.matchId,
    organization_id: opts.organizationId,
    before_state: opts.before ?? {},
    after_state: opts.after ?? {},
  });
  if (ins.error) throw new Error(ins.error.message);
}

/**
 * Creates or reassigns the task that represents the derived next step. The step
 * key is stored in metadata so the bar can recognise its own task later.
 */
export async function assignNextStep(
  admin: Admin,
  input: {
    matchId: string;
    assigneeUserId: string | null;
    actorUserId: string;
    step: string;
    taskType: string;
    title: string;
    note: string | null;
  },
): Promise<{ task_id: string; created: boolean }> {
  const payload = await loadNextAction(admin, input.matchId);
  if (!payload) throw new Error("match_not_found");

  if (payload.step_task) {
    const before = { assignee_user_id: payload.step_task.assignee_user_id };
    const upd = await admin
      .from("tasks")
      .update({
        assignee_user_id: input.assigneeUserId,
        status: "open",
        ...(input.note ? { description: input.note } : {}),
      })
      .eq("id", payload.step_task.id);
    if (upd.error) throw new Error(upd.error.message);
    await writeAudit(admin, {
      actor: input.actorUserId,
      action: "candidate_match.next_step_reassigned",
      matchId: input.matchId,
      organizationId: payload.organization_id,
      before,
      after: { assignee_user_id: input.assigneeUserId, step: input.step, note: input.note },
    });
    return { task_id: payload.step_task.id, created: false };
  }

  const ins = await admin
    .from("tasks")
    .insert({
      organization_id: payload.organization_id,
      position_id: payload.position_id,
      candidate_match_id: payload.match_id,
      candidate_profile_id: payload.candidate_profile_id,
      title: input.title,
      description: input.note,
      task_type: input.taskType,
      priority: "high",
      blocking: false,
      assignee_user_id: input.assigneeUserId ?? input.actorUserId,
      created_by: input.actorUserId,
      metadata: { [NEXT_STEP_TASK_TYPE_META_KEY]: input.step },
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(ins.error.message);

  await writeAudit(admin, {
    actor: input.actorUserId,
    action: "candidate_match.next_step_assigned",
    matchId: input.matchId,
    organizationId: payload.organization_id,
    after: {
      task_id: ins.data.id,
      step: input.step,
      assignee_user_id: input.assigneeUserId ?? input.actorUserId,
    },
  });

  return { task_id: ins.data.id as string, created: true };
}

/**
 * Records a blocking note against the candidate and marks the step blocked so
 * the bar stops presenting an action that cannot be completed.
 */
export async function addBlockingNote(
  admin: Admin,
  input: { matchId: string; body: string; actorUserId: string },
): Promise<{ ok: true; task_id: string }> {
  const payload = await loadNextAction(admin, input.matchId);
  if (!payload) throw new Error("match_not_found");

  const note = await admin
    .from("candidate_notes")
    .insert({
      candidate_match_id: input.matchId,
      organization_id: payload.organization_id,
      author_user_id: input.actorUserId,
      body: input.body,
      note_type: "risk",
      visibility: "internal",
    })
    .select("id")
    .maybeSingle();
  if (note.error) throw new Error(note.error.message);

  let taskId = payload.step_task?.id ?? null;
  if (taskId) {
    const upd = await admin
      .from("tasks")
      .update({ blocking: true, priority: "urgent" })
      .eq("id", taskId);
    if (upd.error) throw new Error(upd.error.message);
  } else {
    const ins = await admin
      .from("tasks")
      .insert({
        organization_id: payload.organization_id,
        position_id: payload.position_id,
        candidate_match_id: payload.match_id,
        candidate_profile_id: payload.candidate_profile_id,
        title: `Blocked: ${payload.action.step_label}`,
        description: input.body,
        task_type: "general_follow_up",
        priority: "urgent",
        blocking: true,
        assignee_user_id: input.actorUserId,
        created_by: input.actorUserId,
        metadata: { [NEXT_STEP_TASK_TYPE_META_KEY]: payload.action.step },
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    taskId = ins.data.id as string;
  }

  await writeAudit(admin, {
    actor: input.actorUserId,
    action: "candidate_match.next_step_blocked",
    matchId: input.matchId,
    organizationId: payload.organization_id,
    after: { step: payload.action.step, task_id: taskId, note: input.body.slice(0, 500) },
  });

  return { ok: true, task_id: taskId as string };
}

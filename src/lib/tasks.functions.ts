import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TASK_TYPES = [
  "role_brief_approval",
  "rubric_approval",
  "candidate_review",
  "interview_scheduling",
  "feedback_submission",
  "compensation_confirmation",
  "offer_decision",
  "document_request",
  "general_follow_up",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  role_brief_approval: "Role brief approval",
  rubric_approval: "Rubric approval",
  candidate_review: "Candidate review",
  interview_scheduling: "Interview scheduling",
  feedback_submission: "Feedback submission",
  compensation_confirmation: "Compensation confirmation",
  offer_decision: "Offer decision",
  document_request: "Document request",
  general_follow_up: "Follow-up",
};

const VIEW_KEYS = ["my", "team", "overdue", "blocking", "completed", "all"] as const;
export type TaskView = (typeof VIEW_KEYS)[number];

const listInput = z.object({
  organization_id: z.string().uuid(),
  view: z.enum(VIEW_KEYS).default("my"),
  task_type: z.enum(TASK_TYPES).optional(),
});

export type TaskRow = {
  id: string;
  organization_id: string;
  position_id: string | null;
  candidate_match_id: string | null;
  candidate_profile_id: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  task_type: TaskType;
  blocking: boolean;
  reminder_policy: "none" | "daily" | "weekly" | "before_due";
  completion_evidence: string | null;
  approved_version_hash: string | null;
  collaborators: string[];
  due_at: string | null;
  assignee_user_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  position_title?: string | null;
  candidate_name?: string | null;
};

const SELECT_COLUMNS =
  "id, organization_id, position_id, candidate_match_id, candidate_profile_id, title, description, status, priority, task_type, blocking, reminder_policy, completion_evidence, approved_version_hash, collaborators, due_at, assignee_user_id, created_by, completed_at, created_at, updated_at, positions(title), candidate_profiles(full_name)";

function shape(rows: unknown[]): TaskRow[] {
  return (rows ?? []).map((r) => {
    const rec = r as TaskRow & {
      positions?: { title: string } | null;
      candidate_profiles?: { full_name: string } | null;
    };
    return {
      ...rec,
      position_title: rec.positions?.title ?? null,
      candidate_name: rec.candidate_profiles?.full_name ?? null,
    };
  });
}

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listInput.parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("tasks")
      .select(SELECT_COLUMNS)
      .eq("organization_id", data.organization_id)
      .is("deleted_at", null)
      .limit(300);

    if (data.task_type) q = q.eq("task_type", data.task_type);

    const nowIso = new Date().toISOString();
    switch (data.view) {
      case "my":
        q = q.eq("assignee_user_id", context.userId).neq("status", "done").neq("status", "cancelled");
        break;
      case "team":
        q = q.neq("assignee_user_id", context.userId).neq("status", "done").neq("status", "cancelled");
        break;
      case "overdue":
        q = q.lt("due_at", nowIso).neq("status", "done").neq("status", "cancelled");
        break;
      case "blocking":
        q = q.eq("blocking", true).neq("status", "done").neq("status", "cancelled");
        break;
      case "completed":
        q = q.eq("status", "done");
        break;
    }

    q = q
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return shape((rows ?? []) as unknown[]);
  });

export const countBlockingTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ organization_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .eq("blocking", true)
      .is("deleted_at", null)
      .in("status", ["open", "in_progress"]);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

const createInput = z.object({
  organization_id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional(),
  task_type: z.enum(TASK_TYPES).default("general_follow_up"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  blocking: z.boolean().default(false),
  reminder_policy: z.enum(["none", "daily", "weekly", "before_due"]).default("none"),
  due_at: z.string().datetime().optional(),
  position_id: z.string().uuid().optional(),
  candidate_match_id: z.string().uuid().optional(),
  candidate_profile_id: z.string().uuid().optional(),
  assignee_user_id: z.string().uuid().optional(),
  collaborators: z.array(z.string().uuid()).default([]),
  idempotency_key: z.string().min(4).max(120).optional(),
  approved_version_hash: z.string().max(200).optional(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => createInput.parse(v))
  .handler(async ({ data, context }) => {
    const metadata = data.idempotency_key ? { idempotency_key: data.idempotency_key } : {};

    // Idempotent retry: return existing row if key already used
    if (data.idempotency_key) {
      const { data: existing } = await context.supabase
        .from("tasks")
        .select("id")
        .eq("organization_id", data.organization_id)
        .eq("metadata->>idempotency_key", data.idempotency_key)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) return { id: existing.id as string, idempotent: true };
    }

    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        organization_id: data.organization_id,
        title: data.title,
        description: data.description ?? null,
        task_type: data.task_type,
        priority: data.priority,
        blocking: data.blocking,
        reminder_policy: data.reminder_policy,
        due_at: data.due_at ?? null,
        position_id: data.position_id ?? null,
        candidate_match_id: data.candidate_match_id ?? null,
        candidate_profile_id: data.candidate_profile_id ?? null,
        assignee_user_id: data.assignee_user_id ?? context.userId,
        collaborators: data.collaborators,
        approved_version_hash: data.approved_version_hash ?? null,
        created_by: context.userId,
        metadata,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, idempotent: false };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  task_type: z.enum(TASK_TYPES).optional(),
  blocking: z.boolean().optional(),
  reminder_policy: z.enum(["none", "daily", "weekly", "before_due"]).optional(),
  due_at: z.string().datetime().nullable().optional(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  completion_evidence: z.string().trim().max(4000).nullable().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
});

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => updateInput.parse(v))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "done" || data.status === "cancelled") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = context.userId;
      } else {
        patch.completed_at = null;
        patch.completed_by = null;
      }
    }
    for (const k of [
      "priority",
      "task_type",
      "blocking",
      "reminder_policy",
      "due_at",
      "title",
      "description",
      "completion_evidence",
      "assignee_user_id",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    const { error } = await context.supabase.from("tasks").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const bulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  assignee_user_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
});

export const bulkUpdateTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => bulkInput.parse(v))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.assignee_user_id !== undefined) patch.assignee_user_id = data.assignee_user_id;
    if (data.due_at !== undefined) patch.due_at = data.due_at;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "done" || data.status === "cancelled") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = context.userId;
      }
    }
    if (Object.keys(patch).length === 0) return { updated: 0 };
    const { data: rows, error } = await context.supabase
      .from("tasks")
      .update(patch as never)
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    return { updated: rows?.length ?? 0 };
  });

const deleteInput = z.object({ id: z.string().uuid() });
export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => deleteInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

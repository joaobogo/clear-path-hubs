import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({
  organization_id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled", "all"]).default("open"),
  assignee: z.enum(["me", "any"]).default("any"),
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
  due_at: string | null;
  assignee_user_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  position_title?: string | null;
  candidate_name?: string | null;
};

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listInput.parse(v))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("tasks")
      .select(
        "id, organization_id, position_id, candidate_match_id, candidate_profile_id, title, description, status, priority, due_at, assignee_user_id, created_by, completed_at, created_at, updated_at, positions(title), candidate_profiles(full_name)",
      )
      .eq("organization_id", data.organization_id)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.assignee === "me") query = query.eq("assignee_user_id", context.userId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const rec = r as unknown as TaskRow & {
        positions?: { title: string } | null;
        candidate_profiles?: { full_name: string } | null;
      };
      return {
        ...rec,
        position_title: rec.positions?.title ?? null,
        candidate_name: rec.candidate_profiles?.full_name ?? null,
      } satisfies TaskRow;
    });
  });

const createInput = z.object({
  organization_id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  due_at: z.string().datetime().optional(),
  position_id: z.string().uuid().optional(),
  candidate_match_id: z.string().uuid().optional(),
  candidate_profile_id: z.string().uuid().optional(),
  assignee_user_id: z.string().uuid().optional(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => createInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        organization_id: data.organization_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        due_at: data.due_at ?? null,
        position_id: data.position_id ?? null,
        candidate_match_id: data.candidate_match_id ?? null,
        candidate_profile_id: data.candidate_profile_id ?? null,
        assignee_user_id: data.assignee_user_id ?? context.userId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  due_at: z.string().datetime().nullable().optional(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
});

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => updateInput.parse(v))
  .handler(async ({ data, context }) => {
    const patch: {
      status?: "open" | "in_progress" | "done" | "cancelled";
      priority?: "low" | "normal" | "high" | "urgent";
      due_at?: string | null;
      title?: string;
      description?: string | null;
      completed_at?: string | null;
      completed_by?: string | null;
    } = {};
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
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.due_at !== undefined) patch.due_at = data.due_at;
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;

    const { error } = await context.supabase.from("tasks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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

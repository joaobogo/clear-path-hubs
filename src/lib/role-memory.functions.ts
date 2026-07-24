// Recruiter Memory & Handoff — shared, structured position notes.
// Persists brief, rationale, handoff, candidate reasoning, decision, risk.
// If a recruiter changes, the role does not reset to zero.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const ROLE_MEMORY_KINDS = [
  "brief",
  "rationale",
  "handoff",
  "candidate_reasoning",
  "decision",
  "risk",
  "next_step",
] as const;
export type RoleMemoryKind = (typeof ROLE_MEMORY_KINDS)[number];

export type RoleMemoryDTO = {
  id: string;
  position_id: string;
  organization_id: string;
  candidate_profile_id: string | null;
  kind: RoleMemoryKind;
  title: string;
  body: string;
  pinned: boolean;
  author_user_id: string;
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
};

async function loadPosition(supabase: Any, positionId: string): Promise<{ id: string; organization_id: string }> {
  const { data, error } = await supabase
    .from("positions")
    .select("id, organization_id")
    .eq("id", positionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Position not found");
  return data as Any;
}

async function displayName(supabase: Any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  const d = data as Any;
  if (d?.display_name) return String(d.display_name);
  if (d?.email) return String(d.email).split("@")[0];
  return "Team member";
}

export const listRoleMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ position_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Any;
    const { data: rows, error } = await supabase
      .from("role_memory")
      .select(
        "id, position_id, organization_id, candidate_profile_id, kind, title, body, pinned, author_user_id, author_display_name, created_at, updated_at",
      )
      .eq("position_id", data.position_id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as RoleMemoryDTO[];
  });

export const createRoleMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        position_id: z.string().uuid(),
        kind: z.enum(ROLE_MEMORY_KINDS),
        title: z.string().trim().min(2).max(200),
        body: z.string().trim().min(2).max(6000),
        candidate_profile_id: z.string().uuid().nullable().optional(),
        pinned: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Any;
    const pos = await loadPosition(supabase, data.position_id);
    const author = await displayName(supabase, context.userId);
    const { data: row, error } = await supabase
      .from("role_memory")
      .insert({
        position_id: pos.id,
        organization_id: pos.organization_id,
        candidate_profile_id: data.candidate_profile_id ?? null,
        kind: data.kind,
        title: data.title,
        body: data.body,
        pinned: data.pinned ?? false,
        author_user_id: context.userId,
        author_display_name: author,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as RoleMemoryDTO;
  });

export const updateRoleMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(2).max(200).optional(),
        body: z.string().trim().min(2).max(6000).optional(),
        kind: z.enum(ROLE_MEMORY_KINDS).optional(),
        pinned: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Any;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.body !== undefined) patch.body = data.body;
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    const { data: row, error } = await supabase
      .from("role_memory")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as RoleMemoryDTO;
  });

export const deleteRoleMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Any;
    const { error } = await supabase.from("role_memory").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

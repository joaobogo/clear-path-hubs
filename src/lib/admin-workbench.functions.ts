// Thin server-function wrappers: bulk actions, SLA clock, operational health,
// internal notes and notification resolution.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BULK_STAGES } from "./admin-bulk-constants";

// Bulk actions chunk every read and write, so the cap is a sanity bound on the
// request body rather than a limit on how much work the pipeline can do.
const idList = z.array(z.string().uuid()).min(1).max(2000);

async function staffAdmin(context: { userId: string; supabase: any }) {
  const { requireStaff } = await import("./admin-ops.server");
  await requireStaff(context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const planBulkStageMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ matchIds: idList, toStage: z.enum(BULK_STAGES) }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { planStageMove } = await import("./admin-bulk.server");
    return planStageMove(admin, data.matchIds, data.toStage);
  });

export const runBulkStageMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ matchIds: idList, toStage: z.enum(BULK_STAGES) }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { applyStageMove } = await import("./admin-bulk.server");
    return applyStageMove(admin, data.matchIds, data.toStage, context.userId);
  });

export const planBulkAssign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ candidateProfileIds: idList, positionId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { planAssign } = await import("./admin-bulk.server");
    return planAssign(admin, data.candidateProfileIds, data.positionId);
  });

export const runBulkAssign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ candidateProfileIds: idList, positionId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { applyAssign } = await import("./admin-bulk.server");
    return applyAssign(admin, data.candidateProfileIds, data.positionId, context.userId);
  });

export const runBulkUpdateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ matchIds: idList, message: z.string().trim().min(5).max(2000) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { applyBulkUpdateMessage } = await import("./admin-bulk.server");
    return applyBulkUpdateMessage(admin, data.matchIds, data.message, context.userId);
  });

export const getSlaClock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { loadSlaClock } = await import("./admin-health.server");
    return loadSlaClock(admin, { includeTest: data.include_test });
  });

export const getOperationalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { loadOperationalHealth } = await import("./admin-health.server");
    return loadOperationalHealth(admin, { includeTest: data.include_test });
  });


export const retryOperationalIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ kind: z.enum(["webhook", "processing", "email", "cv"]), id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context as never);
    const { retryHealthIssue } = await import("./admin-health.server");
    return retryHealthIssue(admin, data.kind, data.id, context.userId);
  });

// ---------- Internal notes / handoff trail ----------

const entityType = z.enum(["position", "candidate_match", "organization"]);

export const listInternalNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ entityType, entityId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { data: rows, error } = await context.supabase
      .from("internal_notes")
      .select("id, body, kind, pinned, author_user_id, created_at, updated_at")
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const authorIds = [...new Set((rows ?? []).map((r: any) => r.author_user_id).filter(Boolean))];
    let names: Record<string, string> = {};
    if (authorIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", authorIds as string[]);
      names = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, (p.full_name as string) || (p.email as string) || "Staff"]),
      );
    }
    return {
      notes: (rows ?? []).map((r: any) => ({
        ...r,
        author_name: names[r.author_user_id as string] ?? "Staff",
        is_mine: r.author_user_id === context.userId,
      })),
    };
  });

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        entityType,
        entityId: z.string().uuid(),
        organizationId: z.string().uuid().nullable().optional(),
        body: z.string().trim().min(2).max(4000),
        kind: z.enum(["note", "handoff", "risk", "decision"]).default("note"),
        pinned: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { error } = await context.supabase.from("internal_notes").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      organization_id: data.organizationId ?? null,
      body: data.body,
      kind: data.kind,
      pinned: data.pinned,
      author_user_id: context.userId,
    } as never);
    if (error) throw error;
    return { ok: true };
  });

export const deleteInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("internal_notes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const resolveNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ids: idList }).parse(raw))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("notifications")
      .update({ resolved_at: now, read_at: now } as never)
      .eq("recipient_user_id", context.userId)
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Support console ----------

export const getSupportOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await staffAdmin(context as never);
    const [orgsRes, sessionsRes, actionsRes] = await Promise.all([
      admin.from("organizations").select("id, name, status").order("name").limit(300),
      admin
        .from("support_sessions")
        .select("id, organization_id, actor_user_id, actor_role, mode, reason, started_at, ended_at, end_reason")
        .order("started_at", { ascending: false })
        .limit(30),
      admin
        .from("support_actions")
        .select("id, session_id, action, target_type, target_id, organization_id, reason, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);
    const orgNames = Object.fromEntries((orgsRes.data ?? []).map((o: any) => [o.id, o.name]));
    return {
      organizations: orgsRes.data ?? [],
      sessions: (sessionsRes.data ?? []).map((s: any) => ({ ...s, org_name: orgNames[s.organization_id] ?? "—" })),
      actions: (actionsRes.data ?? []).map((a: any) => ({ ...a, org_name: orgNames[a.organization_id] ?? "—" })),
    };
  });

// Thin server-function wrappers for the admin "needs attention" position queue.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AttentionQueue } from "./admin-attention.server";

export const getPositionsNeedingAttention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<AttentionQueue> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAttentionQueue } = await import("./admin-attention.server");
    return loadAttentionQueue(supabaseAdmin as never, { includeTest: data.include_test });
  });

export const listPositionOwnerOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listOwnerOptions } = await import("./admin-attention.server");
    return listOwnerOptions(supabaseAdmin as never);
  });

export const markPositionReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { REVIEW_ACTION } = await import("./admin-attention.server");
    const admin = supabaseAdmin as never as { from: (t: string) => any };

    const pos = await admin
      .from("positions")
      .select("id, organization_id")
      .eq("id", data.position_id)
      .maybeSingle();
    if (pos.error) throw new Error(pos.error.message);
    if (!pos.data) throw new Error("Position not found");

    const { error } = await admin.from("audit_events").insert({
      entity_type: "position",
      entity_id: data.position_id,
      organization_id: pos.data.organization_id,
      action: REVIEW_ACTION,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actor_user_id: context.userId,
      after_state: { reviewed_at: new Date().toISOString() },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reassignPositionOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid(),
        owner_user_id: z.string().uuid().nullable(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { OWNER_ACTION } = await import("./admin-attention.server");
    const admin = supabaseAdmin as never as { from: (t: string) => any };

    const pos = await admin
      .from("positions")
      .select("id, organization_id, owner_user_id")
      .eq("id", data.position_id)
      .maybeSingle();
    if (pos.error) throw new Error(pos.error.message);
    if (!pos.data) throw new Error("Position not found");

    const upd = await admin
      .from("positions")
      .update({ owner_user_id: data.owner_user_id })
      .eq("id", data.position_id);
    if (upd.error) throw new Error(upd.error.message);

    const { error } = await admin.from("audit_events").insert({
      entity_type: "position",
      entity_id: data.position_id,
      organization_id: pos.data.organization_id,
      action: OWNER_ACTION,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actor_user_id: context.userId,
      before_state: { owner_user_id: pos.data.owner_user_id ?? null },
      after_state: { owner_user_id: data.owner_user_id, reason: data.reason ?? null },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ intakeId: z.string().uuid() });
const positionActionSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const listIntakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("client_intakes")
      .select("id, submitter_email, status, org_id, position_id, trace_id, created_at, error")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getIntakeDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: intake }, { data: org }, { data: position }, { data: questions }] =
      await Promise.all([
        supabaseAdmin.from("client_intakes").select("*").eq("id", data.intakeId).maybeSingle(),
        supabaseAdmin
          .from("client_intakes")
          .select("org_id")
          .eq("id", data.intakeId)
          .maybeSingle()
          .then(async ({ data: i }) =>
            i?.org_id
              ? await supabaseAdmin
                  .from("organizations")
                  .select("*")
                  .eq("id", i.org_id)
                  .maybeSingle()
              : { data: null },
          ),
        supabaseAdmin
          .from("client_intakes")
          .select("position_id")
          .eq("id", data.intakeId)
          .maybeSingle()
          .then(async ({ data: i }) =>
            i?.position_id
              ? await supabaseAdmin
                  .from("positions")
                  .select("*")
                  .eq("id", i.position_id)
                  .maybeSingle()
              : { data: null },
          ),
        supabaseAdmin
          .from("client_intakes")
          .select("position_id")
          .eq("id", data.intakeId)
          .maybeSingle()
          .then(async ({ data: i }) =>
            i?.position_id
              ? await supabaseAdmin
                  .from("screening_questions")
                  .select("*")
                  .eq("position_id", i.position_id)
                  .order("ordering")
              : { data: [] },
          ),
      ]);
    return { intake, org, position, questions: questions ?? [] };
  });

export const requestClarification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => positionActionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("positions")
      .update({ status: "needs_clarification" })
      .eq("id", data.positionId);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "position.needs_clarification",
      entity_type: "positions",
      entity_id: data.positionId,
      diff: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const approvePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => positionActionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("positions")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        visibility: data.visibility ?? "private",
      })
      .eq("id", data.positionId);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "position.approved",
      entity_type: "positions",
      entity_id: data.positionId,
    });
    return { ok: true };
  });

export const activatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => positionActionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("positions")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        visibility: data.visibility ?? "private",
      })
      .eq("id", data.positionId);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "position.activated",
      entity_type: "positions",
      entity_id: data.positionId,
    });
    return { ok: true };
  });

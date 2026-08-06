// Thin server-function wrappers for the client decision backlog.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { DecisionBacklog } from "./admin-decision-backlog.server";

const decisionValues = [
  "shortlist",
  "request_interview",
  "request_information",
  "hold",
  "not_moving_forward",
  "offer",
  "hire",
] as const;

export const getDecisionBacklog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid().optional(),
        include_test: z.boolean().optional().default(false),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<DecisionBacklog> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDecisionBacklog } = await import("./admin-decision-backlog.server");
    return loadDecisionBacklog(supabaseAdmin as never, {
      ...(data.organization_id ? { organizationId: data.organization_id } : {}),
      includeTest: data.include_test,
    });
  });

export const nudgeClientDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendDecisionNudge } = await import("./admin-decision-backlog.server");
    return sendDecisionNudge(supabaseAdmin as never, {
      matchId: data.match_id,
      note: data.note ?? null,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
    });
  });

export const logOfflineClientDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        decision: z.enum(decisionValues),
        note: z.string().trim().min(3).max(1000),
        received_from: z.string().trim().min(2).max(160),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordOfflineDecision } = await import("./admin-decision-backlog.server");
    return recordOfflineDecision(supabaseAdmin as never, {
      matchId: data.match_id,
      decision: data.decision,
      note: data.note,
      receivedFrom: data.received_from,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
    });
  });

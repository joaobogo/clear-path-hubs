// Thin server-function wrappers for offer & hire confirmation tracking.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { OfferHireRollup, PositionOfferTracking } from "./offer-hire";

const OUTCOMES = [
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "offer_declined",
  "hire_confirmed",
  "closed_lost",
] as const;

const REASONS = [
  "candidate_declined",
  "counter_offer",
  "other_offer_accepted",
  "compensation_mismatch",
  "role_paused",
  "budget",
  "timing",
  "culture_fit",
  "background_check",
  "position_cancelled",
  "other",
] as const;

export const getPositionOfferTracking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PositionOfferTracking> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPositionOfferTracking } = await import("./offer-hire.server");
    return loadPositionOfferTracking(supabaseAdmin as never, data.position_id);
  });

export const getOfferHireRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<OfferHireRollup> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOfferHireRollup } = await import("./offer-hire.server");
    return loadOfferHireRollup(supabaseAdmin as never, { includeTest: data.include_test });
  });

export const recordOfferOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        hire_id: z.string().uuid(),
        outcome: z.enum(OUTCOMES),
        close_reason: z.enum(REASONS).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordOfferOutcome } = await import("./offer-hire.server");
    return recordOfferOutcome(supabaseAdmin as never, {
      hireId: data.hire_id,
      actorUserId: context.userId,
      outcome: data.outcome,
      ...(data.close_reason ? { closeReason: data.close_reason } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    });
  });

export const setHireStartDateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        hire_id: z.string().uuid(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date"),
        guarantee_days: z.number().int().min(0).max(365).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setHireStartDate } = await import("./offer-hire.server");
    return setHireStartDate(supabaseAdmin as never, {
      hireId: data.hire_id,
      actorUserId: context.userId,
      startDate: data.start_date,
      ...(data.guarantee_days !== undefined ? { guaranteeDays: data.guarantee_days } : {}),
    });
  });

export const closePositionWithOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid(),
        outcome: z.enum(["filled", "closed"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { closePositionWithOutcome } = await import("./offer-hire.server");
    return closePositionWithOutcome(supabaseAdmin as never, {
      positionId: data.position_id,
      actorUserId: context.userId,
      outcome: data.outcome,
      reason: data.reason,
    });
  });

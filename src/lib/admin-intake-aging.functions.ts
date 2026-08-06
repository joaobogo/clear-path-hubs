// Thin server-function wrappers for the intake aging and conversion tracker.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { INTAKE_AGING_FILTERS } from "./intake-aging";
import type { IntakeAgingTable } from "./admin-intake-aging.server";

export const getIntakeAging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        include_test: z.boolean().optional().default(false),
        filter: z.enum(INTAKE_AGING_FILTERS).optional().default("all"),
        include_closed: z.boolean().optional().default(false),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<IntakeAgingTable> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadIntakeAging } = await import("./admin-intake-aging.server");
    return loadIntakeAging(supabaseAdmin as never, {
      includeTest: data.include_test,
      filter: data.filter,
      includeClosed: data.include_closed,
    });
  });

export const assignIntakeOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        intake_id: z.string().uuid(),
        owner_user_id: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assignIntakeOwnerRow } = await import("./admin-intake-aging.server");
    return assignIntakeOwnerRow(supabaseAdmin as never, {
      intakeId: data.intake_id,
      ownerUserId: data.owner_user_id,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
    });
  });

export const setIntakeProceeding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        intake_id: z.string().uuid(),
        proceeding: z.boolean(),
        reason: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.proceeding || (v.reason ?? "").trim().length >= 10, {
        message: "Give a reason of at least 10 characters",
        path: ["reason"],
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setIntakeProceedingRow } = await import("./admin-intake-aging.server");
    return setIntakeProceedingRow(supabaseAdmin as never, {
      intakeId: data.intake_id,
      proceeding: data.proceeding,
      reason: data.reason,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
    });
  });

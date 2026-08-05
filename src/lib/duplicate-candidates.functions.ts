// Thin server-function wrappers for duplicate candidate detection.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { DuplicateReview } from "./duplicate-candidates";

export const getDuplicateReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DuplicateReview> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDuplicateReview } = await import("./duplicate-candidates.server");
    return loadDuplicateReview(supabaseAdmin as never);
  });

export const mergeDuplicatePersonsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        keep_person_id: z.string().uuid(),
        merge_person_id: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mergePersons } = await import("./duplicate-candidates.server");
    return mergePersons(supabaseAdmin as never, {
      keepPersonId: data.keep_person_id,
      mergePersonId: data.merge_person_id,
      note: data.note?.length ? data.note : null,
      actorUserId: context.userId,
    });
  });

export const markPersonsDistinctFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        person_a_id: z.string().uuid(),
        person_b_id: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { markPersonsDistinct } = await import("./duplicate-candidates.server");
    return markPersonsDistinct(supabaseAdmin as never, {
      personAId: data.person_a_id,
      personBId: data.person_b_id,
      note: data.note?.length ? data.note : null,
      actorUserId: context.userId,
    });
  });

export const revertDuplicateDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ decision_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePlatformAdmin, revertDuplicateDecision } = await import(
      "./duplicate-candidates.server"
    );
    await requirePlatformAdmin(supabaseAdmin as never, context.userId);
    return revertDuplicateDecision(supabaseAdmin as never, {
      decisionId: data.decision_id,
      actorUserId: context.userId,
    });
  });

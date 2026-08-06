/**
 * Staff-only server functions for per-role criteria authoring.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const criterion = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
  label: z.string().trim().min(2).max(120),
  evidence: z.string().trim().max(400),
  weight: z.number().min(0).max(1000),
  must_have: z.boolean(),
});

export const getPositionCriteria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listRubricVersions } = await import("./criteria-authoring.server");
    return listRubricVersions(supabaseAdmin as never, data.position_id);
  });

export const saveCriteriaDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid(),
        version_id: z.string().uuid().nullish(),
        label: z.string().trim().min(2).max(120),
        criteria: z.array(criterion).min(1).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { saveRubricDraft } = await import("./criteria-authoring.server");
    return saveRubricDraft(supabaseAdmin as never, {
      positionId: data.position_id,
      versionId: data.version_id ?? null,
      label: data.label,
      criteria: data.criteria,
      actorUserId: context.userId,
    });
  });

export const publishCriteriaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ version_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishRubricVersion } = await import("./criteria-authoring.server");
    return publishRubricVersion(supabaseAdmin as never, {
      versionId: data.version_id,
      actorUserId: context.userId,
    });
  });

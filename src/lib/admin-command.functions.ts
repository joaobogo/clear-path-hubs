// Admin command centre server functions — thin wrappers only.
// All aggregation logic lives in ./admin-command.server.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const filterSchema = z.object({
  org_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  status: z.string().max(40).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
});

export const getCommandCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filterSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const {
      loadFilterOptions,
      loadUrgentQueue,
      loadWorkload,
      hasAnyWork,
      requireStaffUser,
    } = await import("./admin-command.server");
    await requireStaffUser((context as { userId: string }).userId);

    const [options, urgent, workload, anyWork] = await Promise.all([
      loadFilterOptions(),
      loadUrgentQueue(data),
      loadWorkload(data),
      hasAnyWork(),
    ]);

    const counts: Record<string, number> = {};
    for (const item of urgent) counts[item.kind] = (counts[item.kind] ?? 0) + 1;

    return {
      options,
      urgent,
      urgent_counts: counts,
      workload,
      platform_has_work: anyWork,
      filters_active: Object.values(data).some(Boolean),
      generated_at: new Date().toISOString(),
    };
  });

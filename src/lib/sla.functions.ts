/**
 * Reporting against our own SLA: what we promised at role launch, what we
 * actually did, and the gap. Read-only for clients; commitments themselves are
 * written by TaaSFlow staff (RLS enforces this).
 *
 * Measurement lives in `@/lib/sla-report-load.server` — the Account plan table
 * reads the very same numbers through it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadSlaPerformance } from "@/lib/sla-report-load.server";

export const getSlaPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId?: string }) =>
    z
      .object({ orgId: z.string().uuid(), positionId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(({ context, data }) =>
    loadSlaPerformance(context.supabase, data.orgId, data.positionId),
  );

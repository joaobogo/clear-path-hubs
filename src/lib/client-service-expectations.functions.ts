import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildServiceExpectationsFor } from "@/lib/client-service-expectations.server";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";
import type { ServiceExpectations } from "@/lib/client-service-expectations";

/** Service commitments for the signed-in client account. RLS scopes the reads. */
export const getServiceExpectations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<ServiceExpectations> => {
    // Plan commitments are billing information: Admins only, enforced through
    // the same area map the UI reads.
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "billing");

    return buildServiceExpectationsFor(context.supabase, data.orgId);
  });

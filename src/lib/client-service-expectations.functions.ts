import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildServiceExpectationsFor } from "@/lib/client-service-expectations.server";
import type { ServiceExpectations } from "@/lib/client-service-expectations";

/** Service commitments for the signed-in client account. RLS scopes the reads. */
export const getServiceExpectations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<ServiceExpectations> => {
    const { data: member } = await context.supabase.rpc("is_org_member", {
      _user: context.userId,
      _org: data.orgId,
    });
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (member !== true && staff !== true) throw new Error("forbidden");

    return buildServiceExpectationsFor(context.supabase, data.orgId);
  });

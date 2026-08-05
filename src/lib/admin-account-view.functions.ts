/**
 * Server functions for the account-level operating view. Staff-only, read-only.
 * One function per block so a failure is contained to that block.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  AccountCommercial,
  AccountDelivery,
  AccountEngagement,
} from "./admin-account-view";

const input = (i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i);

export const getAccountCommercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }): Promise<AccountCommercial> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountCommercial } = await import("./admin-account-view.server");
    return loadAccountCommercial(supabaseAdmin as never, data.organization_id);
  });

export const getAccountDelivery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }): Promise<AccountDelivery> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountDelivery } = await import("./admin-account-view.server");
    return loadAccountDelivery(supabaseAdmin as never, data.organization_id);
  });

export const getAccountEngagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }): Promise<AccountEngagement> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountEngagement } = await import("./admin-account-view.server");
    return loadAccountEngagement(supabaseAdmin as never, data.organization_id);
  });

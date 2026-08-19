import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { loadClientOpenItems } from "@/lib/client/open-items.server";

export const getClientOpenItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    return loadClientOpenItems(context.supabase, context.userId, data.orgId);
  });

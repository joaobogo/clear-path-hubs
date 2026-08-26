/**
 * Account state (plan / seats / onboarding) over RPC.
 *
 * Thin wrapper: every runtime helper lives in `account-state.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountState } from "@/lib/account-state";

export const getAccountState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<AccountState> => {
    const { assertWorkspaceAccess } = await import("@/lib/authz/workspace-access");
    await assertWorkspaceAccess(context.supabase, context.userId, data.organization_id);
    const { readAccountState } = await import("@/lib/account-state.server");
    return readAccountState(context.supabase, data.organization_id);
  });

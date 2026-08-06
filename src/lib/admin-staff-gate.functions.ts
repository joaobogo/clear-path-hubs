/**
 * Canonical staff gate for the admin surface.
 *
 * The route layout previously decided staff access from the client-visible
 * membership list, which could disagree with the server's `is_platform_staff`
 * check used by every admin server function. One source of truth removes that
 * seam: the layout asks the same question the server answers.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStaffAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ staff: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("is_platform_staff", { _user: context.userId });
    return { staff: data === true };
  });

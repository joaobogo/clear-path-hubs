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
  .handler(async ({ context }): Promise<{ staff: boolean; platformAdmin: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [staff, admin] = await Promise.all([
      supabaseAdmin.rpc("is_platform_staff", { _user: context.userId }),
      supabaseAdmin.rpc("is_platform_admin", { _user: context.userId }),
    ]);
    // The nav is derived from the same two predicates the server enforces, so a
    // visible entry can never lead to a page whose data calls all fail.
    return { staff: staff.data === true, platformAdmin: admin.data === true };
  });

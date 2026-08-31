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
  .handler(
    async ({
      context,
    }): Promise<{ staff: boolean; platformAdmin: boolean; displayName: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [staff, admin, profile] = await Promise.all([
        supabaseAdmin.rpc("is_platform_staff", { _user: context.userId }),
        supabaseAdmin.rpc("is_platform_admin", { _user: context.userId }),
        // The account record. The admin shell was naming the person from
        // auth user_metadata, which is self-set at sign-up and drifts: one
        // session rendered "Joao Luciano" in the admin sidebar, "John
        // Kasprzak" in the client shell and on /me, and /admin/team listed
        // exactly one staff record — John Kasprzak (audit #8, TF8-14).
        // profiles is what /admin/team lists, so profiles is the name.
        supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("auth_user_id", context.userId)
          .maybeSingle(),
      ]);
      const row = (profile.data ?? null) as { full_name?: string | null; email?: string | null } | null;
      // The nav is derived from the same two predicates the server enforces, so
      // a visible entry can never lead to a page whose data calls all fail.
      return {
        staff: staff.data === true,
        platformAdmin: admin.data === true,
        displayName: row?.full_name?.trim() || row?.email?.trim() || null,
      };
    },
  );

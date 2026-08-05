import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCarryForward, type CarryForward } from "@/lib/intake-carry";

/**
 * Company profile defaults for a signed-in client starting another role from
 * their workspace. Reads as the user, so RLS decides which company they may
 * carry forward from, and includes their own contact details (which the public
 * lookup never returns).
 */
export const getCompanyCarryForward = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CarryForward> => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id) {
      return { companyName: null, values: {}, carried: [] };
    }

    const [{ data: org }, { data: position }, { data: profile }] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, website, phone")
        .eq("id", membership.organization_id)
        .maybeSingle(),
      supabase
        .from("positions")
        .select("location, work_model, work_authorization, compensation, intake_context, created_at")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("auth_user_id", userId)
        .maybeSingle(),
    ]);

    return buildCarryForward({
      organization: org ?? null,
      position: position ?? null,
      contact: profile
        ? { fullName: profile.full_name, email: profile.email, phone: profile.phone }
        : null,
    });
  });

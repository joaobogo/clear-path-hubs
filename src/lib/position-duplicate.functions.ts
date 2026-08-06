import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCarryForward, type CarryForward } from "@/lib/intake-carry";
import { buildDuplicateDraft, type DuplicateDraft } from "@/lib/position-duplicate";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

/**
 * A pre-filled brief for "Duplicate this role".
 *
 * Reads as the signed-in user, so RLS is what decides which role may be
 * duplicated — another organisation's role simply is not visible. Nothing is
 * written: the original role is untouched by this call, and the duplicate only
 * becomes a role when the client submits the brief.
 */
export const getPositionDuplicateDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { positionId: string }) => {
    const positionId = String(input?.positionId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(positionId)) throw new Error("A valid role id is required");
    return { positionId };
  })
  .handler(async ({ data, context }): Promise<{ draft: DuplicateDraft | null; carry: CarryForward }> => {
    const supabase = context.supabase;

    const { data: position, error } = await supabase
      .from("positions")
      .select(
        "id, organization_id, title, location, work_model, description, requirements, preferred_requirements, dealbreakers, compensation, work_authorization, intake_context, created_at, updated_at",
      )
      .eq("id", data.positionId)
      .maybeSingle();

    if (error) throw new Error("We could not read that role just now");
    if (!position) return { draft: null, carry: { companyName: null, values: {}, carried: [] } };
    await assertWorkspaceAccess(supabase, context.userId, position.organization_id as string);

    const [{ data: org }, { data: profile }] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, website, phone")
        .eq("id", position.organization_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("auth_user_id", context.userId)
        .maybeSingle(),
    ]);

    // Company and contact come from the profile, exactly as they do for any
    // second role; the brief itself comes from the role being duplicated.
    const carry = buildCarryForward({
      organization: org ?? null,
      position: null,
      contact: profile
        ? { fullName: profile.full_name, email: profile.email, phone: profile.phone }
        : null,
    });

    return { draft: buildDuplicateDraft(position), carry };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roleGaps, type RoleGap } from "@/lib/position-readiness";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type IncompleteRole = {
  positionId: string;
  title: string;
  status: string;
  gaps: RoleGap[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * Roles that cannot be approved yet because the brief is missing details.
 * RLS scopes this to the caller's workspaces; the org filter narrows further.
 */
export const listRolesNeedingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId?: string }) => data)
  .handler(async ({ data, context }): Promise<{ roles: IncompleteRole[] }> => {
    const { supabase } = context;

    // An org id must resolve to a workspace the caller can see; omitting it
    // is only meaningful for platform staff browsing across workspaces, and
    // that is exactly what assertWorkspaceAccess-via-RLS still enforces below.
    if (data.orgId && isUuid(data.orgId)) {
      await assertWorkspaceAccess(supabase, context.userId, data.orgId);
    }

    let query = supabase
      .from("positions")
      .select(
        "id, title, status, description, location, work_model, employment_type, seniority, requirements, compensation, intake_context",
      )
      .order("created_at", { ascending: false })
      .limit(25);
    if (data.orgId && isUuid(data.orgId)) query = query.eq("organization_id", data.orgId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const closed = new Set(["closed", "cancelled", "filled", "archived"]);
    const roles: IncompleteRole[] = [];
    for (const raw of (rows ?? []) as AnyRow[]) {
      const status = String(raw.status ?? "");
      if (closed.has(status)) continue;
      const comp = (raw.compensation ?? {}) as AnyRow;
      const ctx = (raw.intake_context ?? {}) as AnyRow;
      const gaps = roleGaps({
        title: raw.title,
        description: raw.description,
        location: raw.location,
        work_model: raw.work_model,
        employment_type: raw.employment_type,
        seniority: raw.seniority,
        must_have_skills: Array.isArray(raw.requirements) ? raw.requirements : [],
        experience: typeof ctx.experience === "string" ? ctx.experience : "",
        responsibilities: typeof ctx.responsibilities === "string" ? ctx.responsibilities : "",
        budget_min: comp.budget_min ?? null,
        budget_max: comp.budget_max ?? null,
        currency: comp.currency ?? null,
      });
      if (gaps.length === 0) continue;
      roles.push({
        positionId: raw.id as string,
        title: (raw.title as string) || "Untitled role",
        status,
        gaps,
      });
    }
    return { roles };
  });

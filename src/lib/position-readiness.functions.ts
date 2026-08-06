import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roleGaps, type RoleGap } from "@/lib/position-readiness";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type IncompleteRole = {
  positionId: string;
  title: string;
  status: string;
  gaps: RoleGap[];
};

/**
 * Roles that cannot be approved yet because the brief is missing details.
 * RLS scopes this to the caller's workspaces; the org filter narrows further.
 */
export const listRolesNeedingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId?: string }) => data)
  .handler(async ({ data, context }): Promise<{ roles: IncompleteRole[] }> => {
    const { supabase } = context;

    let query = supabase
      .from("positions")
      .select(
        "id, title, status, description, location, work_model, employment_type, seniority, must_have_skills, experience, responsibilities, budget_min, budget_max, currency",
      )
      .not("status", "in", "(closed,cancelled,filled,archived)")
      .order("created_at", { ascending: false })
      .limit(25);
    if (data.orgId && isUuid(data.orgId)) query = query.eq("organization_id", data.orgId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const roles: IncompleteRole[] = [];
    for (const row of rows ?? []) {
      const gaps = roleGaps(row);
      if (gaps.length === 0) continue;
      roles.push({
        positionId: row.id as string,
        title: (row.title as string) || "Untitled role",
        status: String(row.status ?? ""),
        gaps,
      });
    }
    return { roles };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Who is doing what on the hiring team — facts only, pulled from records.
 * No scoring, ranking, or judgement of people: counts and dates the team can
 * verify themselves.
 */

export type TeamMemberActivity = {
  user_id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  /** Decisions this person recorded in the last 30 days. */
  decisions_30d: number;
  /** Interviews this person booked that are still upcoming. */
  interviews_upcoming: number;
  /** Last sign-in, when the account has ever signed in. */
  last_sign_in_at: string | null;
  /** True when a role launched after this person last signed in. */
  not_seen_since_launch: boolean;
};

export type TeamActivity = {
  /** Decisions sitting with the team as a whole — nobody is assigned one. */
  open_decisions: number;
  /** Earliest launch date among live roles, used for the sign-in fact. */
  earliest_role_launch: string | null;
  members: TeamMemberActivity[];
};

type AnyRow = Record<string, unknown> & { [k: string]: never | unknown };

export const getClientTeamActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<TeamActivity> => {
    const { data: canRead } = await context.supabase.rpc("is_org_editor", {
      _user: context.userId,
      _org: data.orgId,
    });
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (canRead !== true && staff !== true) throw new Error("forbidden");

    const nowIso = new Date().toISOString();
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [membersRes, decisionsRes, interviewsRes, positionsRes, openRes] = await Promise.all([
      context.supabase
        .from("memberships")
        .select("user_id, role, status, profiles:user_id(full_name, email)")
        .eq("organization_id", data.orgId)
        .neq("status", "removed"),
      context.supabase
        .from("client_decisions")
        .select("actor_user_id")
        .eq("organization_id", data.orgId)
        .is("reversed_at", null)
        .gte("created_at", since30),
      context.supabase
        .from("interviews")
        .select("created_by, requested_by_user_id, scheduled_at, status")
        .eq("organization_id", data.orgId)
        .gte("scheduled_at", nowIso),
      context.supabase
        .from("positions")
        .select("created_at, status")
        .eq("organization_id", data.orgId)
        .in("status", ["active", "approved"])
        .order("created_at", { ascending: true })
        .limit(1),
      context.supabase
        .from("candidate_matches")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.orgId)
        .eq("stage", "delivered"),
    ]);

    const decisionCounts = new Map<string, number>();
    for (const row of (decisionsRes.data ?? []) as AnyRow[]) {
      const actor = (row.actor_user_id as string | null) ?? null;
      if (!actor) continue;
      decisionCounts.set(actor, (decisionCounts.get(actor) ?? 0) + 1);
    }

    const interviewCounts = new Map<string, number>();
    for (const row of (interviewsRes.data ?? []) as AnyRow[]) {
      if (row.status === "cancelled") continue;
      const booker =
        ((row.requested_by_user_id as string | null) ?? (row.created_by as string | null)) ?? null;
      if (!booker) continue;
      interviewCounts.set(booker, (interviewCounts.get(booker) ?? 0) + 1);
    }

    const earliestLaunch =
      (((positionsRes.data ?? [])[0] as AnyRow | undefined)?.created_at as string | undefined) ??
      null;

    const rows = ((membersRes.data ?? []) as AnyRow[]).slice(0, 50);

    // Last sign-in is only available through the auth admin API.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signIns = new Map<string, string | null>();
    await Promise.all(
      rows.map(async (m) => {
        const uid = m.user_id as string;
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          signIns.set(uid, (u?.user?.last_sign_in_at as string | null) ?? null);
        } catch {
          signIns.set(uid, null);
        }
      }),
    );

    const members: TeamMemberActivity[] = rows.map((m) => {
      const uid = m.user_id as string;
      const profile = (m.profiles ?? null) as { full_name?: string | null; email?: string | null } | null;
      const lastSignIn = signIns.get(uid) ?? null;
      const notSeen =
        !!earliestLaunch &&
        (!lastSignIn || new Date(lastSignIn).getTime() < new Date(earliestLaunch).getTime());
      return {
        user_id: uid,
        name: profile?.full_name ?? profile?.email ?? "Team member",
        email: profile?.email ?? null,
        role: (m.role as string) ?? "client_viewer",
        status: (m.status as string) ?? "active",
        decisions_30d: decisionCounts.get(uid) ?? 0,
        interviews_upcoming: interviewCounts.get(uid) ?? 0,
        last_sign_in_at: lastSignIn,
        not_seen_since_launch: notSeen,
      };
    });

    return {
      open_decisions: openRes.count ?? 0,
      earliest_role_launch: earliestLaunch,
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

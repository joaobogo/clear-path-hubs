// Client access + permission inspector (staff-only).
//
// Permissions are NOT recomputed in TypeScript here: every value is read back
// from the exact database functions the RLS policies call
// (`default_permissions_for_role`, `has_client_permission`), so what an admin
// sees on this tab cannot drift from what the policies enforce.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlatformStaff } from "@/lib/authz.server";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";

const uuid = z.string().uuid();

export type AccessMember = {
  membership_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  last_sign_in_at: string | null;
  /** Permissions stored on the seat row. */
  granted: ClientPermission[];
  /** What `default_permissions_for_role(role)` returns in the database. */
  role_defaults: ClientPermission[];
  /** Live `has_client_permission(user, org, perm)` result per permission. */
  effective: Record<ClientPermission, boolean>;
};

export type AccessInspection = {
  organization_id: string;
  seat_limit: number;
  seats_used: number;
  seats_remaining: number;
  members: AccessMember[];
  pending: AccessMember[];
};

const CLIENT_ROLE_LIST = ["client_admin", "client_editor", "client_viewer"] as const;

/**
 * Resolves the real access picture for one client organization: seats, roles,
 * permissions as the policies compute them, pending invitations, last sign-in.
 */
export const inspectClientAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: uuid }).parse(i))
  .handler(async ({ data, context }): Promise<AccessInspection> => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: org }, { data: rows, error }] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("client_seat_limit")
        .eq("id", data.organization_id)
        .maybeSingle(),
      supabaseAdmin
        .from("memberships")
        .select("id, user_id, role, status, created_at, permissions")
        .eq("organization_id", data.organization_id)
        .in("role", [...CLIENT_ROLE_LIST])
        .neq("status", "removed")
        .order("created_at", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      user_id: string;
      role: string;
      status: string;
      created_at: string;
      permissions: ClientPermission[] | null;
    };
    const seats = ((rows ?? []) as Row[]);

    // Profile identity for the seat holders.
    const userIds = seats.map((s) => s.user_id);
    const profileByUser = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", userIds);
      for (const p of (profiles ?? []) as Array<{
        auth_user_id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        profileByUser.set(p.auth_user_id, { full_name: p.full_name, email: p.email });
      }
    }

    // Role defaults straight from the database function (cached per role).
    const defaultsByRole = new Map<string, ClientPermission[]>();
    await Promise.all(
      Array.from(new Set(seats.map((s) => s.role))).map(async (role) => {
        const { data: defs } = await context.supabase.rpc("default_permissions_for_role", {
          _role: role as never,
        });
        defaultsByRole.set(role, (defs ?? []) as ClientPermission[]);
      }),
    );

    const members: AccessMember[] = await Promise.all(
      seats.map(async (s) => {
        // Live policy evaluation, one call per permission per seat.
        const results = await Promise.all(
          CLIENT_PERMISSIONS.map(async (perm) => {
            const { data: allowed } = await context.supabase.rpc("has_client_permission", {
              _user: s.user_id,
              _org: data.organization_id,
              _perm: perm as never,
            });
            return [perm, allowed === true] as const;
          }),
        );
        const effective = Object.fromEntries(results) as Record<ClientPermission, boolean>;

        let lastSignIn: string | null = null;
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(s.user_id);
          lastSignIn = authUser?.user?.last_sign_in_at ?? null;
        } catch {
          lastSignIn = null;
        }

        const profile = profileByUser.get(s.user_id) ?? { full_name: null, email: null };
        return {
          membership_id: s.id,
          user_id: s.user_id,
          full_name: profile.full_name,
          email: profile.email,
          role: s.role,
          status: s.status,
          created_at: s.created_at,
          last_sign_in_at: lastSignIn,
          granted: (s.permissions ?? []) as ClientPermission[],
          role_defaults: defaultsByRole.get(s.role) ?? [],
          effective,
        };
      }),
    );

    const seatLimit =
      (org as { client_seat_limit?: number | null } | null)?.client_seat_limit ?? 3;
    // Owner seat plus recruiter seats; invited seats are already reserved.
    const seatsUsed = seats.filter((s) => s.status === "active" || s.status === "invited").length;

    return {
      organization_id: data.organization_id,
      seat_limit: seatLimit,
      seats_used: seatsUsed,
      seats_remaining: Math.max(0, seatLimit + 1 - seatsUsed),
      members: members.filter((m) => m.status !== "invited"),
      pending: members.filter((m) => m.status === "invited"),
    };
  });

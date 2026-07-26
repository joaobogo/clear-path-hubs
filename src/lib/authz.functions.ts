// Canonical authorization server functions:
//  • candidate contact release / revocation (separate from client-view approval)
//  • client seat permission administration (staff-controlled)
//
// Approval of a candidate for a client+job lives in `setMatchClientVisibility`
// (admin.functions.ts). Contact release is deliberately a *second*, separate
// permission and is administered here.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  assertPlatformStaff,
  assertOrgMember,
  assertMatchVisible,
  logAuthzChange,
} from "@/lib/authz.server";
import {
  CLIENT_PERMISSIONS,
  CLIENT_ROLES,
  MAX_CLIENT_SEAT_LIMIT,
  type ClientPermission,
} from "@/lib/authz";

const uuid = z.string().uuid();

// ─── Contact release ────────────────────────────────────────────────────────

const releaseInput = z.object({
  match_id: uuid,
  reason: z.string().trim().min(3).max(500),
});

/**
 * Releases a candidate's direct contact details to the client for one specific
 * candidate + job. Requires that the candidate is already approved for client
 * view — contact release never implies or grants visibility.
 */
export const releaseCandidateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => releaseInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: before, error: readErr } = await supabaseAdmin
      .from("candidate_matches")
      .select("id, organization_id, client_visibility, contact_released_at")
      .eq("id", data.match_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error("match_not_found");
    if (before.client_visibility !== "visible") {
      throw new Error(
        "Approve this candidate for the client first — contact release requires an approved candidate.",
      );
    }
    if (before.contact_released_at) return { ok: true, already: true };

    const { error } = await supabaseAdmin
      .from("candidate_matches")
      .update({
        contact_released_at: new Date().toISOString(),
        contact_released_by: context.userId,
        contact_release_reason: data.reason,
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);

    await logAuthzChange({
      actorUserId: context.userId,
      organizationId: before.organization_id,
      entityType: "candidate_match",
      entityId: data.match_id,
      action: "match.contact.released",
      before: { contact_released_at: null },
      after: { contact_released_at: new Date().toISOString() },
      reason: data.reason,
    });
    return { ok: true, already: false };
  });

/** Immediately withdraws released contact details. */
export const revokeCandidateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ match_id: uuid, reason: z.string().trim().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("candidate_matches")
      .select("id, organization_id, contact_released_at")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!before) throw new Error("match_not_found");

    const { error } = await supabaseAdmin
      .from("candidate_matches")
      .update({
        contact_released_at: null,
        contact_released_by: null,
        contact_release_reason: null,
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);

    await logAuthzChange({
      actorUserId: context.userId,
      organizationId: before.organization_id,
      entityType: "candidate_match",
      entityId: data.match_id,
      action: "match.contact.revoked",
      before: { contact_released_at: before.contact_released_at },
      after: { contact_released_at: null },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/**
 * Read-only visibility probe used by client-side UI to decide whether to render
 * a contact block or the masked placeholder. Returns `hidden` rather than
 * throwing for unapproved candidates so callers can render an empty state.
 */
export const getMatchAccessState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: visible } = await context.supabase.rpc("is_match_client_visible", {
      _user: context.userId,
      _match: data.match_id,
    });
    const { data: released } = await context.supabase.rpc("is_match_contact_released", {
      _user: context.userId,
      _match: data.match_id,
    });
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    return {
      visible: visible === true || staff === true,
      contact_released: released === true || staff === true,
      is_staff: staff === true,
    };
  });

// ─── Seat administration ────────────────────────────────────────────────────

const permissionZ = z.enum(CLIENT_PERMISSIONS as unknown as [ClientPermission, ...ClientPermission[]]);
const clientRoleZ = z.enum(CLIENT_ROLES as unknown as [string, ...string[]]);

/**
 * Staff-only: set the exact permission set of a client seat. Client members can
 * never call this — the membership guard trigger also rejects it in-database,
 * and a member may never target their own row.
 */
export const setSeatPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        membership_id: uuid,
        permissions: z.array(permissionZ).max(CLIENT_PERMISSIONS.length),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("memberships")
      .select("id, user_id, organization_id, role, permissions")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (!before) throw new Error("membership_not_found");
    if (before.user_id === context.userId) {
      throw new Error("You cannot change your own permissions.");
    }
    const unique = Array.from(new Set(data.permissions));
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ permissions: unique as never })
      .eq("id", data.membership_id);
    if (error) throw new Error(error.message);

    await logAuthzChange({
      actorUserId: context.userId,
      organizationId: before.organization_id,
      entityType: "membership",
      entityId: data.membership_id,
      action: "membership.permissions.updated",
      before: { permissions: before.permissions },
      after: { permissions: unique },
    });
    return { ok: true, permissions: unique };
  });

/** Staff-only: activate, suspend or remove a client seat. */
export const setSeatStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        membership_id: uuid,
        status: z.enum(["active", "suspended", "removed", "invited"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("memberships")
      .select("id, user_id, organization_id, role, status")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (!before) throw new Error("membership_not_found");
    if (before.user_id === context.userId) {
      throw new Error("You cannot change your own membership status.");
    }
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ status: data.status })
      .eq("id", data.membership_id);
    if (error) throw new Error(error.message);

    await logAuthzChange({
      actorUserId: context.userId,
      organizationId: before.organization_id,
      entityType: "membership",
      entityId: data.membership_id,
      action: `membership.status.${data.status}`,
      before: { status: before.status },
      after: { status: data.status },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/** Staff-only: adjust how many recruiter seats an organization may hold. */
export const setOrgSeatLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: uuid,
        seat_limit: z.number().int().min(0).max(MAX_CLIENT_SEAT_LIMIT),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("organizations")
      .select("id, client_seat_limit")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!before) throw new Error("organization_not_found");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ client_seat_limit: data.seat_limit })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    await logAuthzChange({
      actorUserId: context.userId,
      organizationId: data.organization_id,
      entityType: "organization",
      entityId: data.organization_id,
      action: "organization.seat_limit.updated",
      before: { client_seat_limit: before.client_seat_limit },
      after: { client_seat_limit: data.seat_limit },
    });
    return { ok: true };
  });

/**
 * Seat usage for an organization — owner seat plus recruiter seats, and how
 * many invitations remain. Readable by any member of the organization.
 */
export const getSeatUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOrgMember(context.supabase, context.userId, data.organization_id);
    const { data: org } = await context.supabase
      .from("organizations")
      .select("client_seat_limit")
      .eq("id", data.organization_id)
      .maybeSingle();
    const { data: rows } = await context.supabase
      .from("memberships")
      .select("id, role, status")
      .eq("organization_id", data.organization_id)
      .in("role", ["client_admin", "client_editor", "client_viewer"])
      .in("status", ["active", "invited"]);
    const seats = (rows ?? []) as { role: string }[];
    const owners = seats.filter((s) => s.role === "client_admin").length;
    const recruiters = seats.length - owners;
    const limit = (org as { client_seat_limit?: number } | null)?.client_seat_limit ?? 3;
    return {
      seat_limit: limit,
      owner_seats: owners,
      recruiter_seats: recruiters,
      seats_remaining: Math.max(0, limit + 1 - seats.length),
    };
  });

export { clientRoleZ };

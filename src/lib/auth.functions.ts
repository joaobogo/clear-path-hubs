import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SessionContext, SessionMembership, MembershipRole } from "./roles";

// ─────────────────────────────────────────────────────────────
// Session context: memberships, role, org identity for the caller.
// Public (no auth) → returns null so the login page can call it safely.
// ─────────────────────────────────────────────────────────────
export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionContext> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, status, auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    // memberships.user_id references auth.users.id — pass the auth uid, not profile.id.
    const { data: mems } = await supabase
      .from("memberships")
      .select("id, organization_id, role, status, organizations(name)")
      .eq("user_id", userId);
    const memberships: SessionMembership[] = (mems ?? []).map((m) => ({
      membership_id: m.id as string,
      organization_id: (m.organization_id as string | null) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      organization_name: ((m as any).organizations?.name as string | null) ?? null,
      role: m.role as MembershipRole,
      status: m.status as SessionMembership["status"],
    }));
    // Deactivated profile → force no memberships.
    if (profile?.status && profile.status !== "active") {
      return {
        user_id: userId,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        memberships: [],
        primary_role: null,
      };
    }
    const active = memberships.filter((m) => m.status === "active");
    const priority: MembershipRole[] = [
      "platform_admin",
      "operations",
      "client_admin",
      "client_editor",
      "client_viewer",
      "candidate",
    ];
    let primary: MembershipRole | null = null;
    for (const r of priority) {
      if (active.some((m) => m.role === r)) {
        primary = r;
        break;
      }
    }
    // Candidates are not tracked via memberships (no organization scope).
    // If the caller has an active profile and a candidate_profile row,
    // classify them as a candidate so login routes to /me.
    if (!primary) {
      const { data: candProfile } = await supabase
        .from("candidate_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (candProfile) primary = "candidate";
    }
    // Applied before creating an account, so the candidate profile exists but
    // is not linked yet. /me claims it by email on first load, so classify the
    // caller as a candidate now instead of dead-ending on /access-denied.
    if (!primary && profile?.email) {
      const { data: claimable } = await supabase
        .from("candidate_profiles")
        .select("id")
        .ilike("email", profile.email)
        .is("user_id", null)
        .maybeSingle();
      if (claimable) primary = "candidate";
    }
    // No membership at all — never a revoked client seat, so the candidate
    // area is the honest destination. It explains the state and offers jobs.
    if (!primary && memberships.length === 0) primary = "candidate";
    return {
      user_id: userId,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      memberships,
      primary_role: primary,
    };
  });

// ─────────────────────────────────────────────────────────────
// Admin creates a user (platform, operations, or client-scoped).
// Requires platform_admin membership. Skips email verification.
// Returns the temp password ONCE — never persisted, never re-shown.
// ─────────────────────────────────────────────────────────────
const createUserInput = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  full_name: z.string().min(1).max(120),
  role: z.enum([
    "platform_admin",
    "operations",
    "client_admin",
    "client_editor",
    "client_viewer",
  ]),
  organization_id: z.string().uuid().optional().nullable(),
  temporary_password: z.string().min(10).max(128).optional().nullable(),
});

function generatePassword(len = 16): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertPlatformAdmin(supabase: any, userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (profile && profile.status !== "active") throw new Error("Forbidden");
  // memberships.user_id = auth.users.id — query by the auth uid, not profile.id.
  const { data: rows } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "platform_admin");
  if (!rows || rows.length === 0) throw new Error("Forbidden: platform_admin required");
}

export const createUserByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createUserInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);

    if (
      (data.role === "client_admin" ||
        data.role === "client_editor" ||
        data.role === "client_viewer") &&
      !data.organization_id
    ) {
      throw new Error("organization_id is required for client-scoped roles");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = data.temporary_password?.trim() || generatePassword(16);

    // Find or create auth user. email_confirm=true bypasses email verification.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let authUserId: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr) {
      // Likely already exists — look them up.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: list } = await (supabaseAdmin as any).auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = list?.users?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u: any) => (u.email ?? "").toLowerCase() === data.email,
      );
      if (!found) throw new Error(createErr.message);
      authUserId = found.id;
    } else {
      authUserId = created?.user?.id ?? null;
    }
    if (!authUserId) throw new Error("Unable to resolve auth user");

    // Upsert public profile keyed by auth_user_id.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    let profileId = existingProfile?.id as string | undefined;
    if (!profileId) {
      const { data: ins, error } = await supabaseAdmin
        .from("profiles")
        .insert({
          auth_user_id: authUserId,
          email: data.email,
          full_name: data.full_name,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      profileId = ins.id as string;
    }

    // Insert membership (idempotent per unique(user_id, organization_id, role)).
    // memberships.user_id references auth.users.id, NOT profiles.id.
    const membershipRow: {
      user_id: string;
      role: string;
      status: string;
      organization_id: string | null;
    } = {
      user_id: authUserId,
      role: data.role,
      status: "active",
      organization_id: data.organization_id ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memErr } = await (supabaseAdmin as any)
      .from("memberships")
      .upsert(membershipRow, { onConflict: "user_id,organization_id,role", ignoreDuplicates: false });
    if (memErr && !/duplicate|conflict/i.test(memErr.message)) throw memErr;

    // Audit
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      organization_id: data.organization_id ?? null,
      entity_type: "profiles",
      entity_id: profileId,
      action: "admin.create_user",
      after_state: { email: data.email, role: data.role },
    });

    return {
      user_id: profileId,
      auth_user_id: authUserId,
      email: data.email,
      role: data.role,
      organization_id: data.organization_id ?? null,
      temporary_password: tempPassword,
      // Returned once. Client copies then discards.
    };
  });

// ─────────────────────────────────────────────────────────────
// Admin creates a whole client workspace in one action.
// ─────────────────────────────────────────────────────────────
const createClientInput = z.object({
  company_name: z.string().min(2).max(200),
  primary_contact_name: z.string().min(1).max(120),
  primary_contact_email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  website: z.string().url().optional().or(z.literal("")).transform((s) => s || null),
  industry: z.string().max(120).optional().nullable(),
  headquarters: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const createClientWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createClientInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalized = data.company_name.trim().toLowerCase().replace(/\s+/g, " ");
    // Find-or-create organization. name_normalized is a generated column — do not set it.
    const { data: existingOrg } = await supabaseAdmin
      .from("organizations")
      .select("id, name, status")
      .eq("name_normalized", normalized)
      .maybeSingle();
    let orgId = existingOrg?.id as string | undefined;
    // The contact details typed here are what staff expect to see on the client
    // record and in the clients list afterwards, so they are stored on the
    // organization too — not only on the primary user's profile.
    const contactPatch = {
      primary_contact_name: data.primary_contact_name.trim(),
      primary_contact_email: data.primary_contact_email,
      phone: data.phone?.trim() || null,
      internal_notes: data.notes?.trim() || null,
    };
    if (!orgId) {
      const { data: newOrg, error } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: data.company_name.trim(),
          website: data.website ?? null,
          industry: data.industry ?? null,
          headquarters: data.headquarters ?? null,
          status: "active",
          ...contactPatch,
        })
        .select("id")
        .single();
      if (error) throw error;
      orgId = newOrg.id as string;
    } else {
      // Existing organization: fill blanks only, never overwrite curated data.
      const { data: current } = await supabaseAdmin
        .from("organizations")
        .select("primary_contact_name,primary_contact_email,phone,website,industry,headquarters")
        .eq("id", orgId)
        .maybeSingle();
      const fill: Record<string, string | null> = {};
      if (!current?.primary_contact_name) fill['primary_contact_name'] = contactPatch.primary_contact_name;
      if (!current?.primary_contact_email) fill['primary_contact_email'] = contactPatch.primary_contact_email;
      if (!current?.phone && contactPatch.phone) fill['phone'] = contactPatch.phone;
      if (!current?.website && data.website) fill['website'] = data.website;
      if (!current?.industry && data.industry) fill['industry'] = data.industry;
      if (!current?.headquarters && data.headquarters) fill['headquarters'] = data.headquarters;
      if (Object.keys(fill).length > 0) {
        await supabaseAdmin.from("organizations").update(fill as never).eq("id", orgId);
      }
    }

    // Delegate user + membership creation to the primary path (dedups by email).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userResult: any;
    const tempPassword = generatePassword(16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email: data.primary_contact_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.primary_contact_name },
    });
    let authUserId: string | null = null;
    let issuedPassword: string | null = tempPassword;
    if (createErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: list } = await (supabaseAdmin as any).auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = list?.users?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u: any) => (u.email ?? "").toLowerCase() === data.primary_contact_email,
      );
      if (!found) throw new Error(createErr.message);
      authUserId = found.id;
      issuedPassword = null; // pre-existing user, no fresh password issued
    } else {
      authUserId = created?.user?.id ?? null;
    }
    if (!authUserId) throw new Error("Unable to resolve auth user");

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    let profileId = existingProfile?.id as string | undefined;
    if (!profileId) {
      const { data: ins, error } = await supabaseAdmin
        .from("profiles")
        .insert({
          auth_user_id: authUserId,
          email: data.primary_contact_email,
          full_name: data.primary_contact_name,
          phone: data.phone ?? null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      profileId = ins.id as string;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("memberships")
      .upsert(
        { user_id: authUserId, organization_id: orgId, role: "client_admin", status: "active" },
        { onConflict: "user_id,organization_id,role" },
      );

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      organization_id: orgId ?? null,
      entity_type: "organizations",
      entity_id: orgId!,
      action: "admin.create_client_workspace",
      after_state: {
        company_name: data.company_name,
        primary_contact_email: data.primary_contact_email,
        notes: data.notes ?? null,
      },
    });

    userResult = {
      user_id: profileId,
      auth_user_id: authUserId,
      email: data.primary_contact_email,
      role: "client_admin" as const,
      organization_id: orgId,
      temporary_password: issuedPassword,
    };

    return { organization_id: orgId!, primary_user: userResult };
  });

// ─────────────────────────────────────────────────────────────
// Team management — list, edit role, reset password, deactivate, remove.
// ─────────────────────────────────────────────────────────────
export const listOrganizationTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mems, error } = await supabaseAdmin
      .from("memberships")
      .select("id, role, status, created_at, user_id")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const authIds = Array.from(new Set((mems ?? []).map((m) => m.user_id as string)));
    // memberships.user_id references auth.users.id, so join to profiles via
    // auth_user_id rather than PostgREST's implicit FK (which doesn't exist).
    const profileMap = new Map<string, { full_name: string | null; email: string | null; status: string | null; auth_user_id: string }>();
    if (authIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email, status, auth_user_id")
        .in("auth_user_id", authIds);
      for (const p of profs ?? []) profileMap.set(p.auth_user_id as string, p as never);
    }
    return (mems ?? []).map((r) => {
      const p = profileMap.get(r.user_id as string);
      return {
        membership_id: r.id,
        role: r.role,
        status: r.status,
        created_at: r.created_at,
        user_id: r.user_id,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        user_status: p?.status ?? null,
        auth_user_id: p?.auth_user_id ?? (r.user_id as string),
      };
    });
  });

const membershipMutInput = z.object({
  membership_id: z.string().uuid(),
});

export const deactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => membershipMutInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ status: "suspended" })
      .eq("id", data.membership_id);
    if (error) throw error;
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "memberships",
      entity_id: data.membership_id,
      action: "admin.deactivate_member",
    });
    return { ok: true };
  });

export const reactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => membershipMutInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ status: "active" })
      .eq("id", data.membership_id);
    if (error) throw error;
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "memberships",
      entity_id: data.membership_id,
      action: "admin.reactivate_member",
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => membershipMutInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ status: "removed" })
      .eq("id", data.membership_id);
    if (error) throw error;
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "memberships",
      entity_id: data.membership_id,
      action: "admin.remove_member",
    });
    return { ok: true };
  });

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ auth_user_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const newPassword = generatePassword(16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(
      data.auth_user_id,
      { password: newPassword },
    );
    if (error) throw error;
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "auth.users",
      entity_id: data.auth_user_id,
      action: "admin.reset_password",
    });
    return { temporary_password: newPassword };
  });

// ─────────────────────────────────────────────────────────────
// QA one-click persona access.
//
// This is a privileged capability: it mints a real magic link for a real
// account, including a platform_admin persona. It is therefore gated three
// ways, all of which must hold:
//   1. Build-time — `import.meta.env.DEV` is statically false in a production
//      build, so the persona code path is dead-code-eliminated. A misset
//      runtime env var can no longer open it.
//   2. Session — `requireSupabaseAuth`, like every other privileged function
//      in this file. Anonymous callers get no response at all.
//   3. Role — `assertPlatformAdmin` on the caller's own memberships.
// ─────────────────────────────────────────────────────────────
type Persona = {
  key: "platform_admin" | "operations" | "client_admin" | "client_editor" | "client_viewer";
  label: string;
  email: string;
};

// Statically false in production builds → the persona branches below are
// removed by the bundler rather than guarded by a runtime string.
const QA_PERSONAS_BUILD_ALLOWED = import.meta.env.DEV === true;

function qaPersonasEnabled(): boolean {
  return QA_PERSONAS_BUILD_ALLOWED && process.env.ENABLE_QA_PERSONA_ACCESS === "true";
}

function qaPersonasConfigured(): Persona[] {
  const raw = process.env.QA_PERSONAS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Persona[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const getQaPersonaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ enabled: boolean; personas: Array<{ key: Persona["key"]; label: string }> }> => {
      if (!qaPersonasEnabled()) return { enabled: false, personas: [] };
      const { supabase, userId } = context;
      await assertPlatformAdmin(supabase, userId);
      const configured = qaPersonasConfigured();
      // Never expose email addresses to the client bundle.
      return {
        enabled: true,
        personas: configured.map((p) => ({ key: p.key, label: p.label })),
      };
    },
  );

export const qaPersonaLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        persona: z.enum([
          "platform_admin",
          "operations",
          "client_admin",
          "client_editor",
          "client_viewer",
        ]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (!qaPersonasEnabled()) {
      throw new Error("QA persona access is disabled");
    }
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);
    const persona = qaPersonasConfigured().find((p) => p.key === data.persona);
    if (!persona) throw new Error("Persona not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: link, error } = await (supabaseAdmin as any).auth.admin.generateLink({
      type: "magiclink",
      email: persona.email,
    });
    if (error) throw error;
    const action_link: string | null =
      link?.properties?.action_link ?? link?.action_link ?? null;
    if (!action_link) throw new Error("Failed to generate persona magic link");
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "auth.users",
      entity_id: userId,
      action: "qa.persona_login",
      after_state: { persona: data.persona },
    });
    return { action_link };
  });


// ─────────────────────────────────────────────────────────────
// Self-service signup provisioning.
// When a user creates an account via the public signup form, they become a
// client_admin of a freshly-created workspace. Candidates are NOT created
// this way — candidate accounts are only provisioned when a CV is submitted
// via the public job application flow.
// Idempotent: safe to re-run; existing memberships/profile are preserved.
// ─────────────────────────────────────────────────────────────
// There is deliberately NO staff email-domain allowlist here.
// platform_admin / operations are granted ONLY through the audited staff
// invite flow in /admin/team, which creates an `invited` membership that the
// invitee then activates by signing in. Domain-based auto-grants are unsafe:
// anyone able to receive mail at (or spoof a signup on) the domain would gain
// full platform staff access with no audited approval step. Do not re-add.


/**
 * Read the caller's email and verification state from the auth service, not
 * from the JWT. `user_metadata.email_verified` is writable by the user via
 * `auth.updateUser()`, so it is not proof of anything — only
 * `email_confirmed_at` on the auth record is.
 */
async function readVerifiedIdentity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
): Promise<{ email: string | null; verified: boolean; fullName: string | null }> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { email: null, verified: false, fullName: null };
  const user = data.user;
  return {
    email: (user.email as string | undefined)?.toLowerCase() ?? null,
    verified: Boolean(user.email_confirmed_at),
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  };
}

const provisionSelfInput = z.object({
  full_name: z.string().min(1).max(120).optional().nullable(),
  company_name: z.string().min(1).max(200).optional().nullable(),
});

// Self-provisioning is intentionally restricted. It NEVER creates a new
// workspace for a stranger, and it NEVER grants a platform role. It only
// activates pending `invited` memberships when the invitee signs in for the
// first time — including staff invites issued from /admin/team.
//
// A user with no invitation lands on /access-denied, regardless of email
// domain. Client and staff access are never granted by public self-signup.
export const provisionClientMembershipForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => provisionSelfInput.parse(raw))
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verification and identity come from the auth record, never from claims:
    // `user_metadata` is user-writable and must not decide privilege.
    const identity = await readVerifiedIdentity(supabaseAdmin, userId);
    const email = identity.email ?? (claims?.email as string | undefined)?.toLowerCase() ?? null;
    const fullName = identity.fullName || (email ? email.split("@")[0] : "New user");


    // Ensure a profile row exists (harmless, grants no privilege).
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        auth_user_id: userId,
        email: email ?? `${userId}@unknown.local`,
        full_name: fullName,
        status: "active",
      });
    }

    const { data: activeMems } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active");
    if (activeMems && activeMems.length > 0) {
      return { ok: true, provisioned: false as const, reason: "already_active" as const };
    }

    // Activate pending invited memberships (invitation acceptance).
    const { data: invited } = await supabaseAdmin
      .from("memberships")
      .select("id, organization_id, role")
      .eq("user_id", userId)
      .eq("status", "invited");
    if (invited && invited.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upErr } = await (supabaseAdmin as any)
        .from("memberships")
        .update({ status: "active" })
        .eq("user_id", userId)
        .eq("status", "invited");
      if (upErr) throw upErr;
      await supabaseAdmin.from("audit_events").insert({
        actor_user_id: userId,
        organization_id: invited[0].organization_id,
        entity_type: "memberships",
        entity_id: invited[0].id,
        action: "invitation.accepted",
        after_state: { count: invited.length },
      });
      return { ok: true, provisioned: true as const, reason: "invitation" as const };
    }

    // No invitation → no access. Staff roles (platform_admin / operations) are
    // never self-granted here; they arrive as an `invited` membership created by
    // an existing platform staff member in /admin/team and are activated by the
    // invitation branch above, leaving an audit trail on both sides.
    return { ok: true, provisioned: false as const, reason: "no_grant" as const };
  });


// ─────────────────────────────────────────────────────────────
// Email-verification gate.
// Google (and any provider) can hand us a session whose email the provider
// never confirmed. Sign-in must not succeed on an unconfirmed address, so the
// client calls this immediately after a session appears and signs the user
// out when it reports `verified: false`.
//
// It also settles the profile row for a genuinely verified user: the row is
// created if missing and left untouched when it already exists, so a
// suspended or deleted account is never silently reactivated.
// ─────────────────────────────────────────────────────────────
export const assertVerifiedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const c = claims as Record<string, unknown>;
    const provider =
      ((c.app_metadata as { provider?: string } | undefined)?.provider as string | undefined) ??
      "email";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verification is read from the auth record's `email_confirmed_at`.
    // `user_metadata.email_verified` is writable by the user through
    // `auth.updateUser()` and is never treated as proof.
    const identity = await readVerifiedIdentity(supabaseAdmin, userId);
    const email = identity.email ?? (c.email as string | undefined)?.toLowerCase() ?? null;

    if (!identity.verified) {
      return { verified: false as const, provider, active: false as const };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    let status = profile?.status ?? null;
    if (!profile) {
      // First verified sign-in: create the profile as active. This grants no
      // membership, role or tenant access on its own.
      const { data: created } = await supabaseAdmin
        .from("profiles")
        .insert({
          auth_user_id: userId,
          email: email ?? `${userId}@unknown.local`,
          full_name: identity.fullName,
          status: "active",
        })
        .select("status")
        .maybeSingle();
      status = created?.status ?? "active";
    }

    return { verified: true as const, provider, active: status === "active", status };
  });

export const updateStaffProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        full_name: z.string().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get current state for audit
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", userId);

    if (error) throw error;

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      entity_type: "profiles",
      entity_id: userId,
      action: "profile.update",
      before_state: before ? { full_name: before.full_name } : null,
      after_state: { full_name: data.full_name },
    });

    return { ok: true };
  });


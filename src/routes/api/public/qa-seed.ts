// Phase 11 QA seed route. Public path bypasses auth; guarded by x-qa-token header.
// Idempotent: on POST action=seed it cleans up prior QA data and provisions a fresh tenant.
// action=cleanup removes all QA fixtures. Never enable without QA_SEED_TOKEN set.

import { createFileRoute } from "@tanstack/react-router";

const QA_EMAILS = {
  platform_admin: "qa.admin@qa.taasflow.test",
  client_admin: "qa.clientadmin@qa.taasflow.test",
  client_viewer: "qa.clientviewer@qa.taasflow.test",
  other_client_admin: "qa.otherclientadmin@qa.taasflow.test",
  candidate: "qa.candidate@qa.taasflow.test",
  candidate_cross: "qa.candidate.cross@qa.taasflow.test",
} as const;

const QA_PASSWORD = "QaTest!Phase11";

const QA_ORG_NAME = "QA_TESTCO_E2E";
const QA_OTHER_ORG_NAME = "QA_OTHERCO_E2E";

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function findUserIdByEmail(supabase: unknown, email: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let page = 1;
  while (page < 20) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data?.users ?? []).find(
      (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id as string;
    if (!data || (data.users ?? []).length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureUser(
  supabase: unknown,
  email: string,
  password: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const existing = await findUserIdByEmail(sb, email);
  if (existing) return existing;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed for ${email}: ${error.message}`);
  return data.user.id as string;
}

async function cleanupQAData(): Promise<{ deleted: Record<string, number> }> {
  const sb = await loadAdmin();
  const counts: Record<string, number> = {};

  // Find org ids by name
  const { data: orgs } = await sb
    .from("organizations")
    .select("id")
    .in("name", [QA_ORG_NAME, QA_OTHER_ORG_NAME]);
  const orgIds = (orgs ?? []).map((o: { id: string }) => o.id);
  counts.orgs_found = orgIds.length;

  if (orgIds.length > 0) {
    // Find positions
    const { data: posRows } = await sb
      .from("positions")
      .select("id")
      .in("organization_id", orgIds);
    const posIds = (posRows ?? []).map((p: { id: string }) => p.id);
    counts.positions_found = posIds.length;

    if (posIds.length > 0) {
      const { count: mc } = await sb
        .from("candidate_matches")
        .delete({ count: "exact" })
        .in("position_id", posIds);
      counts.matches_deleted = mc ?? 0;

      const { count: ac } = await sb
        .from("applications")
        .delete({ count: "exact" })
        .in("position_id", posIds);
      counts.applications_deleted = ac ?? 0;

      const { count: sc } = await sb
        .from("screening_questions")
        .delete({ count: "exact" })
        .in("position_id", posIds);
      counts.screening_deleted = sc ?? 0;

      const { count: pc } = await sb
        .from("positions")
        .delete({ count: "exact" })
        .in("id", posIds);
      counts.positions_deleted = pc ?? 0;
    }

    const { count: memc } = await sb
      .from("memberships")
      .delete({ count: "exact" })
      .in("organization_id", orgIds);
    counts.memberships_deleted = memc ?? 0;

    const { count: oc } = await sb
      .from("organizations")
      .delete({ count: "exact" })
      .in("id", orgIds);
    counts.organizations_deleted = oc ?? 0;
  }

  // Delete QA auth users (cascades profiles, candidate_profiles, applications, matches)
  let usersDeleted = 0;
  for (const email of Object.values(QA_EMAILS)) {
    const uid = await findUserIdByEmail(sb, email);
    if (uid) {
      const { error } = await sb.auth.admin.deleteUser(uid);
      if (!error) usersDeleted += 1;
    }
  }
  counts.auth_users_deleted = usersDeleted;

  return { deleted: counts };
}

async function seedQAData(): Promise<{
  users: Record<string, { id: string; email: string; password: string }>;
  org_id: string;
  other_org_id: string;
  position_id: string;
  closed_position_id: string;
}> {
  // Clean slate first so seed is deterministic.
  await cleanupQAData();
  const sb = await loadAdmin();

  // Provision auth users
  const userIds: Record<string, string> = {};
  for (const [role, email] of Object.entries(QA_EMAILS)) {
    userIds[role] = await ensureUser(sb, email, QA_PASSWORD);
  }

  // Ensure profiles exist (auth users don't get profile rows automatically here)
  for (const [role, email] of Object.entries(QA_EMAILS)) {
    const uid = userIds[role];
    await sb.from("profiles").upsert(
      {
        auth_user_id: uid,
        email,
        full_name: `QA ${role}`,
        status: "active",
      },
      { onConflict: "auth_user_id" },
    );
  }

  // Grant platform admin role to admin
  await sb.from("user_roles").upsert(
    { user_id: userIds.platform_admin, role: "admin" },
    { onConflict: "user_id,role" },
  );
  await sb.from("user_roles").upsert(
    { user_id: userIds.candidate, role: "candidate" },
    { onConflict: "user_id,role" },
  );
  await sb.from("user_roles").upsert(
    { user_id: userIds.candidate_cross, role: "candidate" },
    { onConflict: "user_id,role" },
  );

  // Create orgs
  const { data: orgRow, error: orgErr } = await sb
    .from("organizations")
    .insert({ name: QA_ORG_NAME, status: "active", domain: "qa-testco.test" })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  const orgId = orgRow.id as string;

  const { data: otherOrgRow, error: otherErr } = await sb
    .from("organizations")
    .insert({ name: QA_OTHER_ORG_NAME, status: "active", domain: "qa-otherco.test" })
    .select("id")
    .single();
  if (otherErr) throw otherErr;
  const otherOrgId = otherOrgRow.id as string;

  // Memberships
  await sb.from("memberships").insert([
    { user_id: userIds.platform_admin, organization_id: orgId, role: "platform_admin", status: "active" },
    { user_id: userIds.client_admin, organization_id: orgId, role: "client_admin", status: "active" },
    { user_id: userIds.client_viewer, organization_id: orgId, role: "client_viewer", status: "active" },
    { user_id: userIds.other_client_admin, organization_id: otherOrgId, role: "client_admin", status: "active" },
  ]);

  // Active + published position in QA_TESTCO with meaningful requirements
  const { data: posRow, error: posErr } = await sb
    .from("positions")
    .insert({
      organization_id: orgId,
      title: "QA Backend Engineer",
      department: "Engineering",
      location: "Remote",
      work_model: "remote",
      employment_type: "full_time",
      seniority: "mid",
      description:
        "We are hiring a Backend Engineer to build and maintain reliable APIs and data pipelines. You will work with Python, PostgreSQL, and cloud infrastructure to ship features that scale.",
      requirements: ["3+ years Python", "PostgreSQL experience", "REST API design"],
      preferred_requirements: ["Cloud (AWS/GCP)"],
      dealbreakers: [],
      compensation: { currency: "USD", min: 90000, max: 140000 },
      work_authorization: { required: false },
      status: "active",
      visibility: "public",
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      created_by: userIds.client_admin,
    })
    .select("id")
    .single();
  if (posErr) throw posErr;
  const positionId = posRow.id as string;

  // Closed position (should not show on public board)
  const { data: closedRow, error: closedErr } = await sb
    .from("positions")
    .insert({
      organization_id: orgId,
      title: "QA Closed Role",
      description: "Closed role for negative-test coverage. Should never appear on the public board.",
      requirements: ["N/A"],
      preferred_requirements: [],
      dealbreakers: [],
      compensation: {},
      work_authorization: {},
      status: "closed",
      visibility: "private",
      closed_at: new Date().toISOString(),
      created_by: userIds.client_admin,
    })
    .select("id")
    .single();
  if (closedErr) throw closedErr;
  const closedPositionId = closedRow.id as string;

  const usersOut: Record<string, { id: string; email: string; password: string }> = {};
  for (const [role, email] of Object.entries(QA_EMAILS)) {
    usersOut[role] = { id: userIds[role], email, password: QA_PASSWORD };
  }

  return {
    users: usersOut,
    org_id: orgId,
    other_org_id: otherOrgId,
    position_id: positionId,
    closed_position_id: closedPositionId,
  };
}

/**
 * Removes everything the E2E suite created by driving the real /intake form:
 * organizations named with the QA prefix, their positions and intakes, and the
 * auth accounts on the qa.taasflow.test mailbox. Never matches real data.
 */
async function cleanupIntakeE2E(prefix: string): Promise<{ deleted: Record<string, number> }> {
  const sb = await loadAdmin();
  const counts: Record<string, number> = {};
  const safePrefix = prefix.startsWith("QA_") ? prefix : "QA_INTAKE_E2E_";

  const { data: orgs } = await sb.from("organizations").select("id").ilike("name", `${safePrefix}%`);
  const orgIds = (orgs ?? []).map((o: { id: string }) => o.id);
  counts.orgs_found = orgIds.length;

  if (orgIds.length > 0) {
    const { data: posRows } = await sb.from("positions").select("id").in("organization_id", orgIds);
    const posIds = (posRows ?? []).map((p: { id: string }) => p.id);
    if (posIds.length > 0) {
      await sb.from("candidate_matches").delete().in("position_id", posIds);
      await sb.from("applications").delete().in("position_id", posIds);
      await sb.from("screening_questions").delete().in("position_id", posIds);
      await sb.from("position_commitments").delete().in("position_id", posIds);
      const { count: pc } = await sb
        .from("positions")
        .delete({ count: "exact" })
        .in("id", posIds);
      counts.positions_deleted = pc ?? 0;
    }
    const { count: ic } = await sb
      .from("intake_submissions")
      .delete({ count: "exact" })
      .in("organization_id", orgIds);
    counts.intakes_deleted = ic ?? 0;
    await sb.from("memberships").delete().in("organization_id", orgIds);
    const { count: oc } = await sb
      .from("organizations")
      .delete({ count: "exact" })
      .in("id", orgIds);
    counts.organizations_deleted = oc ?? 0;
  }

  // Intakes that never reached an organization (submit failed mid-way).
  const { count: orphanIntakes } = await sb
    .from("intake_submissions")
    .delete({ count: "exact" })
    .ilike("company_name", `${safePrefix}%`);
  counts.orphan_intakes_deleted = orphanIntakes ?? 0;

  const { count: bookings } = await sb
    .from("booking_sessions")
    .delete({ count: "exact" })
    .ilike("company_name", `${safePrefix}%`);
  counts.booking_sessions_deleted = bookings ?? 0;

  // Auth accounts created through the form (qa.intake+<stamp>@qa.taasflow.test).
  let usersDeleted = 0;
  let page = 1;
  while (page < 20) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users as Array<{ id: string; email?: string | null }>) {
      const email = (u.email ?? "").toLowerCase();
      if (email.startsWith("qa.intake+") && email.endsWith("@qa.taasflow.test")) {
        const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
        if (!delErr) usersDeleted += 1;
      }
    }
    if (users.length < 200) break;
    page += 1;
  }
  counts.auth_users_deleted = usersDeleted;

  // Profile rows left behind by deleted accounts.
  const { count: profs } = await sb
    .from("profiles")
    .delete({ count: "exact" })
    .ilike("email", "qa.intake+%@qa.taasflow.test");
  counts.profiles_deleted = profs ?? 0;

  return { deleted: counts };
}

/** Reads back what a real submit persisted, so tests assert on the database. */
async function lookupIntake(companyName: string, email?: string) {
  const sb = await loadAdmin();
  const { data: org } = await sb
    .from("organizations")
    .select("id,name,is_test_record")
    .eq("name", companyName)
    .maybeSingle();
  const { data: intake } = await sb
    .from("intake_submissions")
    .select("id,organization_id")
    .eq("company_name", companyName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position: { id: string; title: string; status: string } | null = null;
  if (org?.id) {
    const { data: pos } = await sb
      .from("positions")
      .select("id,title,status")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (pos ?? null) as typeof position;
  }
  let authUser: { id: string; email: string } | null = null;
  if (email) {
    const uid = await findUserIdByEmail(sb, email);
    if (uid) authUser = { id: uid, email };
  }
  const { count: bookingCount } = await sb
    .from("booking_sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_name", companyName);
  return {
    organization: org ?? null,
    intake_submission: intake ?? null,
    auth_user: authUser,
    position,
    booking_sessions: bookingCount ?? 0,
  };
}

/** Booking sessions created by the /book flow, looked up by work email. */
async function lookupBooking(email: string) {
  const sb = await loadAdmin();
  const { data: rows } = await sb
    .from("booking_sessions")
    .select("id,email,company_name,status")
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(5);
  return { sessions: rows ?? [] };
}

async function cleanupBookingE2E(emailPattern: string): Promise<{ deleted: number }> {
  const sb = await loadAdmin();
  const safe = emailPattern.includes("@qa.taasflow.test") ? emailPattern : "qa.book+%@qa.taasflow.test";
  const { count } = await sb
    .from("booking_sessions")
    .delete({ count: "exact" })
    .ilike("email", safe);
  return { deleted: count ?? 0 };
}

async function handle(request: Request): Promise<Response> {
  const token = request.headers.get("x-qa-token");
  const expected = process.env.QA_SEED_TOKEN;
  if (!expected) return new Response("QA_SEED_TOKEN not configured", { status: 500 });
  if (!token || token !== expected) return new Response("forbidden", { status: 401 });

  let body: {
    action?: string;
    email?: string;
    user_id?: string;
    position_id?: string;
    full_name?: string;
    prefix?: string;
    company_name?: string;
    email_pattern?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const action = body.action ?? "seed";


  try {
    if (action === "cleanup") {
      const res = await cleanupQAData();
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "seed") {
      const res = await seedQAData();
      return Response.json({ ok: true, action, ...res });
    if (action === "cleanup_intake_e2e") {
      const res = await cleanupIntakeE2E(body.prefix ?? "QA_INTAKE_E2E_");
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "cleanup_booking_e2e") {
      const res = await cleanupBookingE2E(body.email_pattern ?? "qa.book+%@qa.taasflow.test");
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "lookup_intake") {
      if (!body.company_name) {
        return Response.json({ ok: false, error: "company_name required" }, { status: 400 });
      }
      const res = await lookupIntake(body.company_name, body.email);
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "lookup_booking") {
      if (!body.email) return Response.json({ ok: false, error: "email required" }, { status: 400 });
      const res = await lookupBooking(body.email);
      return Response.json({ ok: true, action, ...res });
    }

    if (action === "status") {
      const sb = await loadAdmin();
      const { count } = await sb
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .in("name", [QA_ORG_NAME, QA_OTHER_ORG_NAME]);
      return Response.json({ ok: true, action, qa_orgs_present: count ?? 0 });
    }
    if (action === "create_application") {
      if (!body.user_id || !body.email || !body.position_id) {
        return Response.json({ ok: false, error: "user_id, email, position_id required" }, { status: 400 });
      }
      const sb = await loadAdmin();
      // Ensure candidate_profile
      const { data: existingCp } = await sb.from("candidate_profiles").select("id").eq("user_id", body.user_id).maybeSingle();
      let cpId = existingCp?.id as string | undefined;
      if (!cpId) {
        const { data: cpRow, error: cpErr } = await sb.from("candidate_profiles")
          .insert({ user_id: body.user_id, full_name: body.full_name ?? "QA Candidate", email: body.email, consent: { terms: true, privacy: true } })
          .select("id").single();
        if (cpErr) throw cpErr;
        cpId = cpRow.id as string;
      }
      // Position org
      const { data: posRow, error: posErr } = await sb.from("positions").select("organization_id").eq("id", body.position_id).single();
      if (posErr) throw posErr;
      // Application
      const { data: appRow, error: appErr } = await sb.from("applications")
        .insert({ candidate_profile_id: cpId, position_id: body.position_id, source: "web", status: "received" })
        .select("id").single();
      if (appErr) throw appErr;
      const appId = appRow.id as string;
      // Match
      const { data: matchRow, error: mErr } = await sb.from("candidate_matches")
        .insert({ application_id: appId, candidate_profile_id: cpId, position_id: body.position_id, organization_id: posRow.organization_id, stage: "sourced", processing_state: "queued", admin_status: "pending", client_visibility: "hidden" })
        .select("id").single();
      if (mErr) throw mErr;
      return Response.json({ ok: true, action, application_id: appId, candidate_profile_id: cpId, candidate_match_id: matchRow.id });
    }
    return new Response(`unknown action: ${action}`, { status: 400 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[qa-seed] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/qa-seed")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});

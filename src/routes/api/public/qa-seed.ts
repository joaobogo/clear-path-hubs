// Phase 11 QA seed route. Public path bypasses auth; guarded by x-qa-token header.
// Idempotent: on POST action=seed it cleans up prior QA data and provisions a fresh tenant.
// action=cleanup removes all QA fixtures. Never enable without QA_SEED_TOKEN set.

import { createFileRoute } from "@tanstack/react-router";
import { readJsonWithLimit } from "@/lib/public-api/body-limit";
import {
  PUBLIC_BODY_LIMITS,
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

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

/**
 * Every destructive/read helper here is scoped to QA mailboxes only.
 *
 * `.test` is a reserved TLD that can never be a deliverable address, and we
 * additionally require the local part to start with `qa`. That makes it
 * impossible for these helpers to touch a real candidate, whichever QA
 * mailbox convention a spec uses (`qa.cand+…@qa.taasflow.test` or
 * `qa+apply-…@taasflow.test`).
 */
function assertQaMailbox(email: string, action: string): string {
  const lower = (email ?? "").trim().toLowerCase();
  const local = lower.split("@")[0] ?? "";
  const domain = lower.split("@")[1] ?? "";
  if (!domain.endsWith(".test") || !local.startsWith("qa")) {
    throw new Error(`${action} only accepts qa*@*.test mailboxes`);
  }
  return lower;
}

/** Same rule for LIKE patterns used by the cleanup helpers. */
function assertQaPattern(pattern: string, fallback: string): string {
  const lower = (pattern ?? "").trim().toLowerCase();
  const local = lower.split("@")[0] ?? "";
  const domain = lower.split("@")[1] ?? "";
  if (!domain.endsWith(".test") || !local.startsWith("qa")) return fallback;
  return lower;
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

/** Mailboxes used only by the seat-cap scenarios. */
const SEAT_SCENARIO_EMAILS = {
  suspended: "qa.seat.suspended@qa.taasflow.test",
  invited: "qa.seat.invited@qa.taasflow.test",
  extra: "qa.seat.extra@qa.taasflow.test",
} as const;

/**
 * Puts the QA workspace into a "no seats left" state so the reactivation
 * refusal can be exercised through the real UI.
 *
 * `pending_invites` and `extra_active` shape which remedies the dialog should
 * offer: an invitation that can be cancelled, a teammate that can be
 * suspended, or neither. The seat limit is derived from real seat holders
 * afterwards so `seatsLeft` lands on exactly zero.
 */
async function seatScenario(opts: {
  pendingInvites?: number;
  extraActive?: boolean;
  /** When true the cap stays wide open, so reactivation is allowed to succeed. */
  freeSeats?: boolean;
}): Promise<{
  organization_id: string;
  seat_limit: number;
  seats_used: number;
  suspended_user_id: string;
  invited_user_id: string | null;
}> {
  const sb = await loadAdmin();
  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id")
    .eq("name", QA_ORG_NAME)
    .single();
  if (orgErr) throw new Error(`seat_scenario needs the QA org seeded first: ${orgErr.message}`);
  const orgId = org.id as string;

  // Start from a clean slate: scenario memberships removed and the cap wide
  // open, so inserting the fixtures can never trip the seat guard.
  const scenarioIds: string[] = [];
  for (const [label, email] of Object.entries(SEAT_SCENARIO_EMAILS)) {
    const uid = await ensureUser(sb, assertQaMailbox(email, "seat_scenario"), QA_PASSWORD);
    // The team list renders names from profiles, so a membership without one
    // shows as an anonymous "Team member" and no test can target it.
    await sb.from("profiles").upsert(
      { auth_user_id: uid, email, full_name: `QA seat ${label}`, status: "active" },
      { onConflict: "auth_user_id" },
    );
    scenarioIds.push(uid);
  }
  await sb.from("memberships").delete().eq("organization_id", orgId).in("user_id", scenarioIds);
  await sb.from("organizations").update({ client_seat_limit: 20 }).eq("id", orgId);

  const suspendedId = scenarioIds[0]!;
  const invitedId = scenarioIds[1]!;
  const extraId = scenarioIds[2]!;

  const rows: Array<Record<string, unknown>> = [
    { user_id: suspendedId, organization_id: orgId, role: "client_viewer", status: "suspended" },
  ];
  if ((opts.pendingInvites ?? 0) > 0) {
    rows.push({ user_id: invitedId, organization_id: orgId, role: "client_viewer", status: "invited" });
  }
  if (opts.extraActive) {
    rows.push({ user_id: extraId, organization_id: orgId, role: "client_viewer", status: "active" });
  }
  const { error: memErr } = await sb.from("memberships").insert(rows);
  if (memErr) throw memErr;

  // Seat holders = active + invited on seat-bearing roles. readSeatUsage adds
  // an owner seat on top of client_seat_limit, so limit = holders - 1 fills it.
  const { data: holders, error: holdErr } = await sb
    .from("memberships")
    .select("id")
    .eq("organization_id", orgId)
    .in("role", ["client_admin", "client_editor", "client_viewer"])
    .in("status", ["active", "invited"]);
  if (holdErr) throw holdErr;
  const seatsUsed = (holders ?? []).length;
  const recruiterSeats = opts.freeSeats ? seatsUsed + 4 : Math.max(0, seatsUsed - 1);
  const { error: capErr } = await sb
    .from("organizations")
    .update({ client_seat_limit: recruiterSeats })
    .eq("id", orgId);
  if (capErr) throw capErr;

  return {
    organization_id: orgId,
    seat_limit: recruiterSeats + 1,
    seats_used: seatsUsed,
    suspended_user_id: suspendedId,
    invited_user_id: (opts.pendingInvites ?? 0) > 0 ? invitedId : null,
  };
}

/** Restores the QA workspace after a seat scenario. */
async function seatScenarioReset(): Promise<{ organization_id: string | null }> {
  const sb = await loadAdmin();
  const { data: org } = await sb
    .from("organizations")
    .select("id")
    .eq("name", QA_ORG_NAME)
    .maybeSingle();
  if (!org) return { organization_id: null };
  const orgId = org.id as string;
  const ids: string[] = [];
  for (const email of Object.values(SEAT_SCENARIO_EMAILS)) {
    const id = await findUserIdByEmail(sb, email);
    if (id) ids.push(id);
  }
  if (ids.length) {
    await sb.from("memberships").delete().eq("organization_id", orgId).in("user_id", ids);
  }
  await sb.from("organizations").update({ client_seat_limit: 3 }).eq("id", orgId);
  return { organization_id: orgId };
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
    // Org-scoped audit/trace rows block the organizations delete (FK, no
    // cascade), which used to leave orphan QA_* orgs and break the next seed
    // on the unique name constraint.
    for (const table of ["audit_events", "trace_index", "lead_notifications", "pilot_claims"]) {
      await sb.from(table).delete().in("organization_id", orgIds);
    }
    // Find positions

    const { data: posRows } = await sb
      .from("positions")
      .select("id")
      .in("organization_id", orgIds);
    const posIds = (posRows ?? []).map((p: { id: string }) => p.id);
    counts.positions_found = posIds.length;

    if (posIds.length > 0) {
      // candidate_stage_history / score_runs / rubric_versions are append-only,
      // so plain deletes can never remove fixture applications or positions.
      // qa_purge_test_organizations is the service-role-only escape hatch and
      // refuses to touch anything not flagged is_test_record.
      const { data: purge, error: purgeError } = await sb.rpc("qa_purge_test_organizations", {
        _names: [QA_ORG_NAME, QA_OTHER_ORG_NAME],
      });
      if (purgeError) {
        (counts as Record<string, unknown>)["purge_error_message"] = purgeError.message;
      } else {
        const result = (purge ?? {}) as { positions_deleted?: number; organizations_deleted?: number };
        counts.positions_deleted = result.positions_deleted ?? 0;
        counts.organizations_deleted = result.organizations_deleted ?? 0;
      }
    }

    // Fallback for orgs that had no positions: the purge above already removed
    // memberships and the org itself when it ran.
    const { count: memc } = await sb
      .from("memberships")
      .delete({ count: "exact" })
      .in("organization_id", orgIds);
    counts.memberships_deleted = memc ?? 0;

    const { count: oc, error: oe } = await sb
      .from("organizations")
      .delete({ count: "exact" })
      .in("id", orgIds);
    counts.organizations_deleted = (counts.organizations_deleted ?? 0) + (oc ?? 0);
    if (oe) (counts as Record<string, unknown>)["organizations_error_message"] = oe.message;
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

  // Candidate seats are not memberships, so the candidate dashboard only
  // resolves when a candidate_profiles row is linked to the auth user. Seed it
  // here or QA candidate sign-in dead-ends on /access-denied.
  await sb.from("candidate_profiles").upsert(
    [
      {
        user_id: userIds.candidate,
        email: QA_EMAILS.candidate,
        full_name: "QA Candidate",
        is_test_record: true,
      },
      {
        user_id: userIds.candidate_cross,
        email: QA_EMAILS.candidate_cross,
        full_name: "QA Candidate Cross",
        is_test_record: true,
      },
    ],
    { onConflict: "user_id" },
  );



  // Create orgs
  const { data: orgRow, error: orgErr } = await sb
    .from("organizations")
    .insert({ name: QA_ORG_NAME, status: "active", domain: "qa-testco.test", is_test_record: true })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  const orgId = orgRow.id as string;

  const { data: otherOrgRow, error: otherErr } = await sb
    .from("organizations")
    .insert({ name: QA_OTHER_ORG_NAME, status: "active", domain: "qa-otherco.test", is_test_record: true })
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
      // Test fixtures must never surface on the public job board.
      is_test_record: true,
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
      // The publish gate requires a settled payment; QA fixtures are exempt so
      // the harness never simulates a paid transaction.
      payment_status: "exempt",
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

  // Screening questions the candidate journey answers through the real UI.
  await sb.from("screening_questions").insert([
    {
      position_id: positionId,
      question: "How many years of professional Python experience do you have?",
      answer_type: "number",
      required: true,
      display_order: 1,
    },
    {
      position_id: positionId,
      question: "Are you authorised to work remotely for a company in the EU?",
      answer_type: "boolean",
      required: true,
      display_order: 2,
    },
    {
      position_id: positionId,
      question: "Anything else we should know? (optional)",
      answer_type: "long_text",
      required: false,
      display_order: 3,
    },
  ]);

  // Closed position (should not show on public board)
  const { data: closedRow, error: closedErr } = await sb
    .from("positions")
    .insert({
      organization_id: orgId,
      is_test_record: true,
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
      if (email.startsWith("qa.intake+") && email.endsWith("qa.taasflow.test")) {
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
    .ilike("email", "qa.intake+%qa.taasflow.test");
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
  const emailLower = email.toLowerCase();
  if (!emailLower.endsWith("@qa.taasflow.test")) {
    throw new Error("lookup_booking only accepts @qa.taasflow.test mailboxes");
  }
  const { data: rows } = await sb
    .from("booking_sessions")
    .select(
      "id,email,company_name,status,scheduled_start,scheduled_end,join_url,timezone,host_name,calendly_event_uri,calendly_invitee_uri,qualification_score",
    )
    .eq("email", emailLower)
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

/**
 * Reads back everything the real candidate apply flow persisted, so the E2E
 * suite can assert rows instead of trusting the UI. Scoped to a single
 * @qa.taasflow.test mailbox — it can never touch real candidate data.
 */
async function lookupCandidateApplication(email: string) {
  const sb = await loadAdmin();
  const emailLower = assertQaMailbox(email, "lookup_candidate_application");
  const { data: cp } = await sb
    .from("candidate_profiles")
    .select("id,full_name,email,user_id,current_cv_file_id,phone,city,country")
    .eq("email", emailLower)
    .maybeSingle();
  if (!cp) {
    return {
      candidate_profile: null,
      applications: [],
      matches: [],
      jobs: [],
      score_runs: [],
      evidence: 0,
      answers: [],
      files: [],
      notification_events: [],
      notifications: 0,
      notification_deliveries: 0,
      storage_objects: [],
    };
  }
  const { data: apps } = await sb
    .from("applications")
    .select("id,position_id,status,source,cv_file_id,created_at,question_version,consent")
    .eq("candidate_profile_id", cp.id)
    .order("created_at", { ascending: true });
  const appIds = (apps ?? []).map((a: { id: string }) => a.id);

  // Organization is resolved through the position so the suite can assert the
  // application really is linked to the right tenant.
  const positionIds = [...new Set((apps ?? []).map((a: { position_id: string }) => a.position_id))];
  const { data: positions } = positionIds.length
    ? await sb.from("positions").select("id,organization_id,title").in("id", positionIds)
    : { data: [] };
  const orgByPosition = new Map(
    (positions ?? []).map((p: { id: string; organization_id: string }) => [p.id, p.organization_id]),
  );
  const applications = (apps ?? []).map((a: { position_id: string }) => ({
    ...a,
    organization_id: orgByPosition.get(a.position_id) ?? null,
  }));

  const { data: matches } = appIds.length
    ? await sb
        .from("candidate_matches")
        // Score lives on score_runs, not here — selecting total_score/score_band
        // made this query error and silently return [] for every suite.
        .select(
          "id,application_id,organization_id,position_id,processing_state,stage,admin_status,client_visibility,current_score_run_id,approved_score_run_id,score_stale",
        )

        .in("application_id", appIds)
    : { data: [] };
  const { data: jobs } = appIds.length
    ? await sb
        .from("processing_jobs")
        .select("id,entity_id,job_type,status,attempts")
        .in("entity_id", appIds)
    : { data: [] };
  const { data: answers } = appIds.length
    ? await sb
        .from("application_answers")
        .select("id,application_id,question_id,answer")
        .in("application_id", appIds)
    : { data: [] };
  const { data: files } = await sb
    .from("files")
    .select("id,storage_bucket,storage_path,filename,mime_type,size,page_count,parse_state,file_status,upload_source")
    .eq("candidate_profile_id", cp.id);

  // Prove the CV bytes really landed in the private bucket.
  const storage_objects: Array<{ path: string; exists: boolean; size: number | null }> = [];
  for (const f of files ?? []) {
    const path = (f as { storage_path: string }).storage_path;
    if (!path) continue;
    const slash = path.lastIndexOf("/");
    const dir = slash > 0 ? path.slice(0, slash) : "";
    const name = slash > 0 ? path.slice(slash + 1) : path;
    const { data: listed } = await sb.storage
      .from((f as { storage_bucket: string }).storage_bucket ?? "cvs")
      .list(dir, { search: name, limit: 100 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = (listed ?? []).find((o: any) => o.name === name);
    storage_objects.push({
      path,
      exists: Boolean(hit),
      size: hit?.metadata?.size ?? null,
    });
  }

  const matchIds = (matches ?? []).map((m: { id: string }) => m.id);
  const { data: runs } = matchIds.length
    ? await sb
        .from("score_runs")
        .select("id,candidate_match_id,status,total_score,score_band")
        .in("candidate_match_id", matchIds)
    : { data: [] };

  // Downstream notification fan-out for this application.
  const { data: events } = appIds.length
    ? await sb
        .from("notification_events")
        .select("id,event_type,application_id,organization_id,created_at")
        .in("application_id", appIds)
    : { data: [] };
  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  let notifications = 0;
  let notification_deliveries = 0;
  if (eventIds.length) {
    const { count: nc } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    notifications = nc ?? 0;
    const { data: notifRows } = await sb.from("notifications").select("id").in("event_id", eventIds);
    const notifIds = (notifRows ?? []).map((n: { id: string }) => n.id);
    if (notifIds.length) {
      const { count: dc } = await sb
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .in("notification_id", notifIds);
      notification_deliveries = dc ?? 0;
    }
  }

  let evidence = 0;
  if (matchIds.length) {
    const { count } = await sb
      .from("candidate_evidence_items")
      .select("id", { count: "exact", head: true })
      .in("candidate_match_id", matchIds);
    evidence = count ?? 0;
  }
  return {
    candidate_profile: cp,
    applications,
    matches: matches ?? [],
    jobs: jobs ?? [],
    score_runs: runs ?? [],
    evidence,
    answers: answers ?? [],
    files: files ?? [],
    notification_events: events ?? [],
    notifications,
    notification_deliveries,
    storage_objects,
  };
}


/**
 * Deletes every candidate artefact the suite created via the real apply UI:
 * matches and all their children, the application and its answers, processing
 * jobs, score runs, notification fan-out, talent-graph rows, the CV row AND the
 * object bytes in the private bucket, the profile, and the auth user.
 */
async function cleanupCandidateE2E(emailPattern: string): Promise<{ deleted: Record<string, number> }> {
  const sb = await loadAdmin();
  const counts: Record<string, number> = {};
  const safe = assertQaPattern(emailPattern, "qa.cand+%@qa.taasflow.test");

  const { data: cps } = await sb
    .from("candidate_profiles")
    .select("id,email,user_id")
    .ilike("email", safe);
  const cpIds = (cps ?? []).map((c: { id: string }) => c.id);
  counts.candidate_profiles_found = cpIds.length;

  if (cpIds.length > 0) {
    const { data: apps } = await sb.from("applications").select("id").in("candidate_profile_id", cpIds);
    const appIds = (apps ?? []).map((a: { id: string }) => a.id);

    if (appIds.length > 0) {
      const { data: ms } = await sb.from("candidate_matches").select("id").in("application_id", appIds);
      const matchIds = (ms ?? []).map((m: { id: string }) => m.id);
      if (matchIds.length > 0) {
        for (const table of [
          "candidate_evidence_items",
          "candidate_evidence",
          "score_decisions",
          "scoring_debug_events",
          "candidate_stage_history",
          "scoring_orphans",
          "scoring_review_claims",
          "eligibility_checks",
          "eligibility_exceptions",
          "evidence_overrides",
          "candidate_notes",
          "candidate_interviewer_assignments",
          "interview_scorecards",
          "interviews",
          "client_decisions",
          "conversations",
          "tasks",
          "agent_activity",
          "teams_action_links",
          "talent_graph_edges",
        ]) {
          await sb.from(table).delete().in("candidate_match_id", matchIds);
        }
        await sb.from("score_runs").delete().in("candidate_match_id", matchIds);
      }

      // Notification fan-out is keyed off notification_events for the app.
      const { data: nEvents } = await sb
        .from("notification_events")
        .select("id")
        .in("application_id", appIds);
      const eventIds = (nEvents ?? []).map((e: { id: string }) => e.id);
      if (eventIds.length > 0) {
        const { data: notifs } = await sb.from("notifications").select("id").in("event_id", eventIds);
        const notifIds = (notifs ?? []).map((n: { id: string }) => n.id);
        if (notifIds.length > 0) {
          const { count: dc } = await sb
            .from("notification_deliveries")
            .delete({ count: "exact" })
            .in("notification_id", notifIds);
          counts.notification_deliveries_deleted = dc ?? 0;
          const { count: nc } = await sb
            .from("notifications")
            .delete({ count: "exact" })
            .in("id", notifIds);
          counts.notifications_deleted = nc ?? 0;
        }
        const { count: ec } = await sb
          .from("notification_events")
          .delete({ count: "exact" })
          .in("id", eventIds);
        counts.notification_events_deleted = ec ?? 0;
      }

      if (matchIds.length > 0) {
        const { count } = await sb.from("candidate_matches").delete({ count: "exact" }).in("id", matchIds);
        counts.matches_deleted = count ?? 0;
      }
      await sb.from("processing_jobs").delete().in("entity_id", appIds);
      await sb.from("score_runs").delete().in("application_id", appIds);
      await sb.from("outreach_touches").delete().in("application_id", appIds);
      await sb.from("candidate_info_requests").delete().in("application_id", appIds);
      await sb.from("hire_records").delete().in("application_id", appIds);
      const { count: aac } = await sb
        .from("application_answers")
        .delete({ count: "exact" })
        .in("application_id", appIds);
      counts.application_answers_deleted = aac ?? 0;
      const { count: ac } = await sb.from("applications").delete({ count: "exact" }).in("id", appIds);
      counts.applications_deleted = ac ?? 0;
    }

    // Profile-scoped leftovers that survive without an application.
    for (const table of [
      "score_runs",
      "candidate_evidence",
      "consent_records",
      "data_subject_requests",
      "outreach_opt_outs",
      "outreach_touches",
      "role_memory",
      "search_signals",
      "talent_pool_members",
      "talent_graph_edges",
      "notification_events",
    ]) {
      await sb.from(table).delete().in("candidate_profile_id", cpIds);
    }
    const { data: tms } = await sb.from("talent_memory").select("id").in("candidate_profile_id", cpIds);
    const tmIds = (tms ?? []).map((t: { id: string }) => t.id);
    if (tmIds.length > 0) {
      await sb.from("talent_memory_events").delete().in("talent_memory_id", tmIds);
      await sb.from("talent_memory").delete().in("id", tmIds);
    }

    // CV rows + the actual object bytes in the private bucket.
    const { data: files } = await sb
      .from("files")
      .select("id,storage_bucket,storage_path")
      .in("candidate_profile_id", cpIds);
    const buckets = new Map<string, string[]>();
    for (const f of files ?? []) {
      const row = f as { storage_bucket: string | null; storage_path: string | null };
      if (!row.storage_path) continue;
      const bucket = row.storage_bucket ?? "cvs";
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), row.storage_path]);
    }
    let objectsRemoved = 0;
    for (const [bucket, paths] of buckets) {
      const { data: removed } = await sb.storage.from(bucket).remove(paths);
      objectsRemoved += (removed ?? []).length;
    }
    counts.storage_objects_deleted = objectsRemoved;

    await sb.from("candidate_profiles").update({ current_cv_file_id: null }).in("id", cpIds);
    const { count: fc } = await sb.from("files").delete({ count: "exact" }).in("candidate_profile_id", cpIds);
    counts.files_deleted = fc ?? 0;
    const { count: cc } = await sb
      .from("candidate_profiles")
      .delete({ count: "exact" })
      .in("id", cpIds);
    counts.candidate_profiles_deleted = cc ?? 0;

    let usersDeleted = 0;
    for (const cp of cps ?? []) {
      const uid = (cp as { user_id: string | null }).user_id ?? (await findUserIdByEmail(sb, cp.email));
      if (uid) {
        await sb.from("profiles").delete().eq("auth_user_id", uid);
        const { error } = await sb.auth.admin.deleteUser(uid);
        if (!error) usersDeleted += 1;
      }
    }
    counts.auth_users_deleted = usersDeleted;
  }

  // Lead notifications are keyed by email, not by profile.
  const { count: lc } = await sb
    .from("lead_notifications")
    .delete({ count: "exact" })
    .ilike("email", safe);
  counts.lead_notifications_deleted = lc ?? 0;

  // Orphaned talent persons for the same mailbox.
  const { data: persons } = await sb.from("talent_persons").select("id").ilike("primary_email", safe);
  const personIds = (persons ?? []).map((p: { id: string }) => p.id);
  if (personIds.length > 0) {
    await sb.from("talent_person_identifiers").delete().in("person_id", personIds);
    const { count: pc } = await sb.from("talent_persons").delete({ count: "exact" }).in("id", personIds);
    counts.talent_persons_deleted = pc ?? 0;
  }

  return { deleted: counts };
}


async function handle(request: Request): Promise<Response> {
  const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
  if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

  const token = request.headers.get("x-qa-token");
  const expected = process.env.QA_SEED_TOKEN;
  if (!expected) return new Response("QA_SEED_TOKEN not configured", { status: 500 });
  if (!token || token !== expected) return new Response("forbidden", { status: 401 });

  let body: {
    action?: string;
    pending_invites?: number;
    extra_active?: boolean;
    free_seats?: boolean;
    email?: string;
    user_id?: string;
    position_id?: string;
    full_name?: string;
    prefix?: string;
    company_name?: string;
    email_pattern?: string;
    organization_id?: string;
    match_id?: string;
  } = {};
  try {
    const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.qa_seed);
    if (!read.ok) {
      return Response.json({ ok: false, error: read.error, ...read.detail }, { status: read.status });
    }
    body = read.body as typeof body;
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
    }
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
    // Tenant-isolation assertions: what a workspace's member list actually is,
    // and how many organizations exist for one company name. Read-only.
    if (action === "lookup_tenant") {
      if (!body.organization_id && !body.company_name) {
        return Response.json(
          { ok: false, error: "organization_id or company_name required" },
          { status: 400 },
        );
      }
      const sb = await loadAdmin();
      let orgIds: string[] = body.organization_id ? [body.organization_id] : [];
      let organizations: Array<{ id: string; name: string; status: string; domain: string | null }> = [];
      if (body.company_name) {
        const norm = String(body.company_name)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[.,]/g, "");
        const { data } = await sb
          .from("organizations")
          .select("id, name, status, domain")
          .eq("name_normalized", norm);
        organizations = (data ?? []) as typeof organizations;
        orgIds = organizations.map((o) => o.id);
      } else {
        const { data } = await sb
          .from("organizations")
          .select("id, name, status, domain")
          .in("id", orgIds);
        organizations = (data ?? []) as typeof organizations;
      }
      let memberships: Array<{
        user_id: string;
        organization_id: string;
        role: string;
        status: string;
        email: string | null;
      }> = [];
      if (orgIds.length > 0) {
        const { data: mems } = await sb
          .from("memberships")
          .select("user_id, organization_id, role, status")
          .in("organization_id", orgIds);
        const rows = (mems ?? []) as Array<{
          user_id: string;
          organization_id: string;
          role: string;
          status: string;
        }>;
        const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const emailByUser = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profs } = await sb
            .from("profiles")
            .select("auth_user_id, email")
            .in("auth_user_id", userIds);
          for (const p of (profs ?? []) as Array<{ auth_user_id: string; email: string }>) {
            emailByUser.set(p.auth_user_id, p.email);
          }
        }
        memberships = rows.map((r) => ({ ...r, email: emailByUser.get(r.user_id) ?? null }));
      }
      return Response.json({ ok: true, action, organizations, memberships });
    }

    /**
     * Read-only trail for the full-journey walkthrough: what the handoff
     * actually recorded. A UI assertion alone cannot tell whether the audit
     * event and the notification were written, and those two are what the
     * business relies on later (activity feeds, digests, disputes).
     * Scoped to one organisation and never mutates anything.
     */
    if (action === "journey_trail") {
      if (!body.organization_id) {
        return Response.json({ ok: false, error: "organization_id required" }, { status: 400 });
      }
      const sb = await loadAdmin();
      const org = body.organization_id;
      // Some writers record an entity without an organisation (public intake
      // runs before the workspace exists), so the trail is the union of the
      // org-scoped rows and anything pointing at this position or match.
      const entityIds = [body.position_id, body.match_id].filter(Boolean) as string[];
      const [audit, auditByEntity, events, notifs, position, match] = await Promise.all([
        sb
          .from("audit_events")
          .select("id, action, entity_type, entity_id, created_at, actor_user_id, trace_id")
          .eq("organization_id", org)
          .order("created_at", { ascending: true })
          .limit(500),
        entityIds.length > 0
          ? sb
              .from("audit_events")
              .select("id, action, entity_type, entity_id, created_at, actor_user_id, trace_id")
              .in("entity_id", entityIds)
              .order("created_at", { ascending: true })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        sb
          .from("notification_events")
          .select("id, event_type, organization_id, position_id, application_id, created_at")
          .eq("organization_id", org)
          .order("created_at", { ascending: true })
          .limit(500),
        sb
          .from("notifications")
          .select("id, event_type, audience, recipient_user_id, title, created_at")
          .eq("organization_id", org)
          .order("created_at", { ascending: true })
          .limit(500),
        body.position_id
          ? sb
              .from("positions")
              .select("id, title, status, visibility, reference_code")
              .eq("id", body.position_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        body.match_id
          ? sb
              .from("candidate_matches")
              .select(
                "id, stage, admin_status, client_visibility, processing_state, total_score, score_band, contact_released_at",
              )
              .eq("id", body.match_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      // A silent query error would read as "no audit trail", which is exactly
      // the failure this endpoint exists to detect — surface it instead.
      const firstError =
        audit.error ?? auditByEntity.error ?? events.error ?? notifs.error ?? null;
      if (firstError) {
        return Response.json({ ok: false, error: firstError.message }, { status: 500 });
      }
      type AuditRow = { id: string; action: string };
      const merged = new Map<string, AuditRow>();
      for (const row of [
        ...((audit.data ?? []) as AuditRow[]),
        ...((auditByEntity.data ?? []) as AuditRow[]),
      ]) {
        merged.set(row.id, row);
      }
      return Response.json({
        ok: true,
        action,
        audit_events: Array.from(merged.values()),
        notification_events: events.data ?? [],
        notifications: notifs.data ?? [],
        position: position.data ?? null,
        match: match.data ?? null,
      });
    }



    if (action === "lookup_candidate_application") {
      if (!body.email) return Response.json({ ok: false, error: "email required" }, { status: 400 });
      const res = await lookupCandidateApplication(body.email);
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "cleanup_candidate_e2e") {
      const res = await cleanupCandidateE2E(body.email_pattern ?? "qa.cand+%@qa.taasflow.test");
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "lookup_booking") {
      if (!body.email) return Response.json({ ok: false, error: "email required" }, { status: 400 });
      const res = await lookupBooking(body.email);
      return Response.json({ ok: true, action, ...res });
    }

    if (action === "seat_scenario") {
      const res = await seatScenario({
        pendingInvites: Number(body.pending_invites ?? 0),
        extraActive: Boolean(body.extra_active ?? false),
        freeSeats: Boolean(body.free_seats ?? false),
      });
      return Response.json({ ok: true, action, ...res });
    }
    if (action === "seat_scenario_reset") {
      const res = await seatScenarioReset();
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
        // Re-seeding mints a new auth user for the same QA mailbox, so an older
        // profile can still hold the email (unique). Relink it instead of
        // colliding on candidate_profiles_email_uniq.
        const { data: byEmail } = await sb
          .from("candidate_profiles")
          .select("id")
          .ilike("email", body.email as string)
          .maybeSingle();
        if (byEmail?.id) {
          cpId = byEmail.id as string;
          await sb.from("candidate_profiles").update({ user_id: body.user_id }).eq("id", cpId);
        }
      }
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
        .insert({ candidate_profile_id: cpId, position_id: body.position_id, source: "web", status: "submitted" })
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
    // Supabase returns plain objects, not Errors — serialise them so QA runs
    // get an actionable message instead of "[object Object]".
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
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

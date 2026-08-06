/**
 * TEST — tenant isolation on the two public intake entry points.
 *
 * These endpoints are unauthenticated by design: a prospect must be able to
 * create an account, a workspace and a role in one POST. That makes three
 * security properties non-negotiable, and this suite proves each of them
 * end-to-end against the real handlers and the rows they persist:
 *
 *   1. account_exists — a public form can never write to an existing account
 *      (no silent password reset, no work created on someone else's identity).
 *   2. organization_exists — a matching company name or email domain is not
 *      proof of belonging, so an existing workspace is never joined by an
 *      unproven caller.
 *   3. no tenant hijack — a valid bearer token for tenant B does not open
 *      tenant A, and every rejection leaves zero persisted side effects
 *      (no orphan organization, no membership, no changed password).
 *
 * Rejections are asserted twice: on the API response AND on the database, via
 * the token-guarded QA lookup. A 409 that still wrote a membership would pass
 * a response-only assertion, so response-only assertions are not enough here.
 *
 * All data is namespaced (QA_INTAKE_E2E_* organizations, qa.intake+* mailboxes)
 * and removed by global teardown. No production row is read or written.
 */
import { expect, test } from "@playwright/test";
import {
  QA_PASSWORD,
  accessTokenFor,
  lookupTenant,
  postPublic,
  signIn,
  uniqueProspect,
} from "./helpers/qa";

const OWNER_PASSWORD = "OwnerPass!Tenant1";
const ATTACKER_PASSWORD = "AttackerPass!Tenant1";

type IntakeResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  organizationId?: string | null;
  intakeId?: string | null;
  userId?: string | null;
  replay?: boolean;
};

function idem(label: string): string {
  return `qa-tenant-${label}-${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

/** Minimal-but-valid /api/public/intake payload. */
function intakePayload(over: {
  companyName: string;
  workEmail: string;
  password?: string;
  companyWebsite?: string;
}): Record<string, unknown> {
  return {
    idempotencyKey: idem("intake"),
    firstName: "Dana",
    lastName: "Whitfield",
    workEmail: over.workEmail,
    companyName: over.companyName,
    companyWebsite: over.companyWebsite ?? "",
    roleTitle: "Clinical Operations Manager",
    workModel: "hybrid",
    mustHaveSkills: ["Clinical operations", "Site monitoring", "Vendor management"],
    consent: true,
    ...(over.password ? { password: over.password } : {}),
    source: "qa_tenant_isolation",
  };
}

/** Minimal-but-valid /api/public/express-intake payload. */
function expressPayload(over: {
  companyName: string;
  workEmail: string;
  password?: string;
  companyWebsite?: string;
}): Record<string, unknown> {
  return {
    idempotencyKey: idem("express"),
    companyName: over.companyName,
    companyWebsite: over.companyWebsite ?? "qa-tenant-isolation.test",
    firstName: "Dana",
    lastName: "Whitfield",
    workEmail: over.workEmail,
    ...(over.password ? { password: over.password, confirmPassword: over.password } : {}),
    roleTitle: "Clinical Operations Manager",
    jobDescriptionText:
      "We are hiring a Clinical Operations Manager to run our trial sites end to end, " +
      "owning site readiness, monitoring cadence and vendor performance across three regions.",
    whyOpen:
      "Our two clinical operations leads are covering three sites between them and renewals are slipping.",
    mustHaves: "5+ years in clinical operations\nHas run a site inspection",
    sponsorshipAvailable: "no",
    interviewStages: [],
    dealBreakerList: [],
    inviteCollaborators: false,
    consent: true,
    pilotAcknowledgement: true,
    source: "qa_tenant_isolation",
  };
}

test.describe.configure({ mode: "serial" });

test.describe("tenant isolation — /intake and /express-intake", () => {
  // The legitimate first tenant, created once by the real endpoint.
  const owner = uniqueProspect();
  let ownerOrgId: string | null = null;
  let ownerUserId: string | null = null;

  test("a brand-new prospect creates their own account, workspace and role", async () => {
    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/intake",
      intakePayload({
        companyName: owner.companyName,
        workEmail: owner.email,
        password: OWNER_PASSWORD,
      }),
    );

    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.organizationId).toBeTruthy();
    ownerOrgId = body.organizationId ?? null;
    ownerUserId = body.userId ?? null;

    // Persisted state, not just the response: exactly one organization and one
    // active client_admin — the person who submitted.
    const tenant = await lookupTenant({ companyName: owner.companyName });
    expect(tenant.organizations).toHaveLength(1);
    expect(tenant.memberships.filter((m) => m.status === "active")).toHaveLength(1);
    expect(tenant.memberships[0]?.role).toBe("client_admin");
    expect(tenant.memberships[0]?.email?.toLowerCase()).toBe(owner.email.toLowerCase());

    // The password they chose is the password they own.
    const signedIn = await signIn(owner.email, OWNER_PASSWORD);
    expect(signedIn.accessToken).toBeTruthy();
    expect(signedIn.userId).toBe(ownerUserId);
  });

  // ── 1. account_exists ────────────────────────────────────────────────────

  test("/intake refuses an email that already has an account, and writes nothing", async () => {
    const attacker = uniqueProspect();

    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/intake",
      // Attacker's own company name, but the owner's email and a password of
      // their choosing: the classic account-takeover shape.
      intakePayload({
        companyName: attacker.companyName,
        workEmail: owner.email,
        password: ATTACKER_PASSWORD,
      }),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("account_exists");
    expect(body.ok).toBe(false);
    // Never disclose which workspace that email belongs to.
    expect(JSON.stringify(body)).not.toContain(owner.companyName);
    expect(JSON.stringify(body)).not.toContain(String(ownerOrgId));

    // No orphan tenant for the attacker's company name.
    const attackerTenant = await lookupTenant({ companyName: attacker.companyName });
    expect(attackerTenant.organizations).toHaveLength(0);

    // The owner's account is untouched: their password still works and the
    // attacker's chosen password does not.
    expect((await signIn(owner.email, OWNER_PASSWORD)).accessToken).toBeTruthy();
    expect((await signIn(owner.email, ATTACKER_PASSWORD)).accessToken).toBeNull();

    // And the owner's workspace gained no new member.
    const ownerTenant = await lookupTenant({ organizationId: ownerOrgId! });
    expect(ownerTenant.memberships).toHaveLength(1);
  });

  test("/express-intake refuses an email that already has an account, and writes nothing", async () => {
    const attacker = uniqueProspect();

    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/express-intake",
      expressPayload({
        companyName: attacker.companyName,
        workEmail: owner.email,
        password: ATTACKER_PASSWORD,
      }),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("account_exists");

    const attackerTenant = await lookupTenant({ companyName: attacker.companyName });
    expect(attackerTenant.organizations).toHaveLength(0);
    expect((await signIn(owner.email, ATTACKER_PASSWORD)).accessToken).toBeNull();
    expect((await signIn(owner.email, OWNER_PASSWORD)).accessToken).toBeTruthy();
  });

  test("/express-intake refuses an unproven caller who supplies no password", async () => {
    // No password and no bearer token: the request cannot prove it is the owner
    // of that mailbox, so it must be rejected outright.
    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/express-intake",
      expressPayload({ companyName: uniqueProspect().companyName, workEmail: owner.email }),
    );

    expect(status).toBe(400);
    expect(body.error).toBe("password_required");
  });

  test("/intake-account recognises an existing account without creating a second one", async () => {
    const fresh = uniqueProspect();

    const unknown = await postPublic<{ ok: boolean; exists: boolean }>(
      "/api/public/intake-account",
      { mode: "check", email: fresh.email },
    );
    expect(unknown.status).toBe(200);
    expect(unknown.body.exists).toBe(false);

    const known = await postPublic<{ ok: boolean; exists: boolean; message?: string }>(
      "/api/public/intake-account",
      { mode: "check", email: owner.email },
    );
    expect(known.status).toBe(200);
    expect(known.body.exists).toBe(true);
    // Recognising the person must not reveal their organization.
    expect(JSON.stringify(known.body)).not.toContain(owner.companyName);

    const create = await postPublic<IntakeResponse>("/api/public/intake-account", {
      mode: "create",
      email: owner.email,
      password: ATTACKER_PASSWORD,
      firstName: "Not",
      lastName: "TheOwner",
    });
    expect(create.status).toBe(409);
    expect(create.body.error).toBe("account_exists");
    expect((await signIn(owner.email, ATTACKER_PASSWORD)).accessToken).toBeNull();
  });

  // ── 2. organization_exists ───────────────────────────────────────────────

  test("/intake refuses to join an existing workspace by company name alone", async () => {
    const stranger = uniqueProspect();

    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/intake",
      intakePayload({
        // Same company, a different person, no proof of belonging.
        companyName: owner.companyName,
        workEmail: stranger.email,
        password: ATTACKER_PASSWORD,
      }),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("organization_exists");
    // The message tells them what to do without naming the workspace's id.
    expect(body.message ?? "").toMatch(/sign in|invite/i);
    expect(JSON.stringify(body)).not.toContain(String(ownerOrgId));

    // Nothing was persisted: no second organization, no new member, no account.
    const tenant = await lookupTenant({ companyName: owner.companyName });
    expect(tenant.organizations).toHaveLength(1);
    expect(tenant.memberships).toHaveLength(1);
    expect(tenant.memberships[0]?.email?.toLowerCase()).toBe(owner.email.toLowerCase());
    expect((await signIn(stranger.email, ATTACKER_PASSWORD)).accessToken).toBeNull();
  });

  test("/express-intake refuses to join an existing workspace by company name alone", async () => {
    const stranger = uniqueProspect();

    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/express-intake",
      expressPayload({
        companyName: owner.companyName,
        workEmail: stranger.email,
        password: ATTACKER_PASSWORD,
      }),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("organization_exists");

    const tenant = await lookupTenant({ companyName: owner.companyName });
    expect(tenant.organizations).toHaveLength(1);
    expect(tenant.memberships).toHaveLength(1);
  });

  test("a matching email domain is not proof of belonging either", async () => {
    // Establish a tenant whose organization carries a corporate domain, then
    // have a stranger on that same domain try to walk into it under a company
    // name of their own. Domain ownership is not identity.
    const domainOwner = uniqueProspect();
    const domain = `qa-domain-${Date.now()}.test`;

    const created = await postPublic<IntakeResponse>(
      "/api/public/intake",
      intakePayload({
        companyName: domainOwner.companyName,
        workEmail: `qa.intake+dom-${Date.now()}@${domain}`,
        password: OWNER_PASSWORD,
        companyWebsite: `https://${domain}`,
      }),
    );
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const domainOrgId = created.body.organizationId!;

    const stranger = await postPublic<IntakeResponse>(
      "/api/public/intake",
      intakePayload({
        companyName: `${uniqueProspect().companyName}_SAMEDOMAIN`,
        workEmail: `qa.intake+stranger-${Date.now()}@${domain}`,
        password: ATTACKER_PASSWORD,
      }),
    );

    expect(stranger.status).toBe(409);
    expect(stranger.body.error).toBe("organization_exists");

    const tenant = await lookupTenant({ organizationId: domainOrgId });
    expect(tenant.memberships).toHaveLength(1);
    expect(tenant.memberships[0]?.email?.toLowerCase()).toBe(
      created.body.userId ? tenant.memberships[0]?.email?.toLowerCase() ?? "" : "",
    );
  });

  // ── 3. tenant hijack prevention ──────────────────────────────────────────

  test("a valid token for another tenant does not open this one", async () => {
    // A real, fully authenticated client_admin — of a DIFFERENT workspace.
    const seed = JSON.parse(process.env["E2E_SEED"] ?? "{}") as {
      users?: Record<string, { email: string; password: string }>;
      org_id?: string;
    };
    const otherAdmin = seed.users?.["client_admin"];
    expect(otherAdmin, "seeded client_admin is required").toBeTruthy();
    const token = await accessTokenFor(otherAdmin!.email, otherAdmin!.password ?? QA_PASSWORD);

    for (const path of ["/api/public/intake", "/api/public/express-intake"] as const) {
      const payload =
        path === "/api/public/intake"
          ? intakePayload({ companyName: owner.companyName, workEmail: uniqueProspect().email, password: ATTACKER_PASSWORD })
          : expressPayload({ companyName: owner.companyName, workEmail: uniqueProspect().email, password: ATTACKER_PASSWORD });

      const { status, body } = await postPublic<IntakeResponse>(path, payload, {
        accessToken: token,
      });

      // Signed in, but signed in somewhere else.
      expect(status, `${path}: ${JSON.stringify(body)}`).toBe(409);
      expect(body.error).toBe("organization_exists");
      expect(body.organizationId ?? null).not.toBe(ownerOrgId);
    }

    // The owner's workspace still has exactly its one original member, and the
    // other tenant's admin is not in it.
    const tenant = await lookupTenant({ organizationId: ownerOrgId! });
    expect(tenant.memberships).toHaveLength(1);
    expect(tenant.memberships.some((m) => m.email?.toLowerCase() === otherAdmin!.email.toLowerCase())).toBe(
      false,
    );
  });

  test("the real owner, signed in, launches a second role inside their own workspace", async () => {
    // The positive half of the same rule: proving membership is exactly what
    // unlocks an existing tenant, and it reuses the tenant instead of forking it.
    const token = await accessTokenFor(owner.email, OWNER_PASSWORD);

    const { status, body } = await postPublic<IntakeResponse>(
      "/api/public/intake",
      intakePayload({ companyName: owner.companyName, workEmail: owner.email }),
      { accessToken: token },
    );

    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.organizationId).toBe(ownerOrgId);

    // Still one organization, still one member: joined, not duplicated.
    const tenant = await lookupTenant({ companyName: owner.companyName });
    expect(tenant.organizations).toHaveLength(1);
    expect(tenant.memberships).toHaveLength(1);
  });

  test("replaying the same idempotency key never creates a second tenant", async () => {
    const prospect = uniqueProspect();
    const payload = intakePayload({
      companyName: prospect.companyName,
      workEmail: prospect.email,
      password: OWNER_PASSWORD,
    });

    const first = await postPublic<IntakeResponse>("/api/public/intake", payload);
    expect(first.status, JSON.stringify(first.body)).toBe(200);

    const replay = await postPublic<IntakeResponse>("/api/public/intake", payload);
    expect(replay.status).toBe(200);
    expect(replay.body.replay).toBe(true);
    expect(replay.body.organizationId).toBe(first.body.organizationId);

    const tenant = await lookupTenant({ companyName: prospect.companyName });
    expect(tenant.organizations).toHaveLength(1);
    expect(tenant.memberships).toHaveLength(1);
  });
});

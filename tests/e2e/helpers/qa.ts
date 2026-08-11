/**
 * QA fixtures + login helpers for the E2E suite.
 *
 * All seeded data comes from /api/public/qa-seed, which is token-guarded and
 * only ever touches rows it created itself (QA_* names / @qa.taasflow.test
 * mailboxes). No production row is read or written by this suite.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";

export const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";
export const QA_PASSWORD = "QaTest!Phase11";

/** Prefix for organizations created by driving the real /intake form. */
export const INTAKE_ORG_PREFIX = "QA_INTAKE_E2E_";
/** Mailbox pattern for accounts created by driving the real /intake form. */
export const INTAKE_EMAIL_PREFIX = "qa.intake+";
export const QA_EMAIL_DOMAIN = "qa.taasflow.test";

export type SeededUser = { id: string; email: string; password: string };

export type SeedResult = {
  ok: boolean;
  users: Record<
    "platform_admin" | "client_admin" | "client_viewer" | "candidate" | string,
    SeededUser
  >;
  org_id: string;
  other_org_id: string;
  position_id: string;
  closed_position_id: string;
};

type QaAction =
  | "seed"
  | "cleanup"
  | "status"
  | "create_application"
  | "cleanup_intake_e2e"
  | "lookup_intake"
  | "lookup_candidate_application"
  | "cleanup_candidate_e2e"
  | "lookup_booking"
  | "cleanup_booking_e2e"
  | "lookup_tenant";

function token(): string {
  const value = process.env["QA_SEED_TOKEN"];
  if (!value) throw new Error("QA_SEED_TOKEN is not set in the environment");
  return value;
}

export async function qaSeed<T = Record<string, unknown>>(
  action: QaAction,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/public/qa-seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-qa-token": token() },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`qa-seed ${action} failed (${res.status}): ${text}`);
  return JSON.parse(text) as T;
}

export const seedFixtures = () => qaSeed<SeedResult>("seed");
export const cleanupFixtures = () => qaSeed("cleanup");
/** Removes every org/intake/account this suite created through the real UI. */
export const cleanupIntakeArtifacts = (prefix = INTAKE_ORG_PREFIX) =>
  qaSeed<{ deleted: Record<string, number> }>("cleanup_intake_e2e", { prefix });

/** Reads back what the real submit actually persisted, for assertions. */
export const lookupIntake = (companyName: string, email?: string) =>
  qaSeed<{
    ok: boolean;
    organization: { id: string; name: string; is_test_record: boolean } | null;
    intake_submission: { id: string; organization_id: string | null } | null;
    auth_user: { id: string; email: string } | null;
    position: { id: string; title: string; status: string } | null;
    booking_sessions: number;
  }>("lookup_intake", { company_name: companyName, email });

export const CANDIDATE_EMAIL_PREFIX = "qa.cand+";

export type CandidateArtifacts = {
  ok: boolean;
  candidate_profile: {
    id: string;
    full_name: string;
    email: string;
    user_id: string | null;
    current_cv_file_id: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
  } | null;
  applications: Array<{
    id: string;
    position_id: string;
    organization_id: string | null;
    status: string;
    source: string | null;
    cv_file_id: string | null;
    consent: unknown;
  }>;
  matches: Array<{
    id: string;
    application_id: string;
    organization_id: string;
    position_id: string;
    processing_state: string;
    stage: string;
    admin_status: string;
    client_visibility: string;
    total_score: number | null;
    score_band: string | null;
  }>;
  jobs: Array<{ id: string; entity_id: string; job_type: string; status: string; attempts: number }>;
  score_runs: Array<{ id: string; candidate_match_id: string; status: string; total_score: number | null }>;
  evidence: number;
  answers: Array<{ id: string; application_id: string; question_id: string; answer: unknown }>;
  files: Array<{
    id: string;
    storage_bucket: string | null;
    storage_path: string | null;
    filename: string | null;
    mime_type: string | null;
    size: number | null;
    page_count: number | null;
    parse_state: string | null;
    file_status: string | null;
    upload_source: string | null;
  }>;
  notification_events: Array<{
    id: string;
    event_type: string;
    application_id: string | null;
    organization_id: string | null;
  }>;
  notifications: number;
  notification_deliveries: number;
  storage_objects: Array<{ path: string; exists: boolean; size: number | null }>;
};

/** Reads back the rows the real apply flow persisted for one QA mailbox. */
export const lookupCandidate = (email: string) =>
  qaSeed<CandidateArtifacts>("lookup_candidate_application", { email });

/** Removes every candidate artefact this suite created through the real UI. */
export const cleanupCandidateArtifacts = (
  emailPattern = `${CANDIDATE_EMAIL_PREFIX}%@${QA_EMAIL_DOMAIN}`,
) => qaSeed<{ deleted: Record<string, number> }>("cleanup_candidate_e2e", { email_pattern: emailPattern });

/** Unique candidate mailbox per run so reruns never collide. */
export function uniqueCandidate(): { stamp: string; email: string; fullName: string } {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    stamp,
    email: `${CANDIDATE_EMAIL_PREFIX}${stamp}@${QA_EMAIL_DOMAIN}`,
    fullName: `QA Candidate ${stamp}`,
  };
}

/**
 * Mailbox family for the dedicated apply-flow suite.
 * `.test` is a reserved TLD, so nothing here can ever reach a real inbox, and
 * the qa-seed helpers refuse any address outside `qa*@*.test`.
 */
export const APPLY_EMAIL_PREFIX = "qa+apply-";
export const APPLY_EMAIL_DOMAIN = "taasflow.test";
export const APPLY_EMAIL_PATTERN = `${APPLY_EMAIL_PREFIX}%@${APPLY_EMAIL_DOMAIN}`;

/** Unique-per-run apply mailbox, e.g. qa+apply-1712…@taasflow.test */
export function uniqueApplicant(label = "TESTRUN"): {
  stamp: string;
  email: string;
  fullName: string;
} {
  const stamp = `${label}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    stamp,
    email: `${APPLY_EMAIL_PREFIX}${stamp}@${APPLY_EMAIL_DOMAIN}`.toLowerCase(),
    fullName: `QA Applicant ${stamp}`,
  };
}

/** Removes every artefact the apply suite created (all qa+apply-* mailboxes). */
export const cleanupApplyArtifacts = () =>
  qaSeed<{ deleted: Record<string, number> }>("cleanup_candidate_e2e", {
    email_pattern: APPLY_EMAIL_PATTERN,
  });


export const BOOKING_EMAIL_PREFIX = "qa.book+";

export type BookingSessionRow = {
  id: string;
  email: string;
  company_name: string | null;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  join_url: string | null;
  timezone: string | null;
  host_name: string | null;
  calendly_event_uri: string | null;
  calendly_invitee_uri: string | null;
  qualification_score: number | null;
};

/** Reads back the booking_sessions rows the real /book submit persisted. */
export const lookupBooking = (email: string) =>
  qaSeed<{ ok: boolean; sessions: BookingSessionRow[] }>("lookup_booking", { email });

/** Removes every booking row this suite created through the real UI. */
export const cleanupBookingArtifacts = (
  emailPattern = `${BOOKING_EMAIL_PREFIX}%@${QA_EMAIL_DOMAIN}`,
) => qaSeed<{ deleted: number }>("cleanup_booking_e2e", { email_pattern: emailPattern });

/** Unique-per-run booking prospect mailbox. */
export function uniqueBookingProspect(): { stamp: string; email: string; companyName: string } {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    stamp,
    email: `${BOOKING_EMAIL_PREFIX}${stamp}@${QA_EMAIL_DOMAIN}`,
    companyName: `${INTAKE_ORG_PREFIX}BOOK_${stamp}`,
  };
}

/**
 * Posts a Calendly-shaped webhook to our public handler with a real HMAC
 * signature, so the test exercises the same code path Calendly hits.
 * Returns the raw status so a test can assert 401 on a forged signature.
 */
export async function postCalendlyWebhook(
  body: unknown,
  opts: { signingKey?: string; forge?: boolean } = {},
): Promise<{ status: number; text: string }> {
  const key = opts.signingKey ?? process.env["CALENDLY_WEBHOOK_SIGNING_KEY"];
  if (!key) throw new Error("CALENDLY_WEBHOOK_SIGNING_KEY is not set in the environment");
  const raw = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const { createHmac } = await import("node:crypto");
  const v1 = opts.forge
    ? "0".repeat(64)
    : createHmac("sha256", key).update(`${timestamp}.${raw}`).digest("hex");
  const res = await fetch(`${BASE_URL}/api/public/booking/calendly-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "calendly-webhook-signature": `t=${timestamp},v1=${v1}`,
    },
    body: raw,
  });
  return { status: res.status, text: await res.text() };
}

/**
 * Waits until React has attached to a specific server-rendered control.
 *
 * Cheaper and more general than waitForHydration: it inspects the DOM node for
 * React's internal props key, which only exists after hydration commits.
 */
export async function waitForReactMount(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { state: "attached", timeout: 60_000 });
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          return Object.keys(el).some((k) => k.startsWith("__reactProps"));
        }, selector),
      { timeout: 90_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
}

/**
 * QA fixture positions are flagged is_test_record and hidden from the public
 * board. This cookie is the token-guarded opt-in that lets the suite drive the
 * real listing/apply UI against the fixture.
 */
export async function allowTestFixtures(
  context: Pick<BrowserContext, "addCookies">,
): Promise<void> {
  await context.addCookies([
    { name: "qa_e2e", value: token(), url: BASE_URL },
  ]);
}

/** Kicks the pipeline worker so the suite does not wait on the 2-minute cron. */
export async function runPipelineDrain(): Promise<void> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!key) return;
  await fetch(`${BASE_URL}/api/public/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ drain: true, limit: 5 }),
  }).catch(() => undefined);
}

/** Unique-per-run identity so reruns never collide. */
export function uniqueProspect(): {
  stamp: string;
  companyName: string;
  email: string;
} {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    stamp,
    companyName: `${INTAKE_ORG_PREFIX}${stamp}`,
    email: `${INTAKE_EMAIL_PREFIX}${stamp}@${QA_EMAIL_DOMAIN}`,
  };
}

/**
 * Waits until React has hydrated an interactive page.
 *
 * Server-rendered markup is visible long before its event handlers attach, so
 * a click fired too early is silently dropped and typed values get replaced by
 * the client's initial state. We prove interactivity by toggling a control that
 * only responds once hydrated, then restore it.
 */
export async function waitForHydration(page: Page): Promise<void> {
  const hide = page.getByRole("button", { name: /^hide$/i }).first();
  const show = page.getByRole("button", { name: /show summary/i }).first();
  await expect
    .poll(
      async () => {
        if ((await show.count()) > 0) return true;
        await hide.click({ timeout: 2_000 }).catch(() => undefined);
        return (await show.count()) > 0;
      },
      { timeout: 45_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
  await show.click();
  await expect(hide).toBeVisible();
}

/** Collects console errors so a test can assert a clean run. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Console noise that is environmental, not a defect in these flows. */
const IGNORED_CONSOLE = [
  "favicon",
  "Download the React DevTools",
  "calendly",
  "ERR_BLOCKED_BY_CLIENT",
  "net::ERR_INTERNET_DISCONNECTED",
  "the server responded with a status of 4",
  "the server responded with a status of 5",
  "rb2b",
  "googletagmanager",
  "facebook",
  "sentry",
];

export function meaningfulConsoleErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !IGNORED_CONSOLE.some((needle) => e.toLowerCase().includes(needle.toLowerCase())),
  );
}

/** Signs a role in through the real app UI and asserts the landing route. */
export async function loginAs(
  page: Page,
  kind: "client" | "admin" | "candidate",
  email: string,
  password: string = QA_PASSWORD,
): Promise<void> {
  // One sign-in surface for every persona, candidates included.
  const route = "/login";
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .not.toMatch(/login/);
}

// ─────────────────────────────────────────────────────────────
// Tenant-isolation helpers
// ─────────────────────────────────────────────────────────────

export type TenantSnapshot = {
  ok: boolean;
  organizations: Array<{ id: string; name: string; status: string; domain: string | null }>;
  memberships: Array<{
    user_id: string;
    organization_id: string;
    role: string;
    status: string;
    email: string | null;
  }>;
};

/**
 * Reads the real organizations + membership rows for a company name (or org id)
 * so a test can prove a rejected request created no tenant and granted no
 * access. Assertions must never rely on the API response alone: the security
 * property is about what is persisted.
 */
export const lookupTenant = (args: { companyName?: string; organizationId?: string }) =>
  qaSeed<TenantSnapshot>("lookup_tenant", {
    company_name: args.companyName,
    organization_id: args.organizationId,
  });

function supabaseAuthConfig(): { url: string; key: string } {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase URL/publishable key are not set in the environment");
  return { url, key };
}

/**
 * Signs in with a password and returns the access token, exactly as the browser
 * would. Used to prove the difference between an anonymous caller and the real
 * owner of an account — the only thing these endpoints accept as identity.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ status: number; accessToken: string | null; userId: string | null }> {
  const { url, key } = supabaseAuthConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    user?: { id?: string };
  };
  return {
    status: res.status,
    accessToken: json.access_token ?? null,
    userId: json.user?.id ?? null,
  };
}

/** Signs in and fails loudly when it does not work — for arranging a test. */
export async function accessTokenFor(email: string, password: string): Promise<string> {
  const { status, accessToken } = await signIn(email, password);
  if (!accessToken) throw new Error(`sign-in for ${email} failed (${status})`);
  return accessToken;
}

export type PublicApiResult<T = Record<string, unknown>> = { status: number; body: T };

/** POSTs JSON to one of our public endpoints, optionally as a signed-in user. */
export async function postPublic<T = Record<string, unknown>>(
  path: string,
  payload: unknown,
  opts: { accessToken?: string | null; noRetry?: boolean } = {},
): Promise<PublicApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.accessToken) headers["authorization"] = `Bearer ${opts.accessToken}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  // These endpoints rate-limit per connection by the minute. A 429 is the
  // limiter working, not the behaviour under test, so wait it out once rather
  // than reporting a false failure.
  if (res.status === 429 && !opts.noRetry) {
    await new Promise((r) => setTimeout(r, 62_000));
    return postPublic<T>(path, payload, { ...opts, noRetry: true });
  }
  return { status: res.status, body: body as T };
}

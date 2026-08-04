/**
 * QA fixtures + login helpers for the E2E suite.
 *
 * All seeded data comes from /api/public/qa-seed, which is token-guarded and
 * only ever touches rows it created itself (QA_* names / @qa.taasflow.test
 * mailboxes). No production row is read or written by this suite.
 */
import { expect, type Page } from "@playwright/test";

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
  | "cleanup_candidate_e2e";

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
export const lookupIntake = (companyName: string) =>
  qaSeed<{
    ok: boolean;
    organization: { id: string; name: string; is_test_record: boolean } | null;
    intake_submission: { id: string; organization_id: string | null } | null;
    auth_user: { id: string; email: string } | null;
    position: { id: string; title: string; status: string } | null;
    booking_sessions: number;
  }>("lookup_intake", { company_name: companyName });

export const CANDIDATE_EMAIL_PREFIX = "qa.cand+";

export type CandidateArtifacts = {
  ok: boolean;
  candidate_profile: { id: string; full_name: string; email: string; user_id: string | null } | null;
  applications: Array<{ id: string; position_id: string; status: string; cv_file_id: string | null }>;
  matches: Array<{
    id: string;
    application_id: string;
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
 * QA fixture positions are flagged is_test_record and hidden from the public
 * board. This cookie is the token-guarded opt-in that lets the suite drive the
 * real listing/apply UI against the fixture.
 */
export async function allowTestFixtures(context: {
  addCookies: (c: Array<Record<string, unknown>>) => Promise<void>;
}): Promise<void> {
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

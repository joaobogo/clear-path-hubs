/**
 * When the role analysis (the Role Blueprint run) should start, and whether a
 * run that says it is in progress is actually alive.
 *
 * Why this exists (owner report, 8 Oct: "I applied for a role, it picked up,
 * it didn't automatically analyze"):
 *
 *  1. /api/public/express-intake started the run with an un-awaited
 *     `runBlueprintForPosition(...)` and returned. The app runs on Cloudflare
 *     Workers, where work left running after the response is not kept alive.
 *     The run got as far as CLAIMING the job (blueprint_status → analyzing_jd)
 *     and was then dropped.
 *  2. The browser's own trigger (/api/public/blueprint-run, sent right after
 *     submit) then found "analyzing_jd", answered "already_running", and did
 *     nothing. The confirmation page only re-nudged a role still "queued".
 *  3. Nothing ever reclaimed a run stuck mid-way: the drain only looked at
 *     queued/failed/not_started (and is not scheduled in any migration), and
 *     the role page offered "Try again" only for "failed". The role sat on
 *     "Reading your job description" forever.
 *
 * The fix: the intake leaves the role "queued" and the run happens inside a
 * request that stays open for it (blueprint-run from the intake page, or
 * ensureRoleAnalysis from the role page). A run whose heartbeat (updated_at,
 * touched at every stage) is older than BLUEPRINT_STALE_MS is treated as dead
 * and may be reclaimed — by the role page, by the confirmation page, or by the
 * drain. The claim is a conditional update, so two callers can never both run.
 */

export const BLUEPRINT_RUNNABLE_STATUSES = ["queued", "failed", "not_started", ""] as const;
export const BLUEPRINT_IN_PROGRESS_STATUSES = [
  "analyzing_jd",
  "researching_company",
  "drafting_blueprint",
] as const;

/** A run that has not touched its row for this long is considered dead. */
export const BLUEPRINT_STALE_MS = 10 * 60 * 1000;

/** Automatic attempts before a person has to press "Try again". */
export const BLUEPRINT_MAX_AUTO_ATTEMPTS = 5;

export type BlueprintRowLike = {
  blueprint_status?: string | null;
  updated_at?: string | null;
  blueprint_attempts?: number | null;
  blueprint_error?: string | null;
};

const statusOf = (s: string | null | undefined) => String(s ?? "not_started") || "not_started";

export function isBlueprintInProgress(status: string | null | undefined): boolean {
  return (BLUEPRINT_IN_PROGRESS_STATUSES as readonly string[]).includes(statusOf(status));
}

export function isBlueprintRunnable(status: string | null | undefined): boolean {
  return (BLUEPRINT_RUNNABLE_STATUSES as readonly string[]).includes(statusOf(status));
}

/** In progress on paper, but nothing has touched it for BLUEPRINT_STALE_MS. */
export function isBlueprintStale(
  status: string | null | undefined,
  updatedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!isBlueprintInProgress(status)) return false;
  const t = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(t)) return true;
  return now - t > BLUEPRINT_STALE_MS;
}

/** Failures worth one more automatic try; anything else needs a person. */
export function isTransientBlueprintError(reason: string | null | undefined): boolean {
  const r = String(reason ?? "");
  if (!r) return false;
  return /^(rate_limited|gateway_unreachable|gateway_5\d\d|empty_completion|non_json_completion|pipeline_error)/.test(r);
}

export type AnalysisState = "ready" | "running" | "stalled" | "waiting" | "failed" | "exhausted";

export type AnalysisDecision = {
  state: AnalysisState;
  /** True when this caller should start (or restart) the run now. */
  shouldStart: boolean;
  /** Plain words for the role page. */
  label: string;
};

/**
 * One decision, used by the role page, the server trigger and the drain, so
 * they can never disagree about whether a role needs its analysis started.
 */
export function analysisDecision(row: BlueprintRowLike, now: number = Date.now()): AnalysisDecision {
  const status = statusOf(row.blueprint_status);
  const attempts = Number(row.blueprint_attempts ?? 0);
  if (status === "ready" || status === "confirmed") {
    return { state: "ready", shouldStart: false, label: "Role analysed" };
  }
  if (isBlueprintInProgress(status)) {
    if (isBlueprintStale(status, row.updated_at, now)) {
      return attempts >= BLUEPRINT_MAX_AUTO_ATTEMPTS
        ? { state: "exhausted", shouldStart: false, label: "The analysis stopped. Try it again." }
        : { state: "stalled", shouldStart: true, label: "Restarting the analysis…" };
    }
    return { state: "running", shouldStart: false, label: "Analysing your role…" };
  }
  if (status === "failed") {
    const retry = isTransientBlueprintError(row.blueprint_error) && attempts < 2;
    return {
      state: "failed",
      shouldStart: retry,
      label: retry ? "Retrying the analysis…" : "The analysis could not finish. Try it again.",
    };
  }
  // queued / not_started / anything unknown
  return attempts >= BLUEPRINT_MAX_AUTO_ATTEMPTS
    ? { state: "exhausted", shouldStart: false, label: "The analysis stopped. Try it again." }
    : { state: "waiting", shouldStart: true, label: "Analysing your role…" };
}

/**
 * Health notes for the admin Pipeline Health page: the silent ways the
 * analysis can fail to run in an environment.
 */
export function blueprintHealthNotes(input: {
  hasAiKey: boolean;
  hasCronSecret: boolean;
  stuck: number;
  waiting: number;
  failed: number;
}): Array<{ level: "error" | "warning"; text: string }> {
  const notes: Array<{ level: "error" | "warning"; text: string }> = [];
  if (!input.hasAiKey) {
    notes.push({
      level: "error",
      text: "LOVABLE_API_KEY is not set in this environment, so no role analysis can finish — every run ends as failed (missing_api_key).",
    });
  }
  if (!input.hasCronSecret) {
    notes.push({
      level: "warning",
      text: "CRON_INVOKE_SECRET is not set, so /api/public/blueprint-drain refuses every call. Roles are still analysed when the intake or the role page starts them, but nothing retries in the background.",
    });
  }
  if (input.stuck > 0) {
    notes.push({
      level: "warning",
      text: `${input.stuck} role analys${input.stuck === 1 ? "is has" : "es have"} not moved for over ${Math.round(BLUEPRINT_STALE_MS / 60000)} minutes. They restart when the role page is opened, or when the drain runs.`,
    });
  }
  if (input.waiting > 0) {
    notes.push({
      level: "warning",
      text: `${input.waiting} role${input.waiting === 1 ? " is" : "s are"} queued for analysis and older than ${Math.round(BLUEPRINT_STALE_MS / 60000)} minutes.`,
    });
  }
  if (input.failed > 0) {
    notes.push({
      level: "warning",
      text: `${input.failed} role analys${input.failed === 1 ? "is" : "es"} failed. Open the role and choose "Try analysis again".`,
    });
  }
  return notes;
}

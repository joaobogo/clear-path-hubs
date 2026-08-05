/**
 * Deal-breakers: the short list of things that rule someone out on a role.
 *
 * One catalogue for the intake wizard, the role page, the recruiting team's
 * filters and the client's rejection reason list — so a reason the client
 * states once is never learned again one rejection at a time.
 *
 * Browser-safe: no server imports.
 */

export const MAX_DEAL_BREAKERS = 5;
/** The wizard starts with three short lines, per the brief. */
export const DEFAULT_DEAL_BREAKER_LINES = 3;
export const MIN_DEAL_BREAKER_CHARS = 3;
export const MAX_DEAL_BREAKER_CHARS = 120;

/**
 * Stated policy line. Deal-breakers are free text, so the policy is said out
 * loud rather than assumed — and criteria tied to protected characteristics are
 * removed before sourcing starts.
 */
export const DEAL_BREAKER_POLICY_LINE =
  "Keep these about the work: experience, credentials, availability, notice or location. Anything tied to age, sex, race, religion, disability, pregnancy or another protected characteristic is removed before sourcing.";

/** Shown when the list is empty, so nobody has to guess what belongs here. */
export const DEAL_BREAKER_EMPTY_HINT =
  "Most clients name one or two: no agency-only backgrounds, notice longer than four weeks, or no hands-on ownership of the core system.";

export const DEAL_BREAKER_WHY_IT_MATTERS =
  "We use these as hard filters before you see anyone, and they appear in your rejection reasons — so we learn them once, not one rejection at a time.";

/** Trim, drop blanks, cap the list. The one normaliser both sides use. */
export function normalizeDealBreakers(input: unknown): string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/\r?\n/)
      : [];
  return list
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, MAX_DEAL_BREAKERS);
}

export type DealBreakerIssues = { rowErrors: Record<number, string>; listError?: string };

/**
 * Optional by design — an empty list is valid. A filled line that is too short
 * or too long is an inline error, never a blocked submit somewhere else.
 */
export function validateDealBreakers(lines: string[]): DealBreakerIssues & { ok: boolean } {
  const rowErrors: Record<number, string> = {};
  let listError: string | undefined;

  const filled = lines.filter((l) => (l ?? "").trim().length > 0);
  if (filled.length > MAX_DEAL_BREAKERS) {
    listError = `Keep it to ${MAX_DEAL_BREAKERS} deal-breakers or fewer`;
  }

  const seen = new Set<string>();
  lines.forEach((raw, i) => {
    const value = (raw ?? "").trim();
    if (value.length === 0) return; // blank lines are simply not stated
    if (value.length < MIN_DEAL_BREAKER_CHARS) {
      rowErrors[i] = `Say it in at least ${MIN_DEAL_BREAKER_CHARS} characters, or clear the line`;
      return;
    }
    if (value.length > MAX_DEAL_BREAKER_CHARS) {
      rowErrors[i] = `Keep it under ${MAX_DEAL_BREAKER_CHARS} characters`;
      return;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) rowErrors[i] = "You already said this one";
    else seen.add(key);
  });

  return { ok: !listError && Object.keys(rowErrors).length === 0, rowErrors, listError };
}

/* ------------------------------------------------------------------ */
/* Rejection reasons derived from the stated deal-breakers              */
/* ------------------------------------------------------------------ */

const CODE_PREFIX = "dealbreaker_";

/** Stable, position-scoped code: the client's own words become a reason. */
export function dealBreakerReasonCode(index: number): string {
  return `${CODE_PREFIX}${index + 1}`;
}

export function isDealBreakerReasonCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const n = code.startsWith(CODE_PREFIX) ? Number(code.slice(CODE_PREFIX.length)) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= MAX_DEAL_BREAKERS;
}

export const DEAL_BREAKER_REASON_CODES: string[] = Array.from(
  { length: MAX_DEAL_BREAKERS },
  (_, i) => dealBreakerReasonCode(i),
);

/** The client's stated deal-breakers as pickable decline reasons. */
export function dealBreakerDeclineOptions(
  dealBreakers: string[],
): Array<{ code: string; label: string }> {
  return normalizeDealBreakers(dealBreakers).map((text, i) => ({
    code: dealBreakerReasonCode(i),
    label: text,
  }));
}

/* ------------------------------------------------------------------ */
/* Closing the loop after repeated "Other" rejections                   */
/* ------------------------------------------------------------------ */

/** Two "Other" rejections on one role is the signal that a rule went unsaid. */
export const OTHER_DECLINE_PROMPT_THRESHOLD = 2;

export const DEAL_BREAKER_PROMPT_TITLE = "Add what rules people out";

export function dealBreakerPromptBody(otherCount: number): string {
  return `You have turned down ${otherCount} candidates on this role for "Other". Tell us the rule once and we will filter for it before the next shortlist.`;
}

/** Dismissed once per role, remembered locally — never nagged twice. */
export function dealBreakerPromptDismissKey(positionId: string): string {
  return `taasflow.dealbreaker-prompt.dismissed.${positionId}`;
}

export function shouldPromptForDealBreakers(input: {
  dealBreakers: string[];
  otherDeclineCount: number;
}): boolean {
  return (
    normalizeDealBreakers(input.dealBreakers).length === 0 &&
    input.otherDeclineCount >= OTHER_DECLINE_PROMPT_THRESHOLD
  );
}
